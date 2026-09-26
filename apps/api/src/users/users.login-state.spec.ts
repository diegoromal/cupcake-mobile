import { ServiceUnavailableException } from '@nestjs/common';
import { PerfilUsuario } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService: estado do login', () => {
  const id = '9b72c770-bc74-4c77-82c7-205c2d91628a';
  const now = new Date('2026-09-26T18:00:00.000Z');
  const findUnique = jest.fn();
  const updateMany = jest.fn();
  const service = new UsersService({ usuario: { findUnique, updateMany } } as unknown as PrismaService);
  const state = (tentativasLoginInvalidas = 0, bloqueadoAte: Date | null = null) => ({
    id, perfil: PerfilUsuario.CLIENTE, tentativasLoginInvalidas, bloqueadoAte,
  });

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    findUnique.mockReset();
    updateMany.mockReset().mockResolvedValue({ count: 1 });
  });

  afterEach(() => jest.useRealTimers());

  it.each([0, 1, 2, 3])('incrementa atomicamente a falha após %i tentativas', async (count) => {
    await service.registerInvalidLogin(state(count));
    expect(updateMany).toHaveBeenCalledWith({
      where: { id, perfil: PerfilUsuario.CLIENTE, tentativasLoginInvalidas: count, bloqueadoAte: null },
      data: { tentativasLoginInvalidas: { increment: 1 }, bloqueadoAte: null },
    });
  });

  it('a quinta falha grava prazo de 15 minutos', async () => {
    await service.registerInvalidLogin(state(4));
    expect(updateMany).toHaveBeenCalledWith({
      where: { id, perfil: PerfilUsuario.CLIENTE, tentativasLoginInvalidas: 4, bloqueadoAte: null },
      data: { tentativasLoginInvalidas: 5, bloqueadoAte: new Date(now.getTime() + 900_000) },
    });
  });

  it('não grava durante bloqueio, inclusive no instante anterior à expiração', async () => {
    await service.registerInvalidLogin(state(5, new Date(now.getTime() + 1)));
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('na expiração, nova falha inicia o contador em 1', async () => {
    await service.registerInvalidLogin(state(5, now));
    expect(updateMany).toHaveBeenCalledWith({
      where: { id, perfil: PerfilUsuario.CLIENTE, tentativasLoginInvalidas: 5, bloqueadoAte: now },
      data: { tentativasLoginInvalidas: 1, bloqueadoAte: null },
    });
  });

  it('sucesso limpa contador e prazo, inclusive após expiração', async () => {
    await expect(service.clearLoginState(state(3))).resolves.toBe(true);
    await expect(service.clearLoginState(state(5, now))).resolves.toBe(true);
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: { id, perfil: PerfilUsuario.CLIENTE, tentativasLoginInvalidas: 5, bloqueadoAte: now },
      data: { tentativasLoginInvalidas: 0, bloqueadoAte: null },
    });
  });

  it('releitura após conflito impede sucesso de apagar bloqueio concorrente', async () => {
    updateMany.mockResolvedValueOnce({ count: 0 });
    findUnique.mockResolvedValueOnce(state(5, new Date(now.getTime() + 900_000)));
    await expect(service.clearLoginState(state(4))).resolves.toBe(false);
    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it('releitura após conflito preserva ambas as falhas', async () => {
    updateMany.mockResolvedValueOnce({ count: 0 });
    findUnique.mockResolvedValueOnce(state(4));
    await service.registerInvalidLogin(state(3));
    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(updateMany.mock.calls[1][0]).toMatchObject({
      where: { tentativasLoginInvalidas: 4 },
      data: { tentativasLoginInvalidas: 5 },
    });
  });

  it('não emite sucesso após usuário removido e propaga erro Prisma', async () => {
    updateMany.mockResolvedValueOnce({ count: 0 });
    findUnique.mockResolvedValueOnce(null);
    await expect(service.clearLoginState(state())).resolves.toBe(false);
    const error = new Error('erro Prisma');
    updateMany.mockRejectedValueOnce(error);
    await expect(service.registerInvalidLogin(state())).rejects.toBe(error);
  });

  it('encerra conflitos persistentes sem loop infinito', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findUnique.mockResolvedValue(state());
    await expect(service.clearLoginState(state())).rejects.toThrow(ServiceUnavailableException);
    expect(updateMany).toHaveBeenCalledTimes(20);
  });
});
