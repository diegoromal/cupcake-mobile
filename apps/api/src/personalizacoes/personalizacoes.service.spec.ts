import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PersonalizacoesService } from './personalizacoes.service';

describe('PersonalizacoesService', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const row = { id, nome: 'Cobertura', descricao: null, disponibilidade: true,
    ajusteValor: new Prisma.Decimal('1234567890.12') };
  const create = jest.fn();
  const findMany = jest.fn();
  const findUnique = jest.fn();
  const update = jest.fn();
  const remove = jest.fn();
  const service = new PersonalizacoesService({ personalizacao: {
    create, findMany, findUnique, update, delete: remove,
  } } as unknown as PrismaService);
  const prismaError = (code: string) => new Prisma.PrismaClientKnownRequestError(code, {
    code, clientVersion: '7.10.0',
  });

  beforeEach(() => jest.clearAllMocks());

  it('cria com default true, decimal exato e aceita nomes duplicados', async () => {
    create.mockResolvedValue(row);
    for (let i = 0; i < 2; i++) {
      await expect(service.create({ nome: row.nome, ajusteValor: '1234567890.12' }))
        .resolves.toEqual({ ...row, ajusteValor: '1234567890.12' });
    }
    expect(create).toHaveBeenCalledTimes(2);
    const data = create.mock.calls[0][0].data;
    expect(data.disponibilidade).toBe(true);
    expect(data.ajusteValor).toBeInstanceOf(Prisma.Decimal);
    expect(data.ajusteValor.toFixed(2)).toBe('1234567890.12');
  });

  it('preserva null e valor negativo sem converter para number', async () => {
    create.mockResolvedValueOnce({ ...row, ajusteValor: null })
      .mockResolvedValueOnce({ ...row, ajusteValor: new Prisma.Decimal('-0.05') });
    await expect(service.create({ nome: row.nome, ajusteValor: null }))
      .resolves.toMatchObject({ ajusteValor: null });
    expect(create.mock.calls[0][0].data.ajusteValor).toBeNull();
    await expect(service.create({ nome: row.nome, ajusteValor: '-0.05' }))
      .resolves.toMatchObject({ ajusteValor: '-0.05' });
    expect(create.mock.calls[1][0].data.ajusteValor.toFixed(2)).toBe('-0.05');
  });

  it('lista por nome e id, com decimal formatado', async () => {
    findMany.mockResolvedValue([row, { ...row, ajusteValor: null }]);
    await expect(service.list()).resolves.toEqual([
      { ...row, ajusteValor: '1234567890.12' }, { ...row, ajusteValor: null },
    ]);
    expect(findMany.mock.calls[0][0].orderBy)
      .toEqual([{ nome: 'asc' }, { id: 'asc' }]);
  });

  it('consulta por id e retorna 404 quando não existe', async () => {
    findUnique.mockResolvedValueOnce(row).mockResolvedValueOnce(null);
    await expect(service.findById(id)).resolves.toMatchObject({ ajusteValor: '1234567890.12' });
    await expect(service.findById(id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('atualiza parcialmente, limpa decimal e retorna 404', async () => {
    update.mockResolvedValueOnce({ ...row, ajusteValor: new Prisma.Decimal('-2') })
      .mockResolvedValueOnce({ ...row, ajusteValor: null })
      .mockRejectedValueOnce(prismaError('P2025'));
    await expect(service.update(id, { ajusteValor: '-2' }))
      .resolves.toMatchObject({ ajusteValor: '-2.00' });
    expect(update.mock.calls[0][0].data.ajusteValor).toBeInstanceOf(Prisma.Decimal);
    await expect(service.update(id, { ajusteValor: null }))
      .resolves.toMatchObject({ ajusteValor: null });
    expect(update.mock.calls[1][0].data.ajusteValor).toBeNull();
    await expect(service.update(id, { nome: 'Outro' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('exclui, retorna 404 e converte P2003 em 409', async () => {
    remove.mockResolvedValueOnce({ id }).mockRejectedValueOnce(prismaError('P2025'))
      .mockRejectedValueOnce(prismaError('P2003'));
    await expect(service.remove(id)).resolves.toBeUndefined();
    await expect(service.remove(id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(id)).rejects.toBeInstanceOf(ConflictException);
    expect(remove).toHaveBeenCalledWith({ where: { id }, select: { id: true } });
  });

  it('propaga erros inesperados', async () => {
    const failure = new Error('database unavailable');
    update.mockRejectedValueOnce(failure);
    remove.mockRejectedValueOnce(failure);
    await expect(service.update(id, { nome: 'Outro' })).rejects.toBe(failure);
    await expect(service.remove(id)).rejects.toBe(failure);
  });
});
