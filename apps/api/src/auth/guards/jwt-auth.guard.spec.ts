import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PerfilUsuario } from '../../generated/prisma/enums';
import { UsersService } from '../../users/users.service';
import { AuthConfig } from '../auth.config';
import { AuthenticatedRequest } from '../authenticated-user';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const id = '9b72c770-bc74-4c77-82c7-205c2d91628a';
  const jwt = new JwtService();
  const findById = jest.fn();
  const users = { findById } as unknown as UsersService;
  const config = {
    accessSecret: 'test-only-access-secret',
    refreshSecret: 'test-only-refresh-secret',
  } as AuthConfig;
  const guard = new JwtAuthGuard(jwt, config, users);

  beforeEach(() => {
    findById.mockReset();
    findById.mockResolvedValue({ id, perfil: PerfilUsuario.CLIENTE });
  });

  function context(authorization?: string | string[], rawHeaders?: string[]) {
    const request: AuthenticatedRequest = {
      headers: { authorization },
      rawHeaders,
    };
    const execution = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;
    return { request, execution };
  }

  function sign(
    claims: Record<string, unknown> = {
      sub: id,
      perfil: PerfilUsuario.CLIENTE,
      type: 'access',
    },
    options: { secret?: string; algorithm?: 'HS256' | 'HS384'; expiresIn?: string } = {},
  ) {
    return jwt.signAsync(claims, {
      secret: options.secret ?? config.accessSecret,
      algorithm: options.algorithm ?? 'HS256',
      expiresIn: (options.expiresIn ?? '15m') as '15m',
    });
  }

  it.each(Object.values(PerfilUsuario))(
    'autentica access válido de %s com usuário mínimo',
    async (perfil) => {
      findById.mockResolvedValue({ id, perfil, email: 'nao-incluir@example.com' });
      const token = await sign({ sub: id, perfil, type: 'access' });
      const { request, execution } = context(`Bearer ${token}`);
      await expect(guard.canActivate(execution)).resolves.toBe(true);
      expect(findById).toHaveBeenCalledWith(id);
      expect(request.user).toEqual({ id, perfil });
      expect(Object.keys(request.user ?? {}).sort()).toEqual(['id', 'perfil']);
    },
  );

  it('ignora valor Authorization de outro header', async () => {
    const token = await sign();
    const authorization = `Bearer ${token}`;
    const { request, execution } = context(authorization, [
      'Authorization',
      authorization,
      'X-Test',
      'Authorization',
    ]);

    await expect(guard.canActivate(execution)).resolves.toBe(true);
    expect(request.user).toEqual({ id, perfil: PerfilUsuario.CLIENTE });
  });

  it('rejeita dois headers Authorization reais mesmo com token válido', async () => {
    const token = await sign();
    const authorization = `Bearer ${token}`;
    const { execution } = context(authorization, [
      'Authorization',
      authorization,
      'authorization',
      authorization,
    ]);

    await expect(guard.canActivate(execution)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(findById).not.toHaveBeenCalled();
  });

  it.each([
    ['ausente', undefined, undefined],
    ['esquema incorreto', 'Basic abc', undefined],
    ['sem token', 'Bearer ', undefined],
    ['espaços extras', 'Bearer  abc.def.ghi', undefined],
    ['token malformado', 'Bearer abc', undefined],
    ['dois tokens', 'Bearer abc.def.ghi, xyz.def.ghi', undefined],
    ['valores múltiplos', ['Bearer abc.def.ghi', 'Bearer xyz.def.ghi'], undefined],
    [
      'headers duplicados',
      'Bearer abc.def.ghi',
      ['Authorization', 'Bearer abc.def.ghi', 'authorization', 'Bearer xyz.def.ghi'],
    ],
  ])('rejeita Authorization %s', async (_name, authorization, rawHeaders) => {
    const { execution } = context(authorization, rawHeaders);
    await expect(guard.canActivate(execution)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(findById).not.toHaveBeenCalled();
  });

  it.each([
    ['inválido', async () => 'a.b.c'],
    ['assinatura errada', () => sign(undefined, { secret: 'wrong-secret' })],
    ['expirado', () => sign(undefined, { expiresIn: '-1s' })],
    ['HS384', () => sign(undefined, { algorithm: 'HS384' })],
    [
      'refresh',
      () =>
        sign({ sub: id, perfil: PerfilUsuario.CLIENTE, type: 'refresh' }, {
          secret: config.refreshSecret,
        }),
    ],
    ['type incorreto', () => sign({ sub: id, perfil: 'CLIENTE', type: 'other' })],
    ['type ausente', () => sign({ sub: id, perfil: 'CLIENTE' })],
    ['sub ausente', () => sign({ perfil: 'CLIENTE', type: 'access' })],
    ['sub inválido', () => sign({ sub: 'invalido', perfil: 'CLIENTE', type: 'access' })],
    ['perfil inválido', () => sign({ sub: id, perfil: 'GERENTE', type: 'access' })],
    ['perfil ausente', () => sign({ sub: id, type: 'access' })],
  ])('rejeita token %s', async (_name, createToken) => {
    const { execution } = context(`Bearer ${await createToken()}`);
    await expect(guard.canActivate(execution)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(findById).not.toHaveBeenCalled();
  });

  it('rejeita access sem expiração', async () => {
    const token = await jwt.signAsync(
      { sub: id, perfil: PerfilUsuario.CLIENTE, type: 'access' },
      { secret: config.accessSecret, algorithm: 'HS256' },
    );
    await expect(
      guard.canActivate(context(`Bearer ${token}`).execution),
    ).rejects.toThrow(UnauthorizedException);
    expect(findById).not.toHaveBeenCalled();
  });

  it('rejeita usuário removido ou perfil alterado', async () => {
    const token = await sign();
    findById.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id,
      perfil: PerfilUsuario.ADMIN,
    });
    await expect(
      guard.canActivate(context(`Bearer ${token}`).execution),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      guard.canActivate(context(`Bearer ${token}`).execution),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('propaga falha operacional de banco', async () => {
    const failure = new Error('banco indisponível');
    findById.mockRejectedValue(failure);
    const token = await sign();
    await expect(guard.canActivate(context(`Bearer ${token}`).execution)).rejects.toBe(
      failure,
    );
  });
});
