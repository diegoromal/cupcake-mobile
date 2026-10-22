import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Prisma } from '../src/generated/prisma/client';
import { PerfilUsuario } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';

const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const addressId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const addressId2 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

describe('D39–D41 HTTP', () => {
  let app: INestApplication;
  let rows: Array<Record<string, unknown>>;
  let config: Record<string, unknown> | null;
  let fetchMock: jest.SpyInstance;
  const user = jest.fn();
  const jwt = new JwtService();
  const token = (id: string, perfil: PerfilUsuario) => jwt.signAsync(
    { sub: id, perfil, type: 'access' },
    { secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m' },
  );
  const auth = async (id: string, perfil: PerfilUsuario) => `Bearer ${await token(id, perfil)}`;

  beforeAll(async () => {
    const prisma = {
      usuario: { findUnique: user },
      endereco: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = { id: rows.length ? addressId2 : addressId, ...data, latitude: null, longitude: null };
          rows.push(row); return visible(row);
        }),
        findMany: jest.fn(async ({ where }: { where: { usuarioId: string } }) =>
          rows.filter((row) => row.usuarioId === where.usuarioId).sort((x, y) => String(x.id).localeCompare(String(y.id))).map(visible)),
        findFirst: jest.fn(async ({ where }: { where: { id: string; usuarioId: string } }) =>
          rows.find((row) => row.id === where.id && row.usuarioId === where.usuarioId) ?? null),
        updateMany: jest.fn(async ({ where, data }: { where: { id: string; usuarioId: string }; data: Record<string, unknown> }) => {
          const row = rows.find((item) => item.id === where.id && item.usuarioId === where.usuarioId && item.latitude === null);
          if (!row) return { count: 0 }; Object.assign(row, data); return { count: 1 };
        }),
      },
      configuracaoLojaEntrega: {
        findFirst: jest.fn(async () => config),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => { config = { id: addressId, ...data }; return config; }),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => { config = { ...config, ...data }; return config; }),
      },
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(prisma).compile();
    app = moduleRef.createNestApplication(); await app.init();
  });

  afterAll(async () => app.close());
  beforeEach(() => {
    rows = []; config = null; user.mockImplementation(async ({ where }: { where: { id: string } }) =>
      ({ id: where.id, perfil: where.id === a || where.id === b ? PerfilUsuario.CLIENTE : where.id === addressId2 ? PerfilUsuario.ENTREGADOR : PerfilUsuario.ADMIN }));
    fetchMock = jest.spyOn(global, 'fetch');
    delete process.env.GEOCODE_MAPS_CO_API_KEY;
  });
  afterEach(() => fetchMock.mockRestore());

  const body = { rua: ' Rua A ', numero: ' 12 ', bairro: ' Centro ', cidade: ' Curitiba ', cep: '80000-000', complemento: ' ', referencia: null };

  it('cria múltiplos endereços normalizados e isola a listagem', async () => {
    const http = request(app.getHttpServer());
    const bearer = await auth(a, PerfilUsuario.CLIENTE);
    await http.post('/enderecos').set('Authorization', bearer).send(body).expect(201);
    await http.post('/enderecos').set('Authorization', bearer).send({ ...body, numero: '13' }).expect(201);
    const list = await http.get('/enderecos').set('Authorization', bearer).expect(200);
    expect(list.body).toHaveLength(2);
    expect(list.body[0]).toMatchObject({ rua: 'Rua A', numero: '12', cep: '80000000', complemento: null });
    expect(list.body[0]).not.toHaveProperty('usuarioId');
    expect(await http.get('/enderecos').set('Authorization', await auth(b, PerfilUsuario.CLIENTE)).expect(200)).toMatchObject({ body: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejeita entrada extra e CEP inválido; aplica 401 e 403', async () => {
    const http = request(app.getHttpServer());
    const bearer = await auth(a, PerfilUsuario.CLIENTE);
    await http.post('/enderecos').set('Authorization', bearer).send({ ...body, usuarioId: b }).expect(400);
    await http.post('/enderecos').set('Authorization', bearer).send({ ...body, cep: '123' }).expect(400);
    await http.post('/enderecos').set('Authorization', bearer).send({ ...body, rua: '  ' }).expect(400);
    await http.post('/enderecos').send(body).expect(401);
    await http.post('/enderecos').set('Authorization', await auth(addressId, PerfilUsuario.ADMIN)).send(body).expect(403);
    expect(rows).toHaveLength(0);
  });

  it('consulta ViaCEP sem gravar e preserva cadastro se fornecedor falhar', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ logradouro: 'Rua X', bairro: 'B', localidade: 'Curitiba', uf: 'PR' }), { status: 200 }));
    const http = request(app.getHttpServer()); const bearer = await auth(a, PerfilUsuario.CLIENTE);
    const found = await http.get('/enderecos/cep/80000-000').set('Authorization', bearer).expect(200);
    expect(found.body).toEqual({ cep: '80000000', rua: 'Rua X', bairro: 'B', cidade: 'Curitiba', uf: 'PR' });
    expect(rows).toHaveLength(0);
    fetchMock.mockResolvedValueOnce(new Response('{"erro":true}', { status: 200 }));
    await http.get('/enderecos/cep/80000-000').set('Authorization', bearer).expect(404);
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await http.get('/enderecos/cep/80000-000').set('Authorization', bearer).expect(503);
    await http.post('/enderecos').set('Authorization', bearer).send(body).expect(201);
    expect(rows).toHaveLength(1);
  });

  it('não consulta ViaCEP para formato inválido ou resposta malformada', async () => {
    const http = request(app.getHttpServer()); const bearer = await auth(a, PerfilUsuario.CLIENTE);
    await http.get('/enderecos/cep/123').set('Authorization', bearer).expect(400);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(new Response('invalid json', { status: 200 }));
    await http.get('/enderecos/cep/80000000').set('Authorization', bearer).expect(503);
    expect(rows).toHaveLength(0);
  });

  it('configura uma loja com Decimal string e RBAC', async () => {
    const http = request(app.getHttpServer());
    const admin = await auth(addressId, PerfilUsuario.ADMIN);
    await http.get('/admin/configuracao-loja-entrega').set('Authorization', admin).expect(404);
    const value = { latitudeLoja: '-25.0', longitudeLoja: '-49', raioMaximoAtendimento: '0', taxaBase: '5.00', valorPorQuilometro: '2.00' };
    const saved = await http.put('/admin/configuracao-loja-entrega').set('Authorization', admin).send(value).expect(200);
    expect(saved.body).toEqual({ latitudeLoja: '-25.000000', longitudeLoja: '-49.000000', raioMaximoAtendimento: '0.000', taxaBase: '5.00', valorPorQuilometro: '2.00' });
    await http.put('/admin/configuracao-loja-entrega').set('Authorization', admin).send(value).expect(200);
    await http.put('/admin/configuracao-loja-entrega').set('Authorization', admin).send({ ...value, taxaBase: '-1' }).expect(400);
    await http.put('/admin/configuracao-loja-entrega').set('Authorization', admin).send({ ...value, longitudeLoja: '180.000001' }).expect(400);
    await http.put('/admin/configuracao-loja-entrega').set('Authorization', await auth(a, PerfilUsuario.CLIENTE)).send(value).expect(403);
    await http.put('/admin/configuracao-loja-entrega').set('Authorization', await auth(addressId2, PerfilUsuario.ENTREGADOR)).send(value).expect(403);
    await http.put('/admin/configuracao-loja-entrega').send(value).expect(401);
    expect(config?.taxaBase).toEqual(new Prisma.Decimal('5.00'));
  });

  it('geocodifica só endereço próprio, não repete provider e preserva endereço em falha', async () => {
    const http = request(app.getHttpServer()); const bearer = await auth(a, PerfilUsuario.CLIENTE);
    await http.post('/enderecos').set('Authorization', bearer).send(body).expect(201);
    process.env.GEOCODE_MAPS_CO_API_KEY = 'test-secret';
    await http.post(`/enderecos/${addressId}/geocodificacao`).set('Authorization', await auth(b, PerfilUsuario.CLIENTE)).expect(404);
    fetchMock.mockResolvedValueOnce(new Response('[]', { status: 200 }));
    await http.post(`/enderecos/${addressId}/geocodificacao`).set('Authorization', bearer).expect(422);
    expect(rows[0].latitude).toBeNull();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([{ lat: '-25.1234567', lon: '-49.1234567' }, { lat: '-25', lon: '-49' }]), { status: 200 }));
    await http.post(`/enderecos/${addressId}/geocodificacao`).set('Authorization', bearer).expect(409);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([{ lat: '-25.1234567', lon: '-49.1234567' }]), { status: 200 }));
    const result = await http.post(`/enderecos/${addressId}/geocodificacao`).set('Authorization', bearer).expect(200);
    expect(result.body).toEqual({ latitude: '-25.123457', longitude: '-49.123457' });
    const calls = fetchMock.mock.calls.length;
    await http.post(`/enderecos/${addressId}/geocodificacao`).set('Authorization', bearer).expect(200);
    expect(fetchMock).toHaveBeenCalledTimes(calls);
    expect(JSON.stringify(result.body)).not.toContain('test-secret');
  });

  it('trata falhas do geocodificador sem gravar coordenada parcial ou expor chave', async () => {
    const http = request(app.getHttpServer()); const bearer = await auth(a, PerfilUsuario.CLIENTE);
    await http.post('/enderecos').set('Authorization', bearer).send(body).expect(201);
    const path = `/enderecos/${addressId}/geocodificacao`;
    await http.post(path).set('Authorization', bearer).expect(503);
    process.env.GEOCODE_MAPS_CO_API_KEY = 'test-secret';
    for (const response of [
      new Response('rate limited', { status: 429 }),
      new Response('server down', { status: 503 }),
      new Response('{broken', { status: 200 }),
      new Response(JSON.stringify([{ lat: '91', lon: '0' }]), { status: 200 }),
      new Response(JSON.stringify([{ lat: '-25' }]), { status: 200 }),
    ]) {
      fetchMock.mockResolvedValueOnce(response);
      const result = await http.post(path).set('Authorization', bearer).expect(503);
      expect(JSON.stringify(result.body)).not.toContain('test-secret');
      expect(rows[0]).toMatchObject({ latitude: null, longitude: null });
    }
    fetchMock.mockRejectedValueOnce(new Error('timeout'));
    await http.post(path).set('Authorization', bearer).expect(503);
    expect(rows[0]).toMatchObject({ latitude: null, longitude: null });
    expect(fetchMock.mock.calls[0][0].toString()).not.toContain('test-secret');
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe('Bearer test-secret');
  });
});

function visible(row: Record<string, unknown>) {
  const result = { ...row };
  delete result.usuarioId;
  return result;
}
