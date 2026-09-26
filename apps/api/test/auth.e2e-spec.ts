import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PerfilUsuario } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Autenticação de cliente', () => {
  let app: INestApplication;
  const jwt = new JwtService();
  const findUnique = jest.fn();
  const id = '9b72c770-bc74-4c77-82c7-205c2d91628a';
  const senha = ' senha123 ';
  let hash: string;

  beforeAll(async () => {
    hash = await argon2.hash(senha, { type: argon2.argon2id });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ usuario: { findUnique } })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
  });

  beforeEach(() => {
    findUnique.mockReset();
    findUnique.mockImplementation(async ({ where }) => {
      if (where.email && where.email !== 'ana@example.com') return null;
      return { id, perfil: PerfilUsuario.CLIENTE, credencialSenha: hash };
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const loginBody = { email: '  ANA@EXAMPLE.COM  ', senha };

  async function login() {
    return request(app.getHttpServer()).post('/auth/login').send(loginBody).expect(200);
  }

  async function refreshTokenWith(claims: Record<string, unknown>, expiresIn = '7d') {
    return jwt.signAsync(claims, {
      secret: process.env.JWT_REFRESH_SECRET,
      algorithm: 'HS256',
      expiresIn: expiresIn as '7d',
    });
  }

  it('login retorna apenas JWTs reais com assinatura, claims e TTLs corretos', async () => {
    const response = await login();
    expect(Object.keys(response.body).sort()).toEqual(['accessToken', 'refreshToken']);
    expect(findUnique).toHaveBeenCalledWith({
      where: { email: 'ana@example.com' },
      select: { id: true, perfil: true, credencialSenha: true },
    });

    for (const [type, token, secret, ttl] of [
      ['access', response.body.accessToken, process.env.JWT_ACCESS_SECRET, 900],
      ['refresh', response.body.refreshToken, process.env.JWT_REFRESH_SECRET, 604800],
    ] as const) {
      const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
      expect(header.alg).toBe('HS256');
      const payload = await jwt.verifyAsync<Record<string, unknown>>(token, {
        secret,
        algorithms: ['HS256'],
      });
      expect(payload).toMatchObject({ sub: id, perfil: 'CLIENTE', type });
      expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'perfil', 'sub', 'type']);
      expect((payload.exp as number) - (payload.iat as number)).toBe(ttl);
      expect(JSON.stringify(response.body)).not.toContain(hash);
    }
  });

  it.each([
    ['email inválido', { email: 'invalido', senha }],
    ['email ausente', { senha }],
    ['senha ausente', { email: 'ana@example.com' }],
    ['senha vazia', { email: 'ana@example.com', senha: '' }],
    ['campo extra', { ...loginBody, perfil: 'ADMIN' }],
  ])('login rejeita %s com 400', async (_name, body) => {
    await request(app.getHttpServer()).post('/auth/login').send(body).expect(400);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('login usa 401 genérico para usuário inexistente e senha incorreta', async () => {
    const missing = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ausente@example.com', senha })
      .expect(401);
    const wrong = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ ...loginBody, senha: senha.trim() })
      .expect(401);
    expect(missing.body.message).toBe('Credenciais inválidas.');
    expect(wrong.body.message).toBe(missing.body.message);
    expect(JSON.stringify(wrong.body)).not.toContain(hash);
  });

  it.each([PerfilUsuario.ADMIN, PerfilUsuario.ENTREGADOR])(
    'login rejeita %s com o mesmo 401',
    async (perfil) => {
      findUnique.mockResolvedValue({ id, perfil, credencialSenha: hash });
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginBody)
        .expect(401);
      expect(response.body.message).toBe('Credenciais inválidas.');
    },
  );

  it('refresh válido retorna somente novo access JWT', async () => {
    const { body } = await login();
    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: body.refreshToken })
      .expect(200);
    expect(Object.keys(response.body)).toEqual(['accessToken']);
    expect(findUnique).toHaveBeenLastCalledWith({
      where: { id },
      select: { id: true, perfil: true },
    });
    await expect(
      jwt.verifyAsync(response.body.accessToken, {
        secret: process.env.JWT_ACCESS_SECRET,
        algorithms: ['HS256'],
      }),
    ).resolves.toMatchObject({ sub: id, perfil: 'CLIENTE', type: 'access' });
  });

  it.each([{}, { refreshToken: '' }, { refreshToken: 5 }, { refreshToken: 'x', extra: true }])(
    'refresh rejeita body inválido com 400',
    async (body) => {
      await request(app.getHttpServer()).post('/auth/refresh').send(body).expect(400);
    },
  );

  it('refresh rejeita token inválido e access token com 401', async () => {
    const { body } = await login();
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'token.invalido.aqui' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: body.accessToken })
      .expect(401);
  });

  it.each([
    ['expirado', { sub: id, perfil: 'CLIENTE', type: 'refresh' }, '-1s'],
    ['tipo incorreto', { sub: id, perfil: 'CLIENTE', type: 'access' }, '7d'],
    ['sub ausente', { perfil: 'CLIENTE', type: 'refresh' }, '7d'],
    ['perfil inválido', { sub: id, perfil: 'ADMIN', type: 'refresh' }, '7d'],
  ])('refresh rejeita claims de token %s', async (_name, claims, ttl) => {
    const token = await refreshTokenWith(claims, ttl);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: token })
      .expect(401);
  });
});
