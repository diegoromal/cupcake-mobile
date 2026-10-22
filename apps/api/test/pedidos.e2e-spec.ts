import { ConflictException, INestApplication, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PerfilUsuario } from '../src/generated/prisma/enums';
import { PedidosService } from '../src/pedidos/pedidos.service';
import { PrismaService } from '../src/prisma/prisma.service';

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const enderecoId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('POST /pedidos', () => {
  let app: INestApplication;
  const criar = jest.fn();
  const user = jest.fn();
  const jwt = new JwtService();
  const token = (perfil: PerfilUsuario, sub = userId) => jwt.signAsync(
    { sub, perfil, type: 'access' },
    { secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m' },
  );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue({ usuario: { findUnique: user } })
      .overrideProvider(PedidosService).useValue({ criar }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    user.mockResolvedValue({ id: userId, perfil: PerfilUsuario.CLIENTE });
    criar.mockResolvedValue({ id: 'pedido', modalidade: 'RETIRADA', valorItens: '10.30',
      freteAplicado: '0.00', total: '10.30', enderecoEntregaSnapshot: null,
      itens: [{ produtoId: 'produto', quantidade: 1, precoAplicado: '10.30',
        subtotalAplicado: '10.30', personalizacoes: [{ nomeAplicado: 'Cobertura', ajusteValorAplicado: '0.20' }] }],
    });
  });

  it('exige sessão e perfil cliente', async () => {
    await request(app.getHttpServer()).post('/pedidos').send({ modalidade: 'RETIRADA' }).expect(401);
    const admin = await token(PerfilUsuario.ADMIN);
    user.mockResolvedValue({ id: userId, perfil: PerfilUsuario.ADMIN });
    await request(app.getHttpServer()).post('/pedidos').set('Authorization', `Bearer ${admin}`)
      .send({ modalidade: 'RETIRADA' }).expect(403);
    expect(criar).not.toHaveBeenCalled();
  });

  it('aceita retirada sem endereço e usa exclusivamente o usuário do token', async () => {
    const cliente = await token(PerfilUsuario.CLIENTE);
    const response = await request(app.getHttpServer()).post('/pedidos')
      .set('Authorization', `Bearer ${cliente}`).send({ modalidade: 'RETIRADA' }).expect(201);
    expect(criar).toHaveBeenCalledWith(userId, { modalidade: 'RETIRADA' });
    expect(response.body).toMatchObject({ freteAplicado: '0.00', total: '10.30',
      enderecoEntregaSnapshot: null,
      itens: [expect.objectContaining({ personalizacoes: [expect.objectContaining({ nomeAplicado: 'Cobertura' })] })] });
  });

  it('aceita entrega com endereço e rejeita campos comerciais e modalidade inconsistente', async () => {
    const cliente = await token(PerfilUsuario.CLIENTE);
    const post = (body: object) => request(app.getHttpServer()).post('/pedidos')
      .set('Authorization', `Bearer ${cliente}`).send(body);
    await post({ modalidade: 'ENTREGA', enderecoId }).expect(201);
    expect(criar).toHaveBeenCalledWith(userId, { modalidade: 'ENTREGA', enderecoId });
    for (const body of [
      { modalidade: 'ENTREGA' }, { modalidade: 'RETIRADA', enderecoId },
      { modalidade: 'DESCONHECIDA' }, { modalidade: 'RETIRADA', total: '0.01' },
      { modalidade: 'RETIRADA', usuarioId: userId },
      { modalidade: 'RETIRADA', carrinhoId: userId },
      { modalidade: 'RETIRADA', subtotal: '0.01' },
      { modalidade: 'RETIRADA', preco: '0.01' },
      { modalidade: 'ENTREGA', enderecoId, frete: '0.00' },
      { modalidade: 'ENTREGA', enderecoId, distanciaKm: '0.000' },
      { modalidade: 'RETIRADA', itens: [] },
    ]) await post(body).expect(400);
    expect(criar).toHaveBeenCalledTimes(1);
  });

  it('propaga 404, 409 e 503 sem expor detalhes internos', async () => {
    const cliente = await token(PerfilUsuario.CLIENTE);
    const post = () => request(app.getHttpServer()).post('/pedidos')
      .set('Authorization', `Bearer ${cliente}`).send({ modalidade: 'RETIRADA' });
    criar.mockRejectedValueOnce(new NotFoundException('Endereço não encontrado.'));
    await post().expect(404);
    criar.mockRejectedValueOnce(new ConflictException('Carrinho contém item indisponível ou inválido.'));
    const response = await post().expect(409);
    expect(JSON.stringify(response.body)).not.toMatch(/quantidadeReservada|Prisma|quantidadeFisica/);
    criar.mockRejectedValueOnce(new ServiceUnavailableException('Configuração de entrega indisponível.'));
    await post().expect(503);
  });

  it('mantém 409 HTTP para indisponibilidade da demanda agregada', async () => {
    const cliente = await token(PerfilUsuario.CLIENTE);
    criar.mockRejectedValueOnce(new ConflictException('Estoque indisponível.'));
    const response = await request(app.getHttpServer()).post('/pedidos')
      .set('Authorization', `Bearer ${cliente}`).send({ modalidade: 'RETIRADA' }).expect(409);
    expect(criar).toHaveBeenCalledWith(userId, { modalidade: 'RETIRADA' });
    expect(JSON.stringify(response.body)).not.toMatch(/quantidadeReservada|quantidadeFisica/);
  });
});
