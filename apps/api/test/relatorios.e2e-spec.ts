import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { PerfilUsuario } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { RelatoriosController } from '../src/relatorios/relatorios.controller';
import { RelatoriosService } from '../src/relatorios/relatorios.service';

describe('GET /admin/relatorios/vendas', () => {
  let app: INestApplication;
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const findUser = jest.fn();
  const vendas = jest.fn();
  const jwt = new JwtService();

  const token = (perfil: PerfilUsuario) => jwt.signAsync(
    { sub: userId, perfil, type: 'access' },
    { secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m' },
  );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
      controllers: [RelatoriosController],
      providers: [RelatoriosService],
    })
      .overrideProvider(PrismaService)
      .useValue({ usuario: { findUnique: findUser } })
      .overrideProvider(RelatoriosService)
      .useValue({ vendas })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    findUser.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      perfil: PerfilUsuario.ADMIN,
    }));
    vendas.mockResolvedValue({
      inicio: '2026-10-01', fim: '2026-10-31', totalVendido: '120.50', quantidadePedidos: 2,
      pedidos: [
        { id: 'order-1', statusAtual: 'ENTREGUE', total: '100.00' },
        { id: 'order-2', statusAtual: 'RETIRADO', total: '20.50' },
      ],
    });
  });

  it('exige ADMIN e entrega pedidos finalizados do período solicitado', async () => {
    await request(app.getHttpServer())
      .get('/admin/relatorios/vendas?inicio=2026-10-01&fim=2026-10-31')
      .expect(401);

    const cliente = await token(PerfilUsuario.CLIENTE);
    findUser.mockResolvedValueOnce({ id: userId, perfil: PerfilUsuario.CLIENTE });
    await request(app.getHttpServer())
      .get('/admin/relatorios/vendas?inicio=2026-10-01&fim=2026-10-31')
      .set('Authorization', `Bearer ${cliente}`)
      .expect(403);
    expect(vendas).not.toHaveBeenCalled();

    const admin = await token(PerfilUsuario.ADMIN);
    await request(app.getHttpServer())
      .get('/admin/relatorios/vendas?inicio=2026-10-01&fim=2026-10-31')
      .set('Authorization', `Bearer ${admin}`)
      .expect(200)
      .expect({
        inicio: '2026-10-01', fim: '2026-10-31', totalVendido: '120.50', quantidadePedidos: 2,
        pedidos: [
          { id: 'order-1', statusAtual: 'ENTREGUE', total: '100.00' },
          { id: 'order-2', statusAtual: 'RETIRADO', total: '20.50' },
        ],
      });
    expect(vendas).toHaveBeenCalledTimes(1);
    expect(vendas).toHaveBeenCalledWith({ inicio: '2026-10-01', fim: '2026-10-31' });
  });

  it('rejeita datas inválidas e parâmetros fora do contrato antes de consultar o relatório', async () => {
    const admin = await token(PerfilUsuario.ADMIN);
    const getRelatorio = () => request(app.getHttpServer()).get('/admin/relatorios/vendas')
      .set('Authorization', `Bearer ${admin}`);

    await getRelatorio().query({ inicio: '2026-02-30', fim: '2026-03-01' }).expect(400);
    await getRelatorio().query({ inicio: '2026-10-01', fim: '2026-10-31', exportar: 'pdf' }).expect(400);
    expect(vendas).not.toHaveBeenCalled();
  });
});
