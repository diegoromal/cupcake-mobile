import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProdutosService } from './produtos.service';

const id = '11111111-1111-4111-8111-111111111111';
const categoriaId = '22222222-2222-4222-8222-222222222222';
const row = { id, categoriaId, nome: 'Bolo', descricao: null, precoAtual: new Prisma.Decimal('1234567890.12'), imagem: null, ativo: true };
const output = { ...row, precoAtual: '1234567890.12' };
const err = (code: string) => new Prisma.PrismaClientKnownRequestError(code, { code, clientVersion: '7.10.0' });

describe('ProdutosService', () => {
  const categoriaFind = jest.fn();
  const create = jest.fn();
  const stockCreate = jest.fn();
  const findMany = jest.fn();
  const findUnique = jest.fn();
  const update = jest.fn();
  const remove = jest.fn();
  const stockDelete = jest.fn();
  const transaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({
    produto: { create, findUnique, delete: remove },
    estoque: { create: stockCreate, deleteMany: stockDelete },
  }));
  const service = new ProdutosService({
    categoria: { findUnique: categoriaFind },
    produto: { findMany, findUnique, update },
    $transaction: transaction,
  } as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    categoriaFind.mockResolvedValue({ id: categoriaId });
    create.mockResolvedValue(row);
    stockCreate.mockResolvedValue({ produtoId: id });
    findUnique.mockResolvedValue(row);
    findMany.mockResolvedValue([row]);
    update.mockResolvedValue(row);
    stockDelete.mockResolvedValue({ count: 1 });
    remove.mockResolvedValue({ id });
  });

  it('cria Produto e Estoque zero em uma transação, com defaults e Decimal exato', async () => {
    await expect(service.create({ categoriaId, nome: 'Bolo', precoAtual: '1234567890.12' }))
      .resolves.toEqual(output);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data).toEqual({
      categoriaId, nome: 'Bolo', descricao: undefined,
      precoAtual: new Prisma.Decimal('1234567890.12'), ativo: undefined,
    });
    expect(create.mock.calls[0][0].data.precoAtual).toBeInstanceOf(Prisma.Decimal);
    expect(stockCreate).toHaveBeenCalledWith({ data: {
      produtoId: id, quantidadeFisica: 0, quantidadeReservada: 0,
    } });
  });

  it('propaga falha no Estoque para rollback da transação', async () => {
    const failure = new Error('stock failed');
    stockCreate.mockRejectedValue(failure);
    await expect(service.create({ categoriaId, nome: 'Bolo', precoAtual: '1.00' })).rejects.toBe(failure);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('lista ordenado, consulta e retorna 404 se inexistente', async () => {
    await expect(service.list()).resolves.toEqual([output]);
    expect(findMany.mock.calls[0][0].orderBy).toEqual([{ nome: 'asc' }, { id: 'asc' }]);
    await expect(service.findById(id)).resolves.toEqual(output);
    findUnique.mockResolvedValue(null);
    await expect(service.findById(id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('atualiza parcialmente, troca categoria, limpa opcionais e permite desativar', async () => {
    await expect(service.update(id, { categoriaId, precoAtual: '0.05', descricao: null,
      ativo: false })).resolves.toEqual(output);
    expect(categoriaFind).toHaveBeenCalledWith({ where: { id: categoriaId }, select: { id: true } });
    expect(update.mock.calls[0][0].data).toEqual({
      categoriaId, nome: undefined, descricao: null, precoAtual: new Prisma.Decimal('0.05'),
      ativo: false,
    });
  });

  it('categoria inexistente ou removida em corrida retorna 404', async () => {
    categoriaFind.mockResolvedValue(null);
    await expect(service.create({ categoriaId, nome: 'Bolo', precoAtual: '1.00' }))
      .rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update(id, { categoriaId })).rejects.toBeInstanceOf(NotFoundException);
    categoriaFind.mockResolvedValue({ id: categoriaId });
    create.mockRejectedValue(err('P2003'));
    update.mockRejectedValue(err('P2003'));
    await expect(service.create({ categoriaId, nome: 'Bolo', precoAtual: '1.00' }))
      .rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update(id, { categoriaId })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('delete livre remove Estoque zero e Produto na mesma transação', async () => {
    await expect(service.remove(id)).resolves.toBeUndefined();
    expect(stockDelete).toHaveBeenCalledWith({ where: {
      produtoId: id, quantidadeFisica: 0, quantidadeReservada: 0,
    } });
    expect(remove).toHaveBeenCalledWith({ where: { id }, select: { id: true } });
  });

  it('delete com estoque não zerado ou vínculos retorna 409', async () => {
    stockDelete.mockResolvedValueOnce({ count: 0 });
    await expect(service.remove(id)).rejects.toBeInstanceOf(ConflictException);
    expect(remove).not.toHaveBeenCalled();
    remove.mockRejectedValue(err('P2003'));
    await expect(service.remove(id)).rejects.toBeInstanceOf(ConflictException);
  });

  it('P2025 vira 404 e erro inesperado propaga', async () => {
    remove.mockRejectedValueOnce(err('P2025')).mockRejectedValueOnce(new Error('unexpected'));
    await expect(service.remove(id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(id)).rejects.toThrow('unexpected');
    update.mockRejectedValueOnce(err('P2025'));
    await expect(service.update(id, { nome: 'Novo' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
