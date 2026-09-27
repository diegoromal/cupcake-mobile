import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Prisma } from '../src/generated/prisma/client';
import { PerfilUsuario } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Associação administrativa Produto × Personalização', () => {
  let app: INestApplication;
  const jwt = new JwtService();
  const userId = '99999999-9999-4999-8999-999999999999';
  const produtoId = '11111111-1111-4111-8111-111111111111';
  const personalizacaoId = '22222222-2222-4222-8222-222222222222';
  const path = `/admin/produtos/${produtoId}/personalizacoes`;
  const userFind = jest.fn();
  const produtoFind = jest.fn();
  const personalizacaoFind = jest.fn();
  const findMany = jest.fn();
  const linkFind = jest.fn();
  const create = jest.fn();
  const remove = jest.fn();
  const row = { id: personalizacaoId, nome: 'Cobertura', descricao: null,
    disponibilidade: true, ajusteValor: new Prisma.Decimal('1234567890.12') };
  const output = { ...row, ajusteValor: '1234567890.12' };
  const error = (code: string) => new Prisma.PrismaClientKnownRequestError(code,
    { code, clientVersion: '7.10.0' });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue({
        usuario: { findUnique: userFind },
        produto: { findUnique: produtoFind },
        personalizacao: { findUnique: personalizacaoFind, findMany },
        produtoPersonalizacao: { findUnique: linkFind, create, delete: remove },
      }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    userFind.mockResolvedValue({ id: userId, perfil: PerfilUsuario.ADMIN });
    produtoFind.mockResolvedValue({ id: produtoId });
    personalizacaoFind.mockResolvedValue({ id: personalizacaoId });
    findMany.mockResolvedValue([row]);
    linkFind.mockResolvedValue(null);
    create.mockResolvedValue({ produtoId });
    remove.mockResolvedValue({ produtoId });
  });

  async function token(perfil: PerfilUsuario = PerfilUsuario.ADMIN) {
    return jwt.signAsync({ sub: userId, perfil, type: 'access' }, {
      secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m',
    });
  }

  it('GET lista apenas vinculadas, em ordem, com formato D18 e lista vazia', async () => {
    const auth = await token();
    await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${auth}`)
      .expect(200, [output]);
    expect(findMany.mock.calls[0][0].where).toEqual({ produtos: { some: { produtoId } } });
    expect(findMany.mock.calls[0][0].orderBy).toEqual([{ nome: 'asc' }, { id: 'asc' }]);
    findMany.mockResolvedValueOnce([{ ...row, ajusteValor: null, disponibilidade: false }]);
    await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${auth}`)
      .expect(200, [{ ...output, ajusteValor: null, disponibilidade: false }]);
    findMany.mockResolvedValueOnce([]);
    await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${auth}`)
      .expect(200, []);
  });

  it('POST cria somente vínculo, inclusive indisponível, com resposta mínima', async () => {
    const auth = await token();
    personalizacaoFind.mockResolvedValue({ id: personalizacaoId, disponibilidade: false });
    await request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${auth}`)
      .send({ personalizacaoId }).expect(201, { produtoId, personalizacaoId });
    expect(create).toHaveBeenCalledWith({
      data: { produtoId, personalizacaoId }, select: { produtoId: true },
    });
  });

  it('DELETE remove somente vínculo e responde sem corpo', async () => {
    await request(app.getHttpServer()).delete(`${path}/${personalizacaoId}`)
      .set('Authorization', `Bearer ${await token()}`).expect(204, '');
    expect(remove).toHaveBeenCalledWith({
      where: { produtoId_personalizacaoId: { produtoId, personalizacaoId } },
      select: { produtoId: true },
    });
  });

  it.each(['get', 'post', 'delete'] as const)('%s rejeita produtoId inválido', async (method) => {
    const route = `/admin/produtos/invalido/personalizacoes${method === 'delete' ? `/${personalizacaoId}` : ''}`;
    const call = request(app.getHttpServer())[method](route)
      .set('Authorization', `Bearer ${await token()}`);
    if (method === 'post') call.send({ personalizacaoId });
    await call.expect(400);
  });

  it('rejeita personalizacaoId inválido na rota e no body', async () => {
    const auth = await token();
    await request(app.getHttpServer()).delete(`${path}/invalido`)
      .set('Authorization', `Bearer ${auth}`).expect(400);
    await request(app.getHttpServer()).post(path)
      .set('Authorization', `Bearer ${auth}`).send({ personalizacaoId: 'invalido' }).expect(400);
  });

  it.each([{}, { personalizacaoId: null }, { personalizacaoId: 12 },
    { personalizacaoId, extra: true }, { personalizacaoId, produtoId }])(
    'rejeita body ausente, inválido ou com campo extra: %j', async (body) => {
      await request(app.getHttpServer()).post(path)
        .set('Authorization', `Bearer ${await token()}`).send(body).expect(400);
      expect(create).not.toHaveBeenCalled();
    });

  it('rejeita POST sem body', async () => {
    await request(app.getHttpServer()).post(path)
      .set('Authorization', `Bearer ${await token()}`).expect(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('retorna 404 para Produto em GET, POST e DELETE', async () => {
    produtoFind.mockResolvedValue(null);
    const auth = await token();
    await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${auth}`).expect(404);
    await request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${auth}`)
      .send({ personalizacaoId }).expect(404);
    await request(app.getHttpServer()).delete(`${path}/${personalizacaoId}`)
      .set('Authorization', `Bearer ${auth}`).expect(404);
  });

  it('retorna 404 para Personalização inexistente e vínculo inexistente', async () => {
    const auth = await token();
    personalizacaoFind.mockResolvedValue(null);
    await request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${auth}`)
      .send({ personalizacaoId }).expect(404);
    remove.mockRejectedValueOnce(error('P2025'));
    await request(app.getHttpServer()).delete(`${path}/${personalizacaoId}`)
      .set('Authorization', `Bearer ${auth}`).expect(404);
  });

  it('retorna 409 para duplicidade prévia e corrida P2002', async () => {
    const auth = await token();
    linkFind.mockResolvedValueOnce({ produtoId });
    await request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${auth}`)
      .send({ personalizacaoId }).expect(409);
    create.mockRejectedValueOnce(error('P2002'));
    await request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${auth}`)
      .send({ personalizacaoId }).expect(409);
  });

  it.each(['get', 'post', 'delete'] as const)('%s exige autenticação e ADMIN', async (method) => {
    const route = method === 'delete' ? `${path}/${personalizacaoId}` : path;
    const unauthenticated = request(app.getHttpServer())[method](route);
    if (method === 'post') unauthenticated.send({ personalizacaoId });
    await unauthenticated.expect(401);
    for (const perfil of [PerfilUsuario.CLIENTE, PerfilUsuario.ENTREGADOR]) {
      userFind.mockResolvedValue({ id: userId, perfil });
      const forbidden = request(app.getHttpServer())[method](route)
        .set('Authorization', `Bearer ${await token(perfil)}`);
      if (method === 'post') forbidden.send({ personalizacaoId });
      await forbidden.expect(403);
    }
  });

  it('rejeita token inválido', async () => {
    await request(app.getHttpServer()).get(path)
      .set('Authorization', 'Bearer a.b.c').expect(401);
  });
});
