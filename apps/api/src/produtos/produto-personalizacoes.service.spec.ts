import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProdutoPersonalizacoesService } from './produto-personalizacoes.service';

const produtoId = '11111111-1111-4111-8111-111111111111';
const personalizacaoId = '22222222-2222-4222-8222-222222222222';
const row = { id: personalizacaoId, nome: 'Cobertura', descricao: null,
  disponibilidade: true, ajusteValor: new Prisma.Decimal('12.5') };
const error = (code: string) => new Prisma.PrismaClientKnownRequestError(code,
  { code, clientVersion: '7.10.0' });

describe('ProdutoPersonalizacoesService', () => {
  const produtoFind = jest.fn();
  const personalizacaoFind = jest.fn();
  const findMany = jest.fn();
  const linkFind = jest.fn();
  const create = jest.fn();
  const remove = jest.fn();
  const service = new ProdutoPersonalizacoesService({
    produto: { findUnique: produtoFind },
    personalizacao: { findUnique: personalizacaoFind, findMany },
    produtoPersonalizacao: { findUnique: linkFind, create, delete: remove },
  } as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    produtoFind.mockResolvedValue({ id: produtoId });
    personalizacaoFind.mockResolvedValue({ id: personalizacaoId });
    findMany.mockResolvedValue([row]);
    linkFind.mockResolvedValue(null);
    create.mockResolvedValue({ produtoId });
    remove.mockResolvedValue({ produtoId });
  });

  it('lista vazio e seleciona somente vinculadas em ordem estável', async () => {
    await expect(service.list(produtoId)).resolves.toEqual([{
      id: personalizacaoId, nome: 'Cobertura', descricao: null,
      disponibilidade: true, ajusteValor: '12.50',
    }]);
    expect(findMany).toHaveBeenCalledWith({
      where: { produtos: { some: { produtoId } } },
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
      select: { id: true, nome: true, descricao: true, disponibilidade: true, ajusteValor: true },
    });
    findMany.mockResolvedValueOnce([]);
    await expect(service.list(produtoId)).resolves.toEqual([]);
  });

  it('serializa Decimal negativo e null sem acrescentar campos', async () => {
    findMany.mockResolvedValue([{ ...row, ajusteValor: new Prisma.Decimal('-0.05') },
      { ...row, ajusteValor: null, disponibilidade: false }]);
    const result = await service.list(produtoId);
    expect(result.map((item) => item.ajusteValor)).toEqual(['-0.05', null]);
    expect(Object.keys(result[0])).toEqual(['id', 'nome', 'descricao', 'disponibilidade', 'ajusteValor']);
  });

  it('retorna 404 se Produto inexiste em cada operação', async () => {
    produtoFind.mockResolvedValue(null);
    await expect(service.list(produtoId)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.create(produtoId, personalizacaoId)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(produtoId, personalizacaoId)).rejects.toBeInstanceOf(NotFoundException);
    expect(findMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('vincula inclusive personalização indisponível sem criá-la', async () => {
    await expect(service.create(produtoId, personalizacaoId)).resolves.toEqual({
      produtoId, personalizacaoId,
    });
    personalizacaoFind.mockResolvedValue({ id: personalizacaoId, disponibilidade: false });
    await expect(service.create(produtoId, personalizacaoId)).resolves.toEqual({
      produtoId, personalizacaoId,
    });
    expect(create).toHaveBeenCalledWith({
      data: { produtoId, personalizacaoId }, select: { produtoId: true },
    });
  });

  it('retorna 404 para Personalizacao inexistente', async () => {
    personalizacaoFind.mockResolvedValue(null);
    await expect(service.create(produtoId, personalizacaoId)).rejects.toBeInstanceOf(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });

  it('retorna 409 para vínculo existente e P2002 concorrente', async () => {
    linkFind.mockResolvedValueOnce({ produtoId });
    await expect(service.create(produtoId, personalizacaoId)).rejects.toBeInstanceOf(ConflictException);
    create.mockRejectedValueOnce(error('P2002'));
    await expect(service.create(produtoId, personalizacaoId)).rejects.toBeInstanceOf(ConflictException);
  });

  it('traduz FK concorrente conforme entidade removida', async () => {
    create.mockRejectedValue(error('P2003'));
    produtoFind.mockResolvedValueOnce({ id: produtoId }).mockResolvedValueOnce(null);
    await expect(service.create(produtoId, personalizacaoId)).rejects.toThrow('Produto não encontrado.');
    produtoFind.mockResolvedValue({ id: produtoId });
    personalizacaoFind.mockResolvedValueOnce({ id: personalizacaoId }).mockResolvedValueOnce(null);
    await expect(service.create(produtoId, personalizacaoId))
      .rejects.toThrow('Personalização não encontrada.');
    personalizacaoFind.mockResolvedValue({ id: personalizacaoId });
    await expect(service.create(produtoId, personalizacaoId)).rejects.toBeInstanceOf(ConflictException);
  });

  it('remove somente a associação e retorna 404 se vínculo inexiste', async () => {
    await expect(service.remove(produtoId, personalizacaoId)).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith({
      where: { produtoId_personalizacaoId: { produtoId, personalizacaoId } },
      select: { produtoId: true },
    });
    remove.mockRejectedValueOnce(error('P2025'));
    await expect(service.remove(produtoId, personalizacaoId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('propaga erros inesperados', async () => {
    const failure = new Error('falha inesperada');
    findMany.mockRejectedValueOnce(failure);
    await expect(service.list(produtoId)).rejects.toBe(failure);
    create.mockRejectedValueOnce(failure);
    await expect(service.create(produtoId, personalizacaoId)).rejects.toBe(failure);
    remove.mockRejectedValueOnce(failure);
    await expect(service.remove(produtoId, personalizacaoId)).rejects.toBe(failure);
  });
});
