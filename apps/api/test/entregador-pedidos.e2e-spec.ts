import { ConflictException, INestApplication, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PerfilUsuario } from '../src/generated/prisma/enums';
import { PedidosService } from '../src/pedidos/pedidos.service';
import { PrismaService } from '../src/prisma/prisma.service';

const courierId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('GET /entregador/pedidos', () => {
  let app: INestApplication;
  const findUser = jest.fn();
  const list = jest.fn();
  const detail = jest.fn();
  const confirm = jest.fn();
  const jwt = new JwtService();
  const token = (profile: PerfilUsuario) => jwt.signAsync(
    { sub: courierId, perfil: profile, type: 'access' },
    { secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m' },
  );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue({ usuario: { findUnique: findUser } })
      .overrideProvider(PedidosService).useValue({
        listarParaEntregador: list, detalharParaEntregador: detail, confirmarEntrega: confirm,
      })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    findUser.mockResolvedValue({ id: courierId, perfil: PerfilUsuario.ENTREGADOR });
    list.mockResolvedValue([
      { id: otherId, identificadorNegocio: 'PED-42', statusAtual: 'ENTREGUE' },
    ]);
    detail.mockResolvedValue({
      identificadorNegocio: 'PED-42',
      cliente: { nome: 'Cliente', telefone: '11999999999' },
      enderecoEntregaSnapshot: {
        rua: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'São Paulo',
        cep: '01001000', complemento: null, referencia: 'Portaria',
      },
      dataHoraSaidaParaEntrega: '2026-10-25T12:34:00.000Z',
    });
    confirm.mockResolvedValue({ statusAtual: 'ENTREGUE', dataHora: '2026-10-25T12:34:00.000Z' });
  });

  it('exige autenticação e perfil ENTREGADOR', async () => {
    await request(app.getHttpServer()).get('/entregador/pedidos').expect(401);
    for (const profile of [PerfilUsuario.CLIENTE, PerfilUsuario.ADMIN]) {
      findUser.mockResolvedValueOnce({ id: courierId, perfil: profile });
      await request(app.getHttpServer()).get('/entregador/pedidos')
        .set('Authorization', `Bearer ${await token(profile)}`).expect(403);
    }
    expect(list).not.toHaveBeenCalled();
  });

  it('usa exclusivamente o sujeito do JWT e retorna só o resumo', async () => {
    await request(app.getHttpServer())
      .get(`/entregador/pedidos?entregadorUsuarioId=${otherId}`)
      .set('Authorization', `Bearer ${await token(PerfilUsuario.ENTREGADOR)}`)
      .expect(200)
      .expect([{ id: otherId, identificadorNegocio: 'PED-42', statusAtual: 'ENTREGUE' }]);
    expect(list).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledWith(courierId);
  });

  it('detalhe exige autenticação, perfil e UUID', async () => {
    await request(app.getHttpServer()).get(`/entregador/pedidos/${otherId}`).expect(401);
    for (const profile of [PerfilUsuario.CLIENTE, PerfilUsuario.ADMIN]) {
      findUser.mockResolvedValueOnce({ id: courierId, perfil: profile });
      await request(app.getHttpServer()).get(`/entregador/pedidos/${otherId}`)
        .set('Authorization', `Bearer ${await token(profile)}`).expect(403);
    }
    await request(app.getHttpServer()).get('/entregador/pedidos/invalid')
      .set('Authorization', `Bearer ${await token(PerfilUsuario.ENTREGADOR)}`).expect(400);
    expect(detail).not.toHaveBeenCalled();
  });

  it('detalhe passa somente id da rota e sujeito do JWT, com projeção restrita', async () => {
    const response = await request(app.getHttpServer())
      .get(`/entregador/pedidos/${otherId}?entregadorUsuarioId=${otherId}`)
      .set('Authorization', `Bearer ${await token(PerfilUsuario.ENTREGADOR)}`)
      .expect(200);
    expect(detail).toHaveBeenCalledWith(otherId, courierId);
    expect(response.body).toEqual({
      identificadorNegocio: 'PED-42',
      cliente: { nome: 'Cliente', telefone: '11999999999' },
      enderecoEntregaSnapshot: {
        rua: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'São Paulo',
        cep: '01001000', complemento: null, referencia: 'Portaria',
      },
      dataHoraSaidaParaEntrega: '2026-10-25T12:34:00.000Z',
    });
  });

  it('detalhe não distingue ausente, alheio ou retirada', async () => {
    detail.mockRejectedValue(new NotFoundException('Pedido não encontrado.'));
    await request(app.getHttpServer()).get(`/entregador/pedidos/${otherId}`)
      .set('Authorization', `Bearer ${await token(PerfilUsuario.ENTREGADOR)}`).expect(404);
  });

  it('confirmação exige autenticação, perfil e UUID', async () => {
    await request(app.getHttpServer()).patch(`/entregador/pedidos/${otherId}/confirmar-entrega`).expect(401);
    for (const profile of [PerfilUsuario.CLIENTE, PerfilUsuario.ADMIN]) {
      findUser.mockResolvedValueOnce({ id: courierId, perfil: profile });
      await request(app.getHttpServer()).patch(`/entregador/pedidos/${otherId}/confirmar-entrega`)
        .set('Authorization', `Bearer ${await token(profile)}`).expect(403);
    }
    await request(app.getHttpServer()).patch('/entregador/pedidos/invalid/confirmar-entrega')
      .set('Authorization', `Bearer ${await token(PerfilUsuario.ENTREGADOR)}`).expect(400);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('confirmação usa somente id da rota e sujeito do JWT', async () => {
    await request(app.getHttpServer()).patch(`/entregador/pedidos/${otherId}/confirmar-entrega`)
      .set('Authorization', `Bearer ${await token(PerfilUsuario.ENTREGADOR)}`)
      .send({ statusAtual: 'ENTREGUE', dataHora: '2099-01-01', entregadorUsuarioId: otherId })
      .expect(200)
      .expect({ statusAtual: 'ENTREGUE', dataHora: '2026-10-25T12:34:00.000Z' });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith(otherId, courierId);
  });

  it('confirmação propaga 404 sem revelar existência e 409 para inelegível', async () => {
    confirm.mockRejectedValueOnce(new NotFoundException('Pedido não encontrado.'));
    await request(app.getHttpServer()).patch(`/entregador/pedidos/${otherId}/confirmar-entrega`)
      .set('Authorization', `Bearer ${await token(PerfilUsuario.ENTREGADOR)}`).expect(404);
    confirm.mockRejectedValueOnce(new ConflictException('Status inválido.'));
    await request(app.getHttpServer()).patch(`/entregador/pedidos/${otherId}/confirmar-entrega`)
      .set('Authorization', `Bearer ${await token(PerfilUsuario.ENTREGADOR)}`).expect(409);
  });
});
