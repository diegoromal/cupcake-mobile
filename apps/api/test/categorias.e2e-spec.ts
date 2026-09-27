import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Prisma } from '../src/generated/prisma/client';
import { PerfilUsuario } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';

describe('CRUD administrativo de categorias', () => {
  let app: INestApplication;
  const jwt = new JwtService();
  const adminId = '99999999-9999-4999-8999-999999999999';
  const id = '11111111-1111-4111-8111-111111111111';
  const otherId = '22222222-2222-4222-8222-222222222222';
  const findUser = jest.fn();
  const create = jest.fn();
  const findMany = jest.fn();
  const findUnique = jest.fn();
  const update = jest.fn();
  const remove = jest.fn();
  const categoria = { id, nome: 'Doces', descricao: null };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        usuario: { findUnique: findUser },
        categoria: { create, findMany, findUnique, update, delete: remove },
      })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    findUser.mockResolvedValue({ id: adminId, perfil: PerfilUsuario.ADMIN });
    create.mockResolvedValue(categoria);
    findMany.mockResolvedValue([categoria]);
    findUnique.mockResolvedValue(categoria);
    update.mockResolvedValue(categoria);
    remove.mockResolvedValue({ id });
  });

  afterAll(async () => app.close());

  async function token(perfil: PerfilUsuario = PerfilUsuario.ADMIN) {
    return jwt.signAsync({ sub: adminId, perfil, type: 'access' }, {
      secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m',
    });
  }

  it('cria com trim, descrição null e permite nomes repetidos', async () => {
    const auth = await token();
    for (let i = 0; i < 2; i++) {
      const response = await request(app.getHttpServer()).post('/admin/categorias')
        .set('Authorization', `Bearer ${auth}`)
        .send({ nome: '  Doces  ', descricao: null }).expect(201);
      expect(response.body).toEqual(categoria);
    }
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0].data).toEqual({ nome: 'Doces', descricao: null });
  });

  it('cria com descrição em string e trim', async () => {
    const auth = await token();
    await request(app.getHttpServer()).post('/admin/categorias')
      .set('Authorization', `Bearer ${auth}`)
      .send({ nome: ' Doces ', descricao: '  Açucarados  ' }).expect(201);
    expect(create.mock.calls[0][0].data).toEqual({ nome: 'Doces', descricao: 'Açucarados' });
  });

  it('lista sem filtros e ordena por nome e id', async () => {
    const auth = await token();
    await request(app.getHttpServer()).get('/admin/categorias')
      .set('Authorization', `Bearer ${auth}`).expect(200, [categoria]);
    expect(findMany.mock.calls[0][0].orderBy)
      .toEqual([{ nome: 'asc' }, { id: 'asc' }]);
    findMany.mockResolvedValue([]);
    await request(app.getHttpServer()).get('/admin/categorias')
      .set('Authorization', `Bearer ${auth}`).expect(200, []);
  });

  it('consulta por id e retorna 404 se inexistente', async () => {
    const auth = await token();
    await request(app.getHttpServer()).get(`/admin/categorias/${id}`)
      .set('Authorization', `Bearer ${auth}`).expect(200, categoria);
    findUnique.mockResolvedValue(null);
    await request(app.getHttpServer()).get(`/admin/categorias/${otherId}`)
      .set('Authorization', `Bearer ${auth}`).expect(404);
  });

  it('atualiza parcialmente com trim e limpa descrição', async () => {
    const auth = await token();
    await request(app.getHttpServer()).patch(`/admin/categorias/${id}`)
      .set('Authorization', `Bearer ${auth}`)
      .send({ nome: '  Novos  ', descricao: null }).expect(200, categoria);
    expect(update.mock.calls[0][0].data).toEqual({ nome: 'Novos', descricao: null });
    update.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('missing', {
      code: 'P2025', clientVersion: '7.10.0',
    }));
    await request(app.getHttpServer()).patch(`/admin/categorias/${otherId}`)
      .set('Authorization', `Bearer ${auth}`)
      .send({ nome: 'Novo' }).expect(404);
  });

  it('exclui sem corpo, retorna 404 ou 409 conforme banco', async () => {
    const auth = await token();
    await request(app.getHttpServer()).delete(`/admin/categorias/${id}`)
      .set('Authorization', `Bearer ${auth}`).expect(204, '');
    remove.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('missing', {
      code: 'P2025', clientVersion: '7.10.0',
    })).mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('fk', {
      code: 'P2003', clientVersion: '7.10.0',
    }));
    await request(app.getHttpServer()).delete(`/admin/categorias/${id}`)
      .set('Authorization', `Bearer ${auth}`).expect(404);
    await request(app.getHttpServer()).delete(`/admin/categorias/${id}`)
      .set('Authorization', `Bearer ${auth}`).expect(409);
  });

  it.each(['post', 'patch'] as const)('rejeita campos extras em %s', async (method) => {
    const auth = await token();
    const path = method === 'post' ? '/admin/categorias' : `/admin/categorias/${id}`;
    await request(app.getHttpServer())[method](path)
      .set('Authorization', `Bearer ${auth}`)
      .send({ nome: 'Doces', extra: true }).expect(400);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    [{ nome: '   ' }, 'post'],
    [{ nome: null }, 'post'],
    [{ descricao: null }, 'post'],
    [{ nome: 42 }, 'post'],
    [{ nome: 'Doces', descricao: 42 }, 'post'],
    [{ nome: '' }, 'patch'],
    [{ nome: null }, 'patch'],
    [{ descricao: false }, 'patch'],
    [{}, 'patch'],
  ] as const)('rejeita corpo inválido %j em %s', async (body, method) => {
    const auth = await token();
    const path = method === 'post' ? '/admin/categorias' : `/admin/categorias/${id}`;
    await request(app.getHttpServer())[method](path)
      .set('Authorization', `Bearer ${auth}`).send(body).expect(400);
  });

  it.each(['get', 'patch', 'delete'] as const)('rejeita UUID inválido em %s', async (method) => {
    const auth = await token();
    const call = request(app.getHttpServer())[method]('/admin/categorias/invalido')
      .set('Authorization', `Bearer ${auth}`);
    if (method === 'patch') call.send({ nome: 'Novo' });
    await call.expect(400);
  });

  it.each([
    ['post', '/admin/categorias'], ['get', '/admin/categorias'],
    ['get', `/admin/categorias/${id}`], ['patch', `/admin/categorias/${id}`],
    ['delete', `/admin/categorias/${id}`],
  ] as const)('protege %s %s com 401 e 403 por perfil', async (method, path) => {
    const unauthenticated = request(app.getHttpServer())[method](path);
    if (method === 'post' || method === 'patch') unauthenticated.send({ nome: 'Novo' });
    await unauthenticated.expect(401);
    for (const perfil of [PerfilUsuario.CLIENTE, PerfilUsuario.ENTREGADOR]) {
      findUser.mockResolvedValue({ id: adminId, perfil });
      const forbidden = request(app.getHttpServer())[method](path)
        .set('Authorization', `Bearer ${await token(perfil)}`);
      if (method === 'post' || method === 'patch') forbidden.send({ nome: 'Novo' });
      await forbidden.expect(403);
    }
  });

  it('retorna 401 para token inválido', async () => {
    await request(app.getHttpServer()).get('/admin/categorias')
      .set('Authorization', 'Bearer a.b.c').expect(401);
    expect(findMany).not.toHaveBeenCalled();
  });
});
