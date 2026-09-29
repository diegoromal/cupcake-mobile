import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PerfilUsuario } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Estoque administrativo', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const adminId = '99999999-9999-4999-8999-999999999999';
  const saldo = { produtoId: id, quantidadeFisica: 5, quantidadeReservada: 2 };
  const findUser = jest.fn();
  const findStock = jest.fn();
  const findMovements = jest.fn();
  const queryRaw = jest.fn();
  const update = jest.fn();
  const create = jest.fn();
  const transaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({
    $queryRaw: queryRaw, estoque: { update }, movimentacaoEstoque: { create },
  }));
  let app: INestApplication;
  const jwt = new JwtService();
  const path = `/admin/produtos/${id}/estoque`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue({
        usuario: { findUnique: findUser }, estoque: { findUnique: findStock },
        movimentacaoEstoque: { findMany: findMovements }, $transaction: transaction,
      }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    findUser.mockResolvedValue({ id: adminId, perfil: PerfilUsuario.ADMIN });
    findStock.mockResolvedValue(saldo);
    queryRaw.mockResolvedValue([saldo]);
    update.mockResolvedValue({ ...saldo, quantidadeFisica: 6 });
    findMovements.mockResolvedValue([]);
  });
  async function token(perfil: PerfilUsuario = PerfilUsuario.ADMIN) {
    return jwt.signAsync({ sub: adminId, perfil, type: 'access' }, {
      secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m',
    });
  }
  it('consulta, ajusta e lista histórico em rotas ADMIN', async () => {
    const auth = await token();
    await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${auth}`)
      .expect(200, { ...saldo, quantidadeDisponivel: 3 });
    await request(app.getHttpServer()).patch(path).set('Authorization', `Bearer ${auth}`)
      .send({ quantidadeDisponivel: 4 }).expect(200, { ...saldo, quantidadeFisica: 6, quantidadeDisponivel: 4 });
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ quantidade: 1 }) });
    await request(app.getHttpServer()).get(`${path}/movimentacoes`).set('Authorization', `Bearer ${auth}`)
      .expect(200, []);
    expect(findMovements.mock.calls[0][0].orderBy).toEqual([{ data: 'desc' }, { id: 'desc' }]);
  });
  it.each([{}, { quantidadeDisponivel: -1 }, { quantidadeDisponivel: 1.5 },
    { quantidadeDisponivel: '2' }, { quantidadeDisponivel: null },
    { quantidadeDisponivel: 2147483648 }, { quantidadeDisponivel: 2, motivoOrigem: 'x' }])('rejeita payload %j', async (body) => {
    await request(app.getHttpServer()).patch(path).set('Authorization', `Bearer ${await token()}`)
      .send(body).expect(400);
    expect(transaction).not.toHaveBeenCalled();
  });
  it('no-op e ausência de estoque', async () => {
    const auth = await token();
    await request(app.getHttpServer()).patch(path).set('Authorization', `Bearer ${auth}`)
      .send({ quantidadeDisponivel: 3 }).expect(200, { ...saldo, quantidadeDisponivel: 3 });
    expect(create).not.toHaveBeenCalled();
    findStock.mockResolvedValueOnce(null);
    await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${auth}`).expect(404);
  });
  it('aceita zero, preserva a reserva e rejeita alvo que estoura o físico', async () => {
    const auth = await token();
    update.mockResolvedValueOnce({ ...saldo, quantidadeFisica: 2 });
    await request(app.getHttpServer()).patch(path).set('Authorization', `Bearer ${auth}`)
      .send({ quantidadeDisponivel: 0 }).expect(200, { ...saldo, quantidadeFisica: 2, quantidadeDisponivel: 0 });
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ quantidade: -3 }) });
    await request(app.getHttpServer()).patch(path).set('Authorization', `Bearer ${auth}`)
      .send({ quantidadeDisponivel: 2147483647 }).expect(400);
    expect(create).toHaveBeenCalledTimes(1);
  });
  it('retorna 404 nas três rotas para estoque ausente e 400 para UUID inválido', async () => {
    const auth = await token();
    findStock.mockResolvedValue(null);
    queryRaw.mockResolvedValue([]);
    for (const [method, url] of [['get', path], ['patch', path], ['get', `${path}/movimentacoes`]] as const) {
      const call = request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${auth}`);
      if (method === 'patch') call.send({ quantidadeDisponivel: 1 });
      await call.expect(404);
    }
    for (const [method, suffix] of [['get', ''], ['patch', ''], ['get', '/movimentacoes']] as const) {
      const call = request(app.getHttpServer())[method](`/admin/produtos/invalid/estoque${suffix}`)
        .set('Authorization', `Bearer ${auth}`);
      if (method === 'patch') call.send({ quantidadeDisponivel: 1 });
      await call.expect(400);
    }
  });
  it.each([['GET', path], ['PATCH', path], ['GET', `${path}/movimentacoes`]])('protege %s %s', async (method, url) => {
    const call = () => request(app.getHttpServer())[method.toLowerCase() as 'get' | 'patch'](url);
    await call().expect(401);
    for (const perfil of [PerfilUsuario.CLIENTE, PerfilUsuario.ENTREGADOR]) {
      findUser.mockResolvedValue({ id: adminId, perfil });
      await call().set('Authorization', `Bearer ${await token(perfil)}`).expect(403);
    }
  });
});
