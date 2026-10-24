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
const revisaoId = 'a'.repeat(64);

describe('POST /pedidos', () => {
  let app: INestApplication;
  const criar = jest.fn();
  const revisar = jest.fn();
  const listarParaAdministracao = jest.fn();
  const detalharParaAdministracao = jest.fn();
  const user = jest.fn();
  const jwt = new JwtService();
  const token = (perfil: PerfilUsuario, sub = userId) => jwt.signAsync(
    { sub, perfil, type: 'access' },
    { secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m' },
  );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue({ usuario: { findUnique: user } })
      .overrideProvider(PedidosService).useValue({ criar, revisar, listarParaAdministracao,
        detalharParaAdministracao }).compile();
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
    revisar.mockResolvedValue({ modalidade: 'RETIRADA', valorItens: '10.30',
      freteAplicado: '0.00', total: '10.30', revisaoId: 'a'.repeat(64),
      itens: [{ nome: 'Cupcake', quantidade: 1, personalizacoes: [] }] });
    listarParaAdministracao.mockResolvedValue([]);
    detalharParaAdministracao.mockResolvedValue({ id: userId, identificadorNegocio: 'PED-123' });
  });

  it('GET /admin/pedidos exige ADMIN e retorna a listagem autorizada', async () => {
    await request(app.getHttpServer()).get('/admin/pedidos').expect(401);
    const cliente = await token(PerfilUsuario.CLIENTE);
    await request(app.getHttpServer()).get('/admin/pedidos')
      .set('Authorization', `Bearer ${cliente}`).expect(403);
    const admin = await token(PerfilUsuario.ADMIN);
    user.mockResolvedValue({ id: userId, perfil: PerfilUsuario.ADMIN });
    await request(app.getHttpServer()).get('/admin/pedidos')
      .set('Authorization', `Bearer ${admin}`).expect(200).expect([]);
    expect(listarParaAdministracao).toHaveBeenCalledTimes(1);
  });

  it('GET /admin/pedidos/:id exige ADMIN, valida UUID e preserva 404', async () => {
    const path = `/admin/pedidos/${userId}`;
    await request(app.getHttpServer()).get(path).expect(401);
    const cliente = await token(PerfilUsuario.CLIENTE);
    await request(app.getHttpServer()).get(path)
      .set('Authorization', `Bearer ${cliente}`).expect(403);
    const admin = await token(PerfilUsuario.ADMIN);
    user.mockResolvedValue({ id: userId, perfil: PerfilUsuario.ADMIN });
    await request(app.getHttpServer()).get('/admin/pedidos/invalido')
      .set('Authorization', `Bearer ${admin}`).expect(400);
    await request(app.getHttpServer()).get(path)
      .set('Authorization', `Bearer ${admin}`).expect(200)
      .expect({ id: userId, identificadorNegocio: 'PED-123' });
    expect(detalharParaAdministracao).toHaveBeenCalledTimes(1);
    expect(detalharParaAdministracao).toHaveBeenCalledWith(userId);
    detalharParaAdministracao.mockRejectedValueOnce(new NotFoundException('Pedido não encontrado.'));
    await request(app.getHttpServer()).get(path)
      .set('Authorization', `Bearer ${admin}`).expect(404);
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
      .set('Authorization', `Bearer ${cliente}`).send({ modalidade: 'RETIRADA', revisaoId }).expect(201);
    expect(criar).toHaveBeenCalledWith(userId, { modalidade: 'RETIRADA', revisaoId });
    expect(response.body).toMatchObject({ freteAplicado: '0.00', total: '10.30',
      enderecoEntregaSnapshot: null,
      itens: [expect.objectContaining({ personalizacoes: [expect.objectContaining({ nomeAplicado: 'Cobertura' })] })] });
  });

  it('aceita entrega com endereço e rejeita campos comerciais e modalidade inconsistente', async () => {
    const cliente = await token(PerfilUsuario.CLIENTE);
    const post = (body: object) => request(app.getHttpServer()).post('/pedidos')
      .set('Authorization', `Bearer ${cliente}`).send(body);
    await post({ modalidade: 'ENTREGA', enderecoId, revisaoId }).expect(201);
    expect(criar).toHaveBeenCalledWith(userId, { modalidade: 'ENTREGA', enderecoId, revisaoId });
    await post({ modalidade: 'RETIRADA' }).expect(400);
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
      .set('Authorization', `Bearer ${cliente}`).send({ modalidade: 'RETIRADA', revisaoId });
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
      .set('Authorization', `Bearer ${cliente}`).send({ modalidade: 'RETIRADA', revisaoId }).expect(409);
    expect(criar).toHaveBeenCalledWith(userId, { modalidade: 'RETIRADA', revisaoId });
    expect(JSON.stringify(response.body)).not.toMatch(/quantidadeReservada|quantidadeFisica/);
  });

  it('POST /pedidos/revisao exige cliente e não chama criação', async () => {
    await request(app.getHttpServer()).post('/pedidos/revisao').send({ modalidade: 'RETIRADA' }).expect(401);
    const admin = await token(PerfilUsuario.ADMIN);
    user.mockResolvedValue({ id: userId, perfil: PerfilUsuario.ADMIN });
    await request(app.getHttpServer()).post('/pedidos/revisao')
      .set('Authorization', `Bearer ${admin}`).send({ modalidade: 'RETIRADA' }).expect(403);
    user.mockResolvedValue({ id: userId, perfil: PerfilUsuario.CLIENTE });
    const cliente = await token(PerfilUsuario.CLIENTE);
    const result = await request(app.getHttpServer()).post('/pedidos/revisao')
      .set('Authorization', `Bearer ${cliente}`).send({ modalidade: 'RETIRADA' }).expect(201);
    expect(result.body).toMatchObject({ total: '10.30', revisaoId: 'a'.repeat(64) });
    expect(revisar).toHaveBeenCalledWith(userId, { modalidade: 'RETIRADA' });
    expect(criar).not.toHaveBeenCalled();
  });

  it('POST /pedidos/revisao valida modalidade, endereço e propaga 404/409/503', async () => {
    const cliente = await token(PerfilUsuario.CLIENTE);
    const post = (body: object) => request(app.getHttpServer()).post('/pedidos/revisao')
      .set('Authorization', `Bearer ${cliente}`).send(body);
    await post({ modalidade: 'ENTREGA', enderecoId }).expect(201);
    expect(revisar).toHaveBeenCalledWith(userId, { modalidade: 'ENTREGA', enderecoId });
    await post({ modalidade: 'ENTREGA' }).expect(400);
    await post({ modalidade: 'RETIRADA', enderecoId }).expect(400);
    await post({ modalidade: 'RETIRADA', total: '0.01' }).expect(400);
    revisar.mockRejectedValueOnce(new NotFoundException('Endereço não encontrado.'));
    await post({ modalidade: 'ENTREGA', enderecoId }).expect(404);
    revisar.mockRejectedValueOnce(new ConflictException('Estoque indisponível.'));
    await post({ modalidade: 'RETIRADA' }).expect(409);
    revisar.mockRejectedValueOnce(new ServiceUnavailableException('Entrega indisponível.'));
    await post({ modalidade: 'ENTREGA', enderecoId }).expect(503);
    expect(criar).not.toHaveBeenCalled();
  });
});
