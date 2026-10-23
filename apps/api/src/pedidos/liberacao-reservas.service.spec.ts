import { LiberacaoReservasService } from './liberacao-reservas.service';

const now = new Date('2026-10-23T12:00:00Z');
const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const x = '11111111-1111-4111-8111-111111111111';
const y = '22222222-2222-4222-8222-222222222222';

describe('LiberacaoReservasService', () => {
  const findMany = jest.fn();
  const stockUpdate = jest.fn();
  const reserveUpdate = jest.fn();
  const raw = jest.fn();
  const txRaw = jest.fn();
  const db = { $queryRaw: txRaw, estoque: { updateMany: stockUpdate },
    reservaEstoque: { updateMany: reserveUpdate } };
  const transaction = jest.fn(async (fn: (tx: typeof db) => Promise<number>) => fn(db));
  const service = new LiberacaoReservasService({ $queryRaw: raw,
    reservaEstoque: { findMany }, $transaction: transaction } as never);

  beforeEach(() => {
    jest.clearAllMocks();
    raw.mockResolvedValue([{ agora: now }]);
    findMany.mockResolvedValue([{ id: a, produtoId: x }, { id: b, produtoId: y }]);
    let locks = 0;
    txRaw.mockImplementation(async () => {
      locks++;
      if (locks <= 2) return [{ produtoId: locks === 1 ? x : y }];
      if (locks === 3) return [{ agora: now }];
      return [{ id: locks === 4 ? a : b, produtoId: locks === 4 ? x : y,
        quantidade: locks === 4 ? 5 : 2 }];
    });
    stockUpdate.mockResolvedValue({ count: 1 });
    reserveUpdate.mockResolvedValue({ count: 1 });
  });

  it('limita candidatos, bloqueia estoques em ordem e revalida pedido, estado e prazo', async () => {
    expect(await service.executar()).toBe(2);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50,
      where: { estado: 'ATIVA', pedido: { statusAtual: 'EXPIRADO' },
        momentoExpiracaoValidade: { lte: now } } }));
    expect(txRaw).toHaveBeenCalledTimes(5);
    const queries = txRaw.mock.calls.map((call) => call[0].join(''));
    expect(queries[0]).toContain('"Estoque"');
    expect(queries[1]).toContain('"Estoque"');
    expect(txRaw.mock.calls[0][1]).toBe(x);
    expect(txRaw.mock.calls[1][1]).toBe(y);
    expect(queries[3]).toContain('FOR UPDATE OF r, p');
    expect(queries[3]).toContain('p."statusAtual"');
    expect(queries[3]).toContain('r.estado');
    expect(queries[3]).toContain('r."momentoExpiracaoValidade"');
    expect(stockUpdate).toHaveBeenNthCalledWith(1, { where: {
      produtoId: x, quantidadeReservada: { gte: 5 } },
      data: { quantidadeReservada: { decrement: 5 } } });
    expect(reserveUpdate).toHaveBeenCalledTimes(2);
    expect(reserveUpdate).toHaveBeenCalledWith({ where: { id: a, estado: 'ATIVA' },
      data: { estado: 'EXPIRADA_LIBERADA' } });
  });

  it('agrega reservas do mesmo produto e ignora candidato que perdeu elegibilidade', async () => {
    findMany.mockResolvedValue([{ id: a, produtoId: x }, { id: b, produtoId: x }]);
    txRaw.mockReset().mockResolvedValueOnce([{ produtoId: x }]).mockResolvedValueOnce([{ agora: now }])
      .mockResolvedValueOnce([{ id: a, produtoId: x, quantidade: 5 }])
      .mockResolvedValueOnce([{ id: b, produtoId: x, quantidade: 3 }]);
    expect(await service.executar()).toBe(2);
    expect(stockUpdate).toHaveBeenCalledWith({ where: { produtoId: x,
      quantidadeReservada: { gte: 8 } }, data: { quantidadeReservada: { decrement: 8 } } });
    txRaw.mockReset().mockResolvedValueOnce([{ produtoId: x }]).mockResolvedValueOnce([{ agora: now }])
      .mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    expect(await service.executar()).toBe(0);
    expect(stockUpdate).toHaveBeenCalledTimes(1);
  });

  it('não abre transação quando não há reserva elegível', async () => {
    findMany.mockResolvedValue([]);
    expect(await service.executar()).toBe(0);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('propaga saldo insuficiente e falha após atualização de estoque', async () => {
    stockUpdate.mockResolvedValueOnce({ count: 0 });
    await expect(service.executar()).rejects.toThrow('Saldo reservado insuficiente');
    expect(reserveUpdate).not.toHaveBeenCalled();
    reserveUpdate.mockRejectedValueOnce(new Error('falha SQL'));
    await expect(service.executar()).rejects.toThrow('falha SQL');
    expect(stockUpdate).toHaveBeenCalledTimes(2);
  });
});
