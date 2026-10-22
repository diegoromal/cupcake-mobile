import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Prisma } from '../src/generated/prisma/client';
import { PerfilUsuario } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';

const clienteA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const clienteB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const administrador = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const enderecoA = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const enderecoB = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const inexistente = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const decimal = (value: string) => new Prisma.Decimal(value);

describe('D42–D44 consulta de cobertura e frete', () => {
  let app: INestApplication;
  let coordenadas: { latitude: Prisma.Decimal | null; longitude: Prisma.Decimal | null };
  let configuracao: {
    latitudeLoja: Prisma.Decimal; longitudeLoja: Prisma.Decimal;
    raioMaximoAtendimento: Prisma.Decimal; taxaBase: Prisma.Decimal; valorPorQuilometro: Prisma.Decimal;
  } | null;
  const leituraEndereco = jest.fn();
  const leituraConfiguracao = jest.fn();
  const escrita = jest.fn(() => { throw new Error('Escrita inesperada'); });
  const fetchMock = jest.fn(() => { throw new Error('Geocodificação inesperada'); });
  const jwt = new JwtService();
  const auth = async (id: string, perfil: PerfilUsuario) => `Bearer ${await jwt.signAsync(
    { sub: id, perfil, type: 'access' },
    { secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m' },
  )}`;
  const path = (id = enderecoA) => `/enderecos/${id}/cobertura-frete`;

  beforeAll(async () => {
    const prisma = {
      usuario: { findUnique: jest.fn(async ({ where }: { where: { id: string } }) => ({
        id: where.id, perfil: where.id === administrador ? PerfilUsuario.ADMIN : PerfilUsuario.CLIENTE,
      })) },
      endereco: {
        findFirst: leituraEndereco, create: escrita, update: escrita, updateMany: escrita,
        delete: escrita, deleteMany: escrita,
      },
      configuracaoLojaEntrega: {
        findFirst: leituraConfiguracao, create: escrita, update: escrita, updateMany: escrita,
        delete: escrita, deleteMany: escrita,
      },
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(prisma).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());
  beforeEach(() => {
    coordenadas = { latitude: decimal('0.000000'), longitude: decimal('1.000000') };
    configuracao = {
      latitudeLoja: decimal('0.000000'), longitudeLoja: decimal('0.000000'),
      raioMaximoAtendimento: decimal('200.000'), taxaBase: decimal('5.00'),
      valorPorQuilometro: decimal('2.00'),
    };
    leituraEndereco.mockReset().mockImplementation(async ({ where }: { where: { id: string; usuarioId: string } }) =>
      where.id === enderecoA && where.usuarioId === clienteA || where.id === enderecoB && where.usuarioId === clienteB
        ? coordenadas : null);
    leituraConfiguracao.mockReset().mockImplementation(async () => configuracao);
    escrita.mockClear();
    fetchMock.mockClear();
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock as typeof fetch);
  });
  afterEach(() => jest.restoreAllMocks());

  it('calcula distância geodésica e frete com coordenadas persistidas e precisão de apresentação', async () => {
    const response = await request(app.getHttpServer()).get(path())
      .set('Authorization', await auth(clienteA, PerfilUsuario.CLIENTE)).expect(200);
    expect(response.body).toEqual({ situacao: 'ATENDIDO', distanciaKm: '111.195', raioMaximoKm: '200.000', frete: '227.39' });
    expect(leituraEndereco).toHaveBeenCalledWith({
      where: { id: enderecoA, usuarioId: clienteA }, select: { latitude: true, longitude: true },
    });
    expect(response.text).not.toMatch(/latitude|longitude|taxaBase|valorPorQuilometro|usuarioId/);
  });

  it('trata mesma coordenada, raio zero e frete só com taxa base', async () => {
    coordenadas.longitude = decimal('0.000000');
    configuracao!.raioMaximoAtendimento = decimal('0.000');
    const response = await request(app.getHttpServer()).get(path())
      .set('Authorization', await auth(clienteA, PerfilUsuario.CLIENTE)).expect(200);
    expect(response.body).toEqual({ situacao: 'ATENDIDO', distanciaKm: '0.000', raioMaximoKm: '0.000', frete: '5.00' });
  });

  it('calcula pontos em hemisférios diferentes', async () => {
    coordenadas = { latitude: decimal('-1.000000'), longitude: decimal('-1.000000') };
    configuracao!.latitudeLoja = decimal('1.000000');
    configuracao!.longitudeLoja = decimal('1.000000');
    configuracao!.raioMaximoAtendimento = decimal('500.000');
    const response = await request(app.getHttpServer()).get(path())
      .set('Authorization', await auth(clienteA, PerfilUsuario.CLIENTE)).expect(200);
    expect(response.body.situacao).toBe('ATENDIDO');
    expect(Number(response.body.distanciaKm)).toBeCloseTo(314.499, 2);
  });

  it('considera a fronteira inclusiva e rejeita distância imediatamente fora do raio sem arredondar antes', async () => {
    coordenadas.longitude = decimal('0.000000');
    configuracao!.raioMaximoAtendimento = decimal('0.000');
    const bearer = await auth(clienteA, PerfilUsuario.CLIENTE);
    await request(app.getHttpServer()).get(path()).set('Authorization', bearer).expect(200)
      .expect(({ body }) => expect(body.situacao).toBe('ATENDIDO'));
    coordenadas.longitude = decimal('0.000001');
    const response = await request(app.getHttpServer()).get(path()).set('Authorization', bearer).expect(200);
    expect(response.body).toEqual({ situacao: 'FORA_DA_COBERTURA', distanciaKm: '0.000', raioMaximoKm: '0.000', frete: null });
  });

  it('não usa distância apresentada no cálculo monetário e aceita valor por km zero', async () => {
    coordenadas.longitude = decimal('0.000004');
    configuracao!.taxaBase = decimal('0.00');
    configuracao!.valorPorQuilometro = decimal('100.00');
    const bearer = await auth(clienteA, PerfilUsuario.CLIENTE);
    const precise = await request(app.getHttpServer()).get(path()).set('Authorization', bearer).expect(200);
    expect(precise.body).toMatchObject({ distanciaKm: '0.000', frete: '0.04' });
    configuracao!.valorPorQuilometro = decimal('0.00');
    configuracao!.taxaBase = decimal('7.35');
    const zeroPerKm = await request(app.getHttpServer()).get(path()).set('Authorization', bearer).expect(200);
    expect(zeroPerKm.body.frete).toBe('7.35');
  });

  it('reflete a configuração atual na próxima consulta', async () => {
    const bearer = await auth(clienteA, PerfilUsuario.CLIENTE);
    const first = await request(app.getHttpServer()).get(path()).set('Authorization', bearer).expect(200);
    configuracao!.taxaBase = decimal('8.00');
    configuracao!.raioMaximoAtendimento = decimal('100.000');
    const second = await request(app.getHttpServer()).get(path()).set('Authorization', bearer).expect(200);
    expect(first.body.frete).toBe('227.39');
    expect(second.body).toEqual({ situacao: 'FORA_DA_COBERTURA', distanciaKm: '111.195', raioMaximoKm: '100.000', frete: null });
    expect(leituraConfiguracao).toHaveBeenCalledTimes(2);
  });

  it('não presume configuração ausente ou inválida', async () => {
    const bearer = await auth(clienteA, PerfilUsuario.CLIENTE);
    configuracao = null;
    await request(app.getHttpServer()).get(path()).set('Authorization', bearer).expect(503);
    configuracao = {
      latitudeLoja: decimal('91'), longitudeLoja: decimal('0'), raioMaximoAtendimento: decimal('1'),
      taxaBase: decimal('5'), valorPorQuilometro: decimal('2'),
    };
    await request(app.getHttpServer()).get(path()).set('Authorization', bearer).expect(503);
    configuracao.latitudeLoja = decimal('0');
    configuracao.taxaBase = decimal('-1');
    await request(app.getHttpServer()).get(path()).set('Authorization', bearer).expect(503);
  });

  it('retorna localização indisponível para coordenadas ausentes sem consultar configuração', async () => {
    coordenadas.longitude = null;
    const response = await request(app.getHttpServer()).get(path())
      .set('Authorization', await auth(clienteA, PerfilUsuario.CLIENTE)).expect(200);
    expect(response.body).toEqual({ situacao: 'LOCALIZACAO_INDISPONIVEL', distanciaKm: null, raioMaximoKm: null, frete: null });
    expect(leituraConfiguracao).not.toHaveBeenCalled();
  });

  it('preserva 404 indistinguível, 401 e 403', async () => {
    const http = request(app.getHttpServer());
    const bearer = await auth(clienteA, PerfilUsuario.CLIENTE);
    const missing = await http.get(path(inexistente)).set('Authorization', bearer).expect(404);
    const other = await http.get(path(enderecoB)).set('Authorization', bearer).expect(404);
    expect(other.body).toEqual(missing.body);
    await http.get(path()).expect(401);
    await http.get(path()).set('Authorization', await auth(administrador, PerfilUsuario.ADMIN)).expect(403);
    expect(leituraConfiguracao).not.toHaveBeenCalled();
  });

  it('faz somente leituras no fluxo e não chama fornecedor externo', async () => {
    await request(app.getHttpServer()).get(path())
      .set('Authorization', await auth(clienteA, PerfilUsuario.CLIENTE)).expect(200);
    expect(escrita).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
