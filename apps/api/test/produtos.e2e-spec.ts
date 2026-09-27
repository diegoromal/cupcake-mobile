import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Prisma } from '../src/generated/prisma/client';
import { PerfilUsuario } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';

const id = '11111111-1111-4111-8111-111111111111';
const categoriaId = '22222222-2222-4222-8222-222222222222';
const otherId = '33333333-3333-4333-8333-333333333333';
const adminId = '99999999-9999-4999-8999-999999999999';
const row = { id, categoriaId, nome: 'Bolo', descricao: null,
  precoAtual: new Prisma.Decimal('12.30'), imagem: null, ativo: true };
const output = { ...row, precoAtual: '12.30' };
const err = (code: string) => new Prisma.PrismaClientKnownRequestError(code, {
  code, clientVersion: '7.10.0',
});

describe('CRUD administrativo de produtos', () => {
  let app: INestApplication;
  const jwt = new JwtService();
  const findUser = jest.fn();
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

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue({
        usuario: { findUnique: findUser }, categoria: { findUnique: categoriaFind },
        produto: { findMany, findUnique, update }, $transaction: transaction,
      }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    findUser.mockResolvedValue({ id: adminId, perfil: PerfilUsuario.ADMIN });
    categoriaFind.mockResolvedValue({ id: categoriaId });
    create.mockResolvedValue(row);
    stockCreate.mockResolvedValue({ produtoId: id });
    findMany.mockResolvedValue([row]);
    findUnique.mockResolvedValue(row);
    update.mockResolvedValue(row);
    stockDelete.mockResolvedValue({ count: 1 });
    remove.mockResolvedValue({ id });
  });
  async function token(perfil: PerfilUsuario = PerfilUsuario.ADMIN) {
    return jwt.signAsync({ sub: adminId, perfil, type: 'access' }, {
      secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m',
    });
  }
  const base = '/admin/produtos';
  const valid = { categoriaId, nome: ' Bolo ', precoAtual: '12.30' };

  it('POST cria com trim, defaults, Decimal e resposta restrita', async () => {
    const auth = await token();
    await request(app.getHttpServer()).post(base).set('Authorization', `Bearer ${auth}`)
      .send({ ...valid, descricao: '  Doce  ' }).expect(201, output);
    expect(create.mock.calls[0][0].data).toMatchObject({
      categoriaId, nome: 'Bolo', descricao: 'Doce', ativo: undefined,
      precoAtual: new Prisma.Decimal('12.30'),
    });
    expect(stockCreate).toHaveBeenCalledWith({ data: {
      produtoId: id, quantidadeFisica: 0, quantidadeReservada: 0,
    } });
  });

  it('GET lista inclusive inativos, sem filtros, e GET por id', async () => {
    const auth = await token();
    await request(app.getHttpServer()).get(base).set('Authorization', `Bearer ${auth}`)
      .expect(200, [output]);
    expect(findMany.mock.calls[0][0].orderBy).toEqual([{ nome: 'asc' }, { id: 'asc' }]);
    await request(app.getHttpServer()).get(`${base}/${id}`)
      .set('Authorization', `Bearer ${auth}`).expect(200, output);
    findUnique.mockResolvedValue(null);
    await request(app.getHttpServer()).get(`${base}/${otherId}`)
      .set('Authorization', `Bearer ${auth}`).expect(404);
  });

  it('PATCH parcial limpa opcionais, troca categoria e desativa', async () => {
    const auth = await token();
    await request(app.getHttpServer()).patch(`${base}/${id}`)
      .set('Authorization', `Bearer ${auth}`)
      .send({ categoriaId, nome: ' Novo ', descricao: null,
        precoAtual: '0.05', ativo: false }).expect(200, output);
    expect(update.mock.calls[0][0].data).toMatchObject({
      categoriaId, nome: 'Novo', descricao: null,
      precoAtual: new Prisma.Decimal('0.05'), ativo: false,
    });
  });

  it('DELETE livre retorna 204, inexistente 404, vínculo e estoque 409', async () => {
    const auth = await token();
    const call = () => request(app.getHttpServer()).delete(`${base}/${id}`)
      .set('Authorization', `Bearer ${auth}`);
    await call().expect(204, '');
    findUnique.mockResolvedValueOnce(null);
    await call().expect(404);
    stockDelete.mockResolvedValueOnce({ count: 0 });
    await call().expect(409);
    remove.mockRejectedValueOnce(err('P2003'));
    await call().expect(409);
  });

  it('categoria inexistente retorna 404 em POST e PATCH', async () => {
    const auth = await token();
    categoriaFind.mockResolvedValue(null);
    await request(app.getHttpServer()).post(base).set('Authorization', `Bearer ${auth}`)
      .send({ ...valid, categoriaId: otherId }).expect(404);
    await request(app.getHttpServer()).patch(`${base}/${id}`)
      .set('Authorization', `Bearer ${auth}`)
      .send({ categoriaId: otherId }).expect(404);
  });

  it.each([
    [{ ...valid, precoAtual: -1 }, 'post'],
    [{ ...valid, precoAtual: '-1.00' }, 'post'],
    [{ ...valid, precoAtual: '1.001' }, 'post'],
    [{ ...valid, precoAtual: '12345678901.00' }, 'post'],
    [{ ...valid, precoAtual: null }, 'post'],
    [{ ...valid, categoriaId: 'invalid' }, 'post'],
    [{ ...valid, nome: '  ' }, 'post'],
    [{ ...valid, ativo: 'true' }, 'post'],
    [{ ...valid, imagem: 'foto.jpg' }, 'post'],
    [{ ...valid, imagem: ' ' }, 'post'],
    [{ ...valid, imagem: 'data:image/png;base64,YQ==' }, 'post'],
    [{ nome: 'Bolo', precoAtual: '1.00' }, 'post'],
    [{ categoriaId, precoAtual: '1.00' }, 'post'],
    [{ categoriaId, nome: 'Bolo' }, 'post'],
    [{ ...valid, estoque: {} }, 'post'],
    [{ ...valid, quantidade: 2 }, 'post'],
    [{ ...valid, quantidadeFisica: 2 }, 'post'],
    [{ ...valid, quantidadeReservada: 2 }, 'post'],
    [{ ...valid, personalizacaoId: otherId }, 'post'],
    [{ ...valid, personalizacoes: [] }, 'post'],
    [{ ...valid, extra: true }, 'post'],
    [{}, 'patch'], [{ precoAtual: '1.001' }, 'patch'],
    [{ precoAtual: '-1' }, 'patch'], [{ precoAtual: null }, 'patch'],
    [{ ativo: null }, 'patch'], [{ ativo: 1 }, 'patch'],
    [{ categoriaId: null }, 'patch'], [{ imagem: 'foto.jpg' }, 'patch'], [{ imagem: '' }, 'patch'],
    [{ estoque: 0 }, 'patch'], [{ personalizacoes: [] }, 'patch'],
  ] as const)('rejeita payload %j em %s', async (body, method) => {
    const auth = await token();
    const path = method === 'post' ? base : `${base}/${id}`;
    await request(app.getHttpServer())[method](path)
      .set('Authorization', `Bearer ${auth}`).send(body).expect(400);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it.each(['get', 'patch', 'delete'] as const)('UUID inválido em %s retorna 400', async (method) => {
    const auth = await token();
    const call = request(app.getHttpServer())[method](`${base}/invalid`)
      .set('Authorization', `Bearer ${auth}`);
    if (method === 'patch') call.send({ nome: 'Novo' });
    await call.expect(400);
  });

  it.each([
    ['post', base], ['get', base], ['get', `${base}/${id}`],
    ['patch', `${base}/${id}`], ['delete', `${base}/${id}`],
  ] as const)('protege %s %s com 401 e 403', async (method, path) => {
    const unauthenticated = request(app.getHttpServer())[method](path);
    if (method === 'post' || method === 'patch') unauthenticated.send(valid);
    await unauthenticated.expect(401);
    for (const perfil of [PerfilUsuario.CLIENTE, PerfilUsuario.ENTREGADOR]) {
      findUser.mockResolvedValue({ id: adminId, perfil });
      const forbidden = request(app.getHttpServer())[method](path)
        .set('Authorization', `Bearer ${await token(perfil)}`);
      if (method === 'post' || method === 'patch') forbidden.send(valid);
      await forbidden.expect(403);
    }
  });

  it('token inválido retorna 401', async () => {
    await request(app.getHttpServer()).get(base)
      .set('Authorization', 'Bearer a.b.c').expect(401);
  });
});
