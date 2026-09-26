import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Prisma } from '../src/generated/prisma/client';
import { PerfilUsuario } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Cadastro administrativo de entregadores', () => {
  let app: INestApplication;
  const jwt = new JwtService();
  const findUnique = jest.fn();
  const create = jest.fn();
  const id = '9b72c770-bc74-4c77-82c7-205c2d91628a';
  const body = {
    nome: '  Bia Silva  ',
    email: '  BIA@EXAMPLE.COM  ',
    telefone: '  11988888888  ',
    senha: ' senha123 ',
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ usuario: { findUnique, create } })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
  });

  beforeEach(() => {
    findUnique.mockReset();
    create.mockReset();
    findUnique.mockResolvedValue({ id, perfil: PerfilUsuario.ADMIN });
    create.mockImplementation(async ({ data }) => ({
      id,
      nome: data.nome,
      email: data.email,
      telefone: data.telefone,
      perfil: data.perfil,
    }));
  });

  afterAll(async () => {
    await app.close();
  });

  function accessToken(perfil: PerfilUsuario) {
    return jwt.signAsync(
      { sub: id, perfil, type: 'access' },
      { secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m' },
    );
  }

  it('permite ADMIN e retorna 201 com ENTREGADOR e somente dados públicos', async () => {
    const token = await accessToken(PerfilUsuario.ADMIN);
    const response = await request(app.getHttpServer())
      .post('/admin/entregadores')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);

    expect(response.body).toEqual({
      id,
      nome: 'Bia Silva',
      email: 'bia@example.com',
      telefone: '11988888888',
      perfil: PerfilUsuario.ENTREGADOR,
    });
    expect(response.body).not.toHaveProperty('credencialSenha');
    expect(response.body).not.toHaveProperty('senha');
    expect(create.mock.calls[0][0].data.perfil).toBe(PerfilUsuario.ENTREGADOR);
    expect(create.mock.calls[0][0].data.credencialSenha).toMatch(/^\$argon2id\$/);
  });

  it.each([PerfilUsuario.CLIENTE, PerfilUsuario.ENTREGADOR])(
    'retorna 403 para %s',
    async (perfil) => {
      findUnique.mockResolvedValue({ id, perfil });
      const token = await accessToken(perfil);
      await request(app.getHttpServer())
        .post('/admin/entregadores')
        .set('Authorization', `Bearer ${token}`)
        .send(body)
        .expect(403);
      expect(create).not.toHaveBeenCalled();
    },
  );

  it('retorna 401 sem token', async () => {
    await request(app.getHttpServer()).post('/admin/entregadores').send(body).expect(401);
    expect(create).not.toHaveBeenCalled();
  });

  it('retorna 401 com token inválido', async () => {
    await request(app.getHttpServer())
      .post('/admin/entregadores')
      .set('Authorization', 'Bearer a.b.c')
      .send(body)
      .expect(401);
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    ['email inválido', { ...body, email: 'invalido' }],
    ['nome vazio', { ...body, nome: '   ' }],
    ['telefone ausente', { nome: body.nome, email: body.email, senha: body.senha }],
    ['senha curta', { ...body, senha: '1234567' }],
    ['campo extra', { ...body, outro: 'valor' }],
    ['perfil enviado', { ...body, perfil: PerfilUsuario.ADMIN }],
  ])('retorna 400 para %s', async (_scenario, input) => {
    const token = await accessToken(PerfilUsuario.ADMIN);
    await request(app.getHttpServer())
      .post('/admin/entregadores')
      .set('Authorization', `Bearer ${token}`)
      .send(input)
      .expect(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('retorna 409 para email duplicado', async () => {
    create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('unique', {
      code: 'P2002',
      clientVersion: '7.10.0',
      meta: { target: ['email'] },
    }));
    const token = await accessToken(PerfilUsuario.ADMIN);
    const response = await request(app.getHttpServer())
      .post('/admin/entregadores')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(409);
    expect(response.body.message).toBe('E-mail já cadastrado.');
  });
});
