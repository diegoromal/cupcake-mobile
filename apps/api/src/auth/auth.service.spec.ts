import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PerfilUsuario } from '../generated/prisma/enums';
import { UsersService } from '../users/users.service';
import { AuthConfig, JWT_ALGORITHM } from './auth.config';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const id = '9b72c770-bc74-4c77-82c7-205c2d91628a';
  const senha = ' senha123 ';
  const findAuthenticationUserByEmail = jest.fn();
  const findById = jest.fn();
  const registerInvalidLogin = jest.fn();
  const clearLoginState = jest.fn();
  const users = {
    findAuthenticationUserByEmail,
    findById,
    registerInvalidLogin,
    clearLoginState,
  } as unknown as UsersService;
  const jwt = new JwtService();
  let config: AuthConfig;
  let service: AuthService;
  let hash: string;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-only-unit-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-only-unit-refresh-secret';
    config = new AuthConfig();
    service = new AuthService(users, jwt, config);
    hash = await argon2.hash(senha, { type: argon2.argon2id });
  });

  beforeEach(() => {
    findAuthenticationUserByEmail.mockReset();
    findById.mockReset();
    registerInvalidLogin.mockReset();
    clearLoginState.mockReset().mockResolvedValue(true);
    findAuthenticationUserByEmail.mockResolvedValue({
      id,
      perfil: PerfilUsuario.CLIENTE,
      credencialSenha: hash,
      tentativasLoginInvalidas: 0,
      bloqueadoAte: null,
    });
    findById.mockResolvedValue({ id, perfil: PerfilUsuario.CLIENTE });
  });

  const loginInput = { email: '  ANA@EXAMPLE.COM  ', senha };

  async function signRefresh(claims: Record<string, unknown>, expiresIn = '7d') {
    return jwt.signAsync(claims, {
      secret: config.refreshSecret,
      algorithm: JWT_ALGORITHM,
      expiresIn: expiresIn as '7d',
    });
  }

  it('normaliza email, preserva a senha e emite apenas dois JWTs com claims mínimas', async () => {
    const tokens = await service.login(loginInput);

    expect(findAuthenticationUserByEmail).toHaveBeenCalledWith('ana@example.com');
    expect(Object.keys(tokens).sort()).toEqual(['accessToken', 'refreshToken']);
    const access = await jwt.verifyAsync<Record<string, unknown>>(
      tokens.accessToken,
      { secret: config.accessSecret, algorithms: [JWT_ALGORITHM] },
    );
    const refresh = await jwt.verifyAsync<Record<string, unknown>>(
      tokens.refreshToken,
      { secret: config.refreshSecret, algorithms: [JWT_ALGORITHM] },
    );
    expect(access).toMatchObject({ sub: id, perfil: 'CLIENTE', type: 'access' });
    expect(refresh).toMatchObject({ sub: id, perfil: 'CLIENTE', type: 'refresh' });
    expect(Object.keys(access).sort()).toEqual(['exp', 'iat', 'perfil', 'sub', 'type']);
    expect(Object.keys(refresh).sort()).toEqual(['exp', 'iat', 'perfil', 'sub', 'type']);
    expect((access.exp as number) - (access.iat as number)).toBe(15 * 60);
    expect((refresh.exp as number) - (refresh.iat as number)).toBe(7 * 24 * 60 * 60);
    expect(tokens).not.toHaveProperty('credencialSenha');
  });

  it('não altera espaços da senha antes de verificar Argon2id', async () => {
    await expect(service.login({ ...loginInput, senha: senha.trim() })).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.login(loginInput)).resolves.toHaveProperty('accessToken');
  });

  it.each([
    ['usuário ausente', null],
    ['ADMIN', PerfilUsuario.ADMIN],
    ['ENTREGADOR', PerfilUsuario.ENTREGADOR],
  ])('retorna 401 genérico para %s', async (_name, perfil) => {
    findAuthenticationUserByEmail.mockResolvedValue(
      perfil === null ? null : { id, perfil, credencialSenha: hash },
    );
    await expect(service.login(loginInput)).rejects.toThrow('Credenciais inválidas.');
  });

  it('retorna o mesmo 401 para senha incorreta', async () => {
    await expect(
      service.login({ ...loginInput, senha: 'senha-incorreta' }),
    ).rejects.toThrow('Credenciais inválidas.');
    expect(registerInvalidLogin).toHaveBeenCalledTimes(1);
  });

  it('rejeita conta bloqueada antes do Argon2 e sem alterar prazo ou contador', async () => {
    const bloqueadoAte = new Date(Date.now() + 60_000);
    findAuthenticationUserByEmail.mockResolvedValue({
      id, perfil: PerfilUsuario.CLIENTE, credencialSenha: 'hash-inválido',
      tentativasLoginInvalidas: 5, bloqueadoAte,
    });
    await expect(service.login(loginInput)).rejects.toThrow('Credenciais inválidas.');
    expect(registerInvalidLogin).not.toHaveBeenCalled();
    expect(clearLoginState).not.toHaveBeenCalled();
  });

  it('limpa estado antes de emitir tokens e rejeita bloqueio concorrente', async () => {
    clearLoginState.mockResolvedValueOnce(false);
    await expect(service.login(loginInput)).rejects.toThrow('Credenciais inválidas.');
    expect(clearLoginState).toHaveBeenCalledTimes(1);
  });

  it('propaga falhas de persistência no incremento e no reset', async () => {
    const error = new Error('falha de banco');
    registerInvalidLogin.mockRejectedValueOnce(error);
    await expect(service.login({ ...loginInput, senha: 'errada' })).rejects.toBe(error);
    clearLoginState.mockRejectedValueOnce(error);
    await expect(service.login(loginInput)).rejects.toBe(error);
  });

  it('refresh válido emite somente novo access', async () => {
    const { refreshToken } = await service.login(loginInput);
    const result = await service.refresh(refreshToken);
    expect(Object.keys(result)).toEqual(['accessToken']);
    expect(findById).toHaveBeenCalledWith(id);
    await expect(
      jwt.verifyAsync(result.accessToken, {
        secret: config.accessSecret,
        algorithms: [JWT_ALGORITHM],
      }),
    ).resolves.toMatchObject({ sub: id, perfil: 'CLIENTE', type: 'access' });
  });

  it('rejeita access usado como refresh e assinatura inválida', async () => {
    const { accessToken } = await service.login(loginInput);
    const wrongSignature = await jwt.signAsync(
      { sub: id, perfil: 'CLIENTE', type: 'refresh' },
      { secret: 'outro-segredo', algorithm: JWT_ALGORITHM, expiresIn: '7d' },
    );
    await expect(service.refresh(accessToken)).rejects.toThrow(UnauthorizedException);
    await expect(service.refresh(wrongSignature)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it.each([
    ['expirado', { sub: id, perfil: 'CLIENTE', type: 'refresh' }, '-1s'],
    ['tipo incorreto', { sub: id, perfil: 'CLIENTE', type: 'access' }, '7d'],
    ['sub ausente', { perfil: 'CLIENTE', type: 'refresh' }, '7d'],
    ['sub inválido', { sub: 'invalido', perfil: 'CLIENTE', type: 'refresh' }, '7d'],
    ['perfil inválido', { sub: id, perfil: 'ADMIN', type: 'refresh' }, '7d'],
  ])('rejeita refresh %s', async (_name, claims, ttl) => {
    const token = await signRefresh(claims, ttl);
    await expect(service.refresh(token)).rejects.toThrow(UnauthorizedException);
  });

  it('rejeita refresh sem expiração', async () => {
    const token = await jwt.signAsync(
      { sub: id, perfil: 'CLIENTE', type: 'refresh' },
      { secret: config.refreshSecret, algorithm: JWT_ALGORITHM },
    );
    await expect(service.refresh(token)).rejects.toThrow(UnauthorizedException);
  });

  it('rejeita segredos ausentes ou iguais na configuração', () => {
    const access = process.env.JWT_ACCESS_SECRET;
    const refresh = process.env.JWT_REFRESH_SECRET;
    try {
      process.env.JWT_ACCESS_SECRET = '';
      expect(() => new AuthConfig()).toThrow('JWT_ACCESS_SECRET');
      process.env.JWT_ACCESS_SECRET = access;
      process.env.JWT_REFRESH_SECRET = '';
      expect(() => new AuthConfig()).toThrow('JWT_REFRESH_SECRET');
      process.env.JWT_REFRESH_SECRET = access;
      expect(() => new AuthConfig()).toThrow('devem ser diferentes');
    } finally {
      process.env.JWT_ACCESS_SECRET = access;
      process.env.JWT_REFRESH_SECRET = refresh;
    }
  });

  it('rejeita refresh de usuário removido ou que deixou de ser CLIENTE', async () => {
    const token = await signRefresh({ sub: id, perfil: 'CLIENTE', type: 'refresh' });
    findById.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id,
      perfil: PerfilUsuario.ADMIN,
    });
    await expect(service.refresh(token)).rejects.toThrow(UnauthorizedException);
    await expect(service.refresh(token)).rejects.toThrow(UnauthorizedException);
  });
});
