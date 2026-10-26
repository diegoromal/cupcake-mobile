import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { StatusPedido } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { RelatoriosService } from './relatorios.service';

const pedido = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'id-1', identificadorNegocio: 'PED-1', data: new Date('2026-10-02T12:30:00.000Z'),
  modalidade: 'ENTREGA', statusAtual: StatusPedido.ENTREGUE, total: new Prisma.Decimal('12.34'),
  cliente: { nome: 'Ana' }, ...overrides,
});

describe('RelatoriosService', () => {
  const findMany = jest.fn();
  const service = new RelatoriosService({ pedido: { findMany } } as unknown as PrismaService);

  beforeEach(() => findMany.mockReset());

  it('filtra os dois estados finalizados no período e calcula total exato e quantidade da mesma lista', async () => {
    findMany.mockResolvedValue([
      pedido(),
      pedido({ id: 'id-2', identificadorNegocio: 'PED-2', modalidade: 'RETIRADA', statusAtual: StatusPedido.RETIRADO, total: new Prisma.Decimal('0.01') }),
    ]);

    const result = await service.vendas({ inicio: '2026-10-01', fim: '2026-10-03' });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        statusAtual: { in: [StatusPedido.ENTREGUE, StatusPedido.RETIRADO] },
        data: { gte: new Date('2026-10-01T03:00:00.000Z'), lt: new Date('2026-10-04T03:00:00.000Z') },
      },
      orderBy: [{ data: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        identificadorNegocio: true,
        data: true,
        modalidade: true,
        statusAtual: true,
        total: true,
        cliente: { select: { nome: true } },
      },
    }));
    expect(result.totalVendido).toBe('12.35');
    expect(result.quantidadePedidos).toBe(2);
    expect(result.pedidos.map(({ statusAtual }) => statusAtual)).toEqual([StatusPedido.ENTREGUE, StatusPedido.RETIRADO]);
  });


  it('converte o calendário local de São Paulo para limites UTC, inclusive em datas com offset IANA histórico', async () => {
    findMany.mockResolvedValue([]);

    await service.vendas({ inicio: '2018-12-15', fim: '2018-12-15' });

    expect(findMany.mock.calls[0][0].where.data).toEqual({
      gte: new Date('2018-12-15T02:00:00.000Z'),
      lt: new Date('2018-12-16T02:00:00.000Z'),
    });
  });

  it('usa o primeiro horário válido quando a meia-noite local não existe na transição IANA', async () => {
    findMany.mockResolvedValue([]);

    await service.vendas({ inicio: '2018-11-04', fim: '2018-11-04' });

    expect(findMany.mock.calls[0][0].where.data).toEqual({
      gte: new Date('2018-11-04T03:00:00.000Z'),
      lt: new Date('2018-11-05T02:00:00.000Z'),
    });
  });

  it('representa período sem pedidos com total e quantidade zerados', async () => {
    findMany.mockResolvedValue([]);

    await expect(service.vendas({ inicio: '2026-10-01', fim: '2026-10-01' })).resolves.toMatchObject({
      totalVendido: '0.00', quantidadePedidos: 0, pedidos: [],
    });
  });

  it('rejeita período invertido antes de consultar o banco', async () => {
    await expect(service.vendas({ inicio: '2026-10-02', fim: '2026-10-01' })).rejects.toBeInstanceOf(BadRequestException);
    expect(findMany).not.toHaveBeenCalled();
  });
});
