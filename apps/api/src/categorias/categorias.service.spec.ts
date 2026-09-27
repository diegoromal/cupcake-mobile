import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriasService } from './categorias.service';

describe('CategoriasService', () => {
  const categoria = { id: '11111111-1111-4111-8111-111111111111', nome: 'Doces', descricao: null };
  const create = jest.fn();
  const findMany = jest.fn();
  const findUnique = jest.fn();
  const update = jest.fn();
  const remove = jest.fn();
  const service = new CategoriasService({ categoria: {
    create, findMany, findUnique, update, delete: remove,
  } } as unknown as PrismaService);

  const prismaError = (code: string) => new Prisma.PrismaClientKnownRequestError(code, {
    code, clientVersion: '7.10.0',
  });

  beforeEach(() => jest.clearAllMocks());

  it('cria e aceita nomes duplicados', async () => {
    create.mockResolvedValue(categoria);
    await expect(service.create({ nome: 'Doces', descricao: null })).resolves.toEqual(categoria);
    await expect(service.create({ nome: 'Doces', descricao: null })).resolves.toEqual(categoria);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0]).toEqual({
      data: { nome: 'Doces', descricao: null },
      select: { id: true, nome: true, descricao: true },
    });
  });

  it('lista com ordenação estável', async () => {
    findMany.mockResolvedValue([categoria]);
    await expect(service.list()).resolves.toEqual([categoria]);
    expect(findMany).toHaveBeenCalledWith({
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
      select: { id: true, nome: true, descricao: true },
    });
  });

  it('consulta e retorna 404 se inexistente', async () => {
    findUnique.mockResolvedValueOnce(categoria).mockResolvedValueOnce(null);
    await expect(service.findById(categoria.id)).resolves.toEqual(categoria);
    await expect(service.findById(categoria.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('atualiza parcialmente e retorna 404 se inexistente', async () => {
    update.mockResolvedValueOnce(categoria).mockRejectedValueOnce(prismaError('P2025'));
    await expect(service.update(categoria.id, { descricao: null })).resolves.toEqual(categoria);
    expect(update).toHaveBeenCalledWith({
      where: { id: categoria.id }, data: { descricao: null },
      select: { id: true, nome: true, descricao: true },
    });
    await expect(service.update(categoria.id, { nome: 'Novo' }))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('exclui e converte inexistência e FK em erros de negócio', async () => {
    remove.mockResolvedValueOnce({ id: categoria.id })
      .mockRejectedValueOnce(prismaError('P2025'))
      .mockRejectedValueOnce(prismaError('P2003'));
    await expect(service.remove(categoria.id)).resolves.toBeUndefined();
    await expect(service.remove(categoria.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(categoria.id)).rejects.toBeInstanceOf(ConflictException);
  });

  it('propaga erros inesperados', async () => {
    const failure = new Error('database unavailable');
    remove.mockRejectedValueOnce(failure);
    update.mockRejectedValueOnce(failure);
    await expect(service.remove(categoria.id)).rejects.toBe(failure);
    await expect(service.update(categoria.id, { nome: 'Novo' })).rejects.toBe(failure);
  });
});
