import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EstoqueService } from './estoque.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EstoqueService', () => {
  const produtoId = '11111111-1111-4111-8111-111111111111';
  const saldo = { produtoId, quantidadeFisica: 8, quantidadeReservada: 3 };
  const findUnique = jest.fn();
  const findMany = jest.fn();
  const queryRaw = jest.fn();
  const update = jest.fn();
  const create = jest.fn();
  const transaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({
    $queryRaw: queryRaw, estoque: { update }, movimentacaoEstoque: { create },
  }));
  const service = new EstoqueService({
    estoque: { findUnique }, movimentacaoEstoque: { findMany }, $transaction: transaction,
  } as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    findUnique.mockResolvedValue(saldo);
    queryRaw.mockResolvedValue([saldo]);
    update.mockImplementation(async ({ data }: { data: { quantidadeFisica: number } }) => ({ ...saldo, ...data }));
    findMany.mockResolvedValue([]);
  });

  it('consulta disponibilidade derivada e distingue produto sem estoque', async () => {
    await expect(service.consultar(produtoId)).resolves.toEqual({ ...saldo, quantidadeDisponivel: 5 });
    findUnique.mockResolvedValueOnce(null);
    await expect(service.consultar(produtoId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('ajusta o físico pelo alvo disponível sem modificar reserva e registra a diferença', async () => {
    await expect(service.ajustar(produtoId, 2)).resolves.toEqual({ ...saldo, quantidadeFisica: 5, quantidadeDisponivel: 2 });
    expect(update).toHaveBeenCalledWith({ where: { produtoId }, data: { quantidadeFisica: 5 } });
    expect(create).toHaveBeenCalledWith({ data: {
      produtoId, quantidade: -3, motivoOrigem: 'AJUSTE_ADMINISTRATIVO', data: expect.any(Date),
    } });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('no-op não grava saldo ou movimentação', async () => {
    await expect(service.ajustar(produtoId, 5)).resolves.toEqual({ ...saldo, quantidadeDisponivel: 5 });
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('rejeita estouro de inteiro e estoque ausente dentro da transação', async () => {
    await expect(service.ajustar(produtoId, 2147483645)).rejects.toBeInstanceOf(BadRequestException);
    queryRaw.mockResolvedValueOnce([]);
    await expect(service.ajustar(produtoId, 1)).rejects.toBeInstanceOf(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });

  it('consulta histórico com ordem estável', async () => {
    await service.historico(produtoId);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { produtoId }, orderBy: [{ data: 'desc' }, { id: 'desc' }],
    }));
  });
});
