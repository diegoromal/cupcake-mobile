import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Prisma } from '../src/generated/prisma/client';
import { PerfilUsuario } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';

describe('CRUD administrativo de personalizações', () => {
  let app: INestApplication;
  const jwt = new JwtService();
  const adminId = '99999999-9999-4999-8999-999999999999';
  const id = '11111111-1111-4111-8111-111111111111';
  const otherId = '22222222-2222-4222-8222-222222222222';
  const path = '/admin/personalizacoes';
  const findUser = jest.fn();
  const create = jest.fn();
  const findMany = jest.fn();
  const findUnique = jest.fn();
  const update = jest.fn();
  const remove = jest.fn();
  const row = { id, nome: 'Cobertura', descricao: null, disponibilidade: true,
    ajusteValor: new Prisma.Decimal('1234567890.12') };
  const body = { ...row, ajusteValor: '1234567890.12' };
  const prismaError = (code: string) => new Prisma.PrismaClientKnownRequestError(code, {
    code, clientVersion: '7.10.0',
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        usuario: { findUnique: findUser },
        personalizacao: { create, findMany, findUnique, update, delete: remove },
      })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    findUser.mockResolvedValue({ id: adminId, perfil: PerfilUsuario.ADMIN });
    create.mockResolvedValue(row);
    findMany.mockResolvedValue([row]);
    findUnique.mockResolvedValue(row);
    update.mockResolvedValue(row);
    remove.mockResolvedValue({ id });
  });

  afterAll(async () => app.close());

  async function token(perfil: PerfilUsuario = PerfilUsuario.ADMIN) {
    return jwt.signAsync({ sub: adminId, perfil, type: 'access' }, {
      secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m',
    });
  }

  it('cria com trim, default true, decimal exato e nomes duplicados', async () => {
    const auth = await token();
    for (let i = 0; i < 2; i++) {
      await request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${auth}`)
        .send({ nome: '  Cobertura  ', descricao: '  Extra  ', ajusteValor: '1234567890.12' })
        .expect(201, body);
    }
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0].data.nome).toBe('Cobertura');
    expect(create.mock.calls[0][0].data.descricao).toBe('Extra');
    expect(create.mock.calls[0][0].data.disponibilidade).toBe(true);
    expect(create.mock.calls[0][0].data.ajusteValor.toFixed(2)).toBe('1234567890.12');
  });

  it('aceita disponibilidade false, descrição null, decimal null e negativo', async () => {
    const auth = await token();
    create.mockResolvedValueOnce({ ...row, disponibilidade: false, ajusteValor: null })
      .mockResolvedValueOnce({ ...row, ajusteValor: new Prisma.Decimal('-0.05') });
    await request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${auth}`)
      .send({ nome: 'Cobertura', descricao: null, disponibilidade: false, ajusteValor: null })
      .expect(201, { ...body, disponibilidade: false, ajusteValor: null });
    expect(create.mock.calls[0][0].data).toMatchObject({
      descricao: null, disponibilidade: false, ajusteValor: null,
    });
    await request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${auth}`)
      .send({ nome: 'Cobertura', ajusteValor: '-0.05' })
      .expect(201, { ...body, ajusteValor: '-0.05' });
    expect(create.mock.calls[1][0].data.ajusteValor.toFixed(2)).toBe('-0.05');
  });

  it('aceita zeros à esquerda quando a precisão decimal cabe no banco', async () => {
    await request(app.getHttpServer()).post(path)
      .set('Authorization', `Bearer ${await token()}`)
      .send({ nome: 'Cobertura', ajusteValor: '0001234567890.12' })
      .expect(201, body);
    expect(create.mock.calls[0][0].data.ajusteValor.toFixed(2)).toBe('1234567890.12');
  });

  it('lista sem filtros, inclusive vazio, ordenando por nome e id', async () => {
    const auth = await token();
    await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${auth}`)
      .expect(200, [body]);
    expect(findMany.mock.calls[0][0].orderBy).toEqual([{ nome: 'asc' }, { id: 'asc' }]);
    findMany.mockResolvedValue([]);
    await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${auth}`)
      .expect(200, []);
  });

  it('consulta por UUID e retorna 404', async () => {
    const auth = await token();
    await request(app.getHttpServer()).get(`${path}/${id}`)
      .set('Authorization', `Bearer ${auth}`).expect(200, body);
    findUnique.mockResolvedValue(null);
    await request(app.getHttpServer()).get(`${path}/${otherId}`)
      .set('Authorization', `Bearer ${auth}`).expect(404);
  });

  it('atualiza parcialmente e limpa campos nulos', async () => {
    const auth = await token();
    update.mockResolvedValueOnce({ ...row, ajusteValor: null });
    await request(app.getHttpServer()).patch(`${path}/${id}`)
      .set('Authorization', `Bearer ${auth}`)
      .send({ nome: '  Outra  ', descricao: null, disponibilidade: false, ajusteValor: null })
      .expect(200, { ...body, ajusteValor: null });
    expect(update.mock.calls[0][0].data).toEqual({
      nome: 'Outra', descricao: null, disponibilidade: false, ajusteValor: null,
    });
    update.mockResolvedValueOnce({ ...row, ajusteValor: new Prisma.Decimal('-2') });
    await request(app.getHttpServer()).patch(`${path}/${id}`)
      .set('Authorization', `Bearer ${auth}`).send({ ajusteValor: '-2' })
      .expect(200, { ...body, ajusteValor: '-2.00' });
    expect(update.mock.calls[1][0].data.ajusteValor.toFixed(2)).toBe('-2.00');
    update.mockRejectedValueOnce(prismaError('P2025'));
    await request(app.getHttpServer()).patch(`${path}/${otherId}`)
      .set('Authorization', `Bearer ${auth}`).send({ nome: 'Nova' }).expect(404);
  });

  it('exclui sem corpo e traduz inexistência e FKs', async () => {
    const auth = await token();
    await request(app.getHttpServer()).delete(`${path}/${id}`)
      .set('Authorization', `Bearer ${auth}`).expect(204, '');
    remove.mockRejectedValueOnce(prismaError('P2025'))
      .mockRejectedValueOnce(prismaError('P2003'));
    await request(app.getHttpServer()).delete(`${path}/${id}`)
      .set('Authorization', `Bearer ${auth}`).expect(404);
    await request(app.getHttpServer()).delete(`${path}/${id}`)
      .set('Authorization', `Bearer ${auth}`).expect(409);
  });

  it.each(['post', 'patch'] as const)('rejeita extras e produtoId em %s', async (method) => {
    const auth = await token();
    for (const field of ['extra', 'produtoId']) {
      await request(app.getHttpServer())[method](method === 'post' ? path : `${path}/${id}`)
        .set('Authorization', `Bearer ${auth}`)
        .send({ nome: 'Cobertura', [field]: 'x' }).expect(400);
    }
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    [{}, 'post'], [{ nome: '   ' }, 'post'], [{ nome: null }, 'post'],
    [{ nome: 3 }, 'post'], [{ descricao: null }, 'post'],
    [{ nome: 'Ok', descricao: false }, 'post'],
    [{ nome: 'Ok', disponibilidade: 'true' }, 'post'],
    [{ nome: 'Ok', disponibilidade: null }, 'post'],
    [{ nome: 'Ok', ajusteValor: 1.23 }, 'post'],
    [{ nome: 'Ok', ajusteValor: '1.234' }, 'post'],
    [{ nome: 'Ok', ajusteValor: '12345678901.00' }, 'post'],
    [{ nome: 'Ok', ajusteValor: 'abc' }, 'post'],
    [{ nome: 'Ok', ajusteValor: '1e2' }, 'post'],
    [{}, 'patch'], [{ nome: '' }, 'patch'], [{ nome: null }, 'patch'],
    [{ disponibilidade: 1 }, 'patch'], [{ ajusteValor: '0.001' }, 'patch'],
  ] as const)('rejeita corpo inválido %j em %s', async (input, method) => {
    const auth = await token();
    await request(app.getHttpServer())[method](method === 'post' ? path : `${path}/${id}`)
      .set('Authorization', `Bearer ${auth}`).send(input).expect(400);
  });

  it.each(['get', 'patch', 'delete'] as const)('rejeita UUID inválido em %s', async (method) => {
    const call = request(app.getHttpServer())[method](`${path}/invalido`)
      .set('Authorization', `Bearer ${await token()}`);
    if (method === 'patch') call.send({ nome: 'Nova' });
    await call.expect(400);
  });

  it.each([
    ['post', path], ['get', path], ['get', `${path}/${id}`],
    ['patch', `${path}/${id}`], ['delete', `${path}/${id}`],
  ] as const)('protege %s %s por perfil', async (method, route) => {
    const unauthenticated = request(app.getHttpServer())[method](route);
    if (method === 'post' || method === 'patch') unauthenticated.send({ nome: 'Nova' });
    await unauthenticated.expect(401);
    for (const perfil of [PerfilUsuario.CLIENTE, PerfilUsuario.ENTREGADOR]) {
      findUser.mockResolvedValue({ id: adminId, perfil });
      const forbidden = request(app.getHttpServer())[method](route)
        .set('Authorization', `Bearer ${await token(perfil)}`);
      if (method === 'post' || method === 'patch') forbidden.send({ nome: 'Nova' });
      await forbidden.expect(403);
    }
  });

  it('rejeita token inválido', async () => {
    await request(app.getHttpServer()).get(path)
      .set('Authorization', 'Bearer a.b.c').expect(401);
    expect(findMany).not.toHaveBeenCalled();
  });
});
