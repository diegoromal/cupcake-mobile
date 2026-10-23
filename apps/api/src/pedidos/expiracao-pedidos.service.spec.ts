import { ExpiracaoPedidosService } from './expiracao-pedidos.service';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const now = new Date('2026-10-22T12:00:00.000Z');

describe('ExpiracaoPedidosService', () => {
  const findMany = jest.fn();
  const findUnique = jest.fn();
  const updateMany = jest.fn();
  const db = { pedido: { findUnique, updateMany } };
  const transaction = jest.fn(async (callback: (tx: typeof db) => Promise<number>) => callback(db));
  const clock = jest.fn();
  const service = new ExpiracaoPedidosService({ pedido: { findMany }, $transaction: transaction,
    $queryRaw: clock } as never);
  beforeEach(() => {
    jest.clearAllMocks();
    clock.mockResolvedValue([{ agora: now }]);
    findMany.mockResolvedValue([{ id }]);
    findUnique.mockResolvedValue({ data: new Date('2026-10-22T11:45:00.000Z'), statusAtual: 'PENDENTE_PAGAMENTO' });
    updateMany.mockResolvedValue({ count: 1 });
  });

  it('usa fronteira inclusiva, revalida dentro da transação e troca uma vez', async () => {
    expect(await service.executar()).toBe(1);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50,
      where: { statusAtual: 'PENDENTE_PAGAMENTO', data: { lte: new Date('2026-10-22T11:45:00.000Z') } } }));
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({ where: { id, statusAtual: 'PENDENTE_PAGAMENTO',
      data: { lte: new Date('2026-10-22T11:45:00.000Z') } }, data: { statusAtual: 'EXPIRADO' } });
    findUnique.mockResolvedValue({ data: new Date('2026-10-22T11:45:00.000Z'), statusAtual: 'EXPIRADO' });
    expect(await service.executar()).toBe(0);
    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it('preserva pagamento, estado posterior e prazo válido após revalidação', async () => {
    for (const value of [
      { data: new Date('2026-10-22T11:45:01.000Z'), statusAtual: 'PENDENTE_PAGAMENTO' },
      { data: new Date('2026-10-22T11:30:00.000Z'), statusAtual: 'PAGO' },
      { data: new Date('2026-10-22T11:30:00.000Z'), statusAtual: 'EM_PREPARO' },
    ]) {
      findUnique.mockResolvedValueOnce(value);
      expect(await service.executar()).toBe(0);
    }
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('propaga falha, libera execução e não altera reservas ou estoque', async () => {
    updateMany.mockRejectedValueOnce(new Error('falha de banco'));
    await expect(service.executar()).rejects.toThrow('falha de banco');
    expect(await service.executar()).toBe(1);
    expect(Object.keys(db)).toEqual(['pedido']);
  });
  it('usa o mesmo instante do PostgreSQL mesmo com relógio da API adiantado', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2027-01-01T00:00:00Z'));
    try {
      expect(await service.executar()).toBe(1);
      expect(clock).toHaveBeenCalledTimes(1);
      expect(findMany.mock.calls[0][0].where.data.lte).toEqual(
        new Date('2026-10-22T11:45:00.000Z'));
      expect(updateMany.mock.calls[0][0].where.data.lte).toEqual(
        findMany.mock.calls[0][0].where.data.lte);
    } finally { jest.useRealTimers(); }
  });
});
