import { GatewayTimeoutException, INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PagamentosModule } from '../src/pagamentos/pagamentos.module';
import { PagamentosService } from '../src/pagamentos/pagamentos.service';
import { PrismaService } from '../src/prisma/prisma.service';

const usuarioId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const pedidoId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const tentativaId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const caminho = `/pedidos/${pedidoId}/pagamentos/pix`;

describe('contrato HTTP Pix', () => {
  let app: INestApplication;
  const iniciarPix = jest.fn(), consultarPix = jest.fn(), user = jest.fn();
  const jwt = new JwtService();
  const token = (perfil = 'CLIENTE') => jwt.signAsync({ sub: usuarioId, perfil, type: 'access' }, {
    secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m',
  });
  const pagamento = { tentativaId, pedidoId, forma: 'PIX', resultado: 'APROVADO',
    valorAplicavel: '12.34', dataTransacao: '2026-10-23T12:00:00.000Z' };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [PagamentosModule] })
      .overrideProvider(PrismaService).useValue({ usuario: { findUnique: user } })
      .overrideProvider(PagamentosService).useValue({ iniciarPix, consultarPix }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    user.mockResolvedValue({ id: usuarioId, perfil: 'CLIENTE' });
    iniciarPix.mockResolvedValue({ criado: true, pagamento });
    consultarPix.mockResolvedValue(pagamento);
  });
  afterAll(async () => app.close());

  it('exige autenticação e CLIENTE em POST e GET', async () => {
    await request(app.getHttpServer()).post(caminho).send({ tentativaId }).expect(401);
    await request(app.getHttpServer()).get(`${caminho}/${tentativaId}`).expect(401);
    for (const perfil of ['ADMIN', 'ENTREGADOR']) {
      user.mockResolvedValue({ id: usuarioId, perfil });
      const auth = `Bearer ${await token(perfil)}`;
      await request(app.getHttpServer()).post(caminho).set('Authorization', auth).send({ tentativaId }).expect(403);
      await request(app.getHttpServer()).get(`${caminho}/${tentativaId}`).set('Authorization', auth).expect(403);
    }
    expect(iniciarPix).not.toHaveBeenCalled();
    expect(consultarPix).not.toHaveBeenCalled();
  });

  it('rejeita body fora do contrato e UUIDs inválidos', async () => {
    const auth = `Bearer ${await token()}`;
    for (const body of [{}, { tentativaId: 'invalido' }, { tentativaId: null }, [],
      { tentativaId, valor: '0.01' }, { tentativaId, resultado: 'APROVADO' },
      { tentativaId, resultadoPixPlanejado: 'APROVADO' }, { tentativaId, usuarioId }]) {
      await request(app.getHttpServer()).post(caminho).set('Authorization', auth).send(body).expect(400);
    }
    await request(app.getHttpServer()).post('/pedidos/invalido/pagamentos/pix')
      .set('Authorization', auth).send({ tentativaId }).expect(400);
    await request(app.getHttpServer()).get(`${caminho}/invalido`).set('Authorization', auth).expect(400);
    expect(iniciarPix).not.toHaveBeenCalled();
    expect(consultarPix).not.toHaveBeenCalled();
  });

  it('retorna 201 na criação, 200 na repetição, com usuário autenticado', async () => {
    const auth = `Bearer ${await token()}`;
    const first = await request(app.getHttpServer()).post(caminho).set('Authorization', auth)
      .send({ tentativaId }).expect(201);
    expect(first.body).toEqual(pagamento);
    expect(iniciarPix).toHaveBeenCalledWith(usuarioId, pedidoId, tentativaId);
    iniciarPix.mockResolvedValueOnce({ criado: false, pagamento });
    const retry = await request(app.getHttpServer()).post(caminho).set('Authorization', auth)
      .send({ tentativaId }).expect(200);
    expect(retry.body).toEqual(first.body);
  });

  it('504 informa tentativaId e GET apenas consulta', async () => {
    const auth = `Bearer ${await token()}`;
    iniciarPix.mockRejectedValueOnce(new GatewayTimeoutException({ statusCode: 504, tentativaId }));
    const result = await request(app.getHttpServer()).post(caminho).set('Authorization', auth)
      .send({ tentativaId }).expect(504);
    expect(result.body).toEqual({ statusCode: 504, tentativaId });
    consultarPix.mockResolvedValueOnce({ ...pagamento, resultado: 'PENDENTE', dataTransacao: null });
    const get = await request(app.getHttpServer()).get(`${caminho}/${tentativaId}`).set('Authorization', auth).expect(200);
    expect(get.body.resultado).toBe('PENDENTE');
    expect(consultarPix).toHaveBeenCalledWith(usuarioId, pedidoId, tentativaId);
    expect(iniciarPix).toHaveBeenCalledTimes(1);
  });
});
