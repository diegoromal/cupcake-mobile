import { INestApplication } from '@nestjs/common';
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
  const jwt = new JwtService();
  const token = (profile: PerfilUsuario) => jwt.signAsync(
    { sub: courierId, perfil: profile, type: 'access' },
    { secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m' },
  );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue({ usuario: { findUnique: findUser } })
      .overrideProvider(PedidosService).useValue({ listarParaEntregador: list })
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
});
