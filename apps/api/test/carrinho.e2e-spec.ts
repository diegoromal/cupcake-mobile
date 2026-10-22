import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Prisma } from '../src/generated/prisma/client';
import { PerfilUsuario } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { memoriaIds, novaMemoria, prismaDaMemoria, type MemoriaCarrinho } from './carrinho-memoria';

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const produtoId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const cartId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const itemId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const secondItemId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const optionId = '11111111-1111-4111-8111-111111111111';

describe('POST /carrinho/itens', () => {
  let app: INestApplication;
  const user = jest.fn();
  const produtoFind = jest.fn();
  const estoqueFind = jest.fn();
  const personalizacaoFindMany = jest.fn();
  const linkFindMany = jest.fn();
  const carrinhoFind = jest.fn();
  const carrinhoCreate = jest.fn();
  const itemCreate = jest.fn();
  const itemUpdate = jest.fn();
  const itemFindMany = jest.fn();
  const itemFindFirst = jest.fn();
  const itemUpdateMany = jest.fn();
  const itemDeleteMany = jest.fn();
  const itemOptionDelete = jest.fn();
  const carrinhoDelete = jest.fn();
  const estoqueUpdate = jest.fn();
  const reservaCreate = jest.fn();
  const jwt = new JwtService();
  const token = (perfil: PerfilUsuario, sub = userId) => jwt.signAsync(
    { sub, perfil, type: 'access' },
    { secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m' },
  );
  let cart: { id: string } | null;
  let itemIds: string[];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue({
        usuario: { findUnique: user },
        produto: { findUnique: produtoFind },
        estoque: { findUnique: estoqueFind, update: estoqueUpdate },
        personalizacao: { findMany: personalizacaoFindMany },
        produtoPersonalizacao: { findMany: linkFindMany },
        carrinho: { findUnique: carrinhoFind, create: carrinhoCreate, delete: carrinhoDelete },
        itemCarrinho: {
          create: itemCreate, update: itemUpdate, findMany: itemFindMany,
          findFirst: itemFindFirst, updateMany: itemUpdateMany, deleteMany: itemDeleteMany,
        },
        itemCarrinhoPersonalizacao: { delete: itemOptionDelete },
        reservaEstoque: { create: reservaCreate },
      }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    itemFindFirst.mockResolvedValue(null);
    itemUpdateMany.mockResolvedValue({ count: 0 });
    itemDeleteMany.mockResolvedValue({ count: 0 });
    cart = null;
    itemIds = [itemId, secondItemId];
    user.mockResolvedValue({ id: userId, perfil: PerfilUsuario.CLIENTE });
    produtoFind.mockResolvedValue({ id: produtoId });
    estoqueFind.mockResolvedValue({ quantidadeFisica: 5, quantidadeReservada: 0 });
    personalizacaoFindMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) =>
      where.id.in.map((id) => ({ id })));
    linkFindMany.mockImplementation(async ({ where }: { where: { personalizacaoId: { in: string[] } } }) =>
      where.personalizacaoId.in.map((personalizacaoId) => ({ personalizacaoId })));
    carrinhoFind.mockImplementation(async () => cart);
    carrinhoCreate.mockImplementation(async () => {
      cart = { id: cartId };
      return cart;
    });
    itemCreate.mockImplementation(async ({ data }: {
      data: {
        carrinhoId: string;
        produtoId: string;
        quantidade: number;
        personalizacoes: { create: Array<{ personalizacaoId: string }> };
      };
    }) => ({
      id: itemIds.shift() ?? itemId,
      carrinhoId: data.carrinhoId,
      produtoId: data.produtoId,
      quantidade: data.quantidade,
      personalizacoes: data.personalizacoes.create.map((row) => ({
        personalizacaoId: row.personalizacaoId,
      })),
    }));
  });

  const body = { produtoId, quantidade: 1, personalizacaoIds: [optionId] };

  it('cria o item em 201 e um segundo POST devolve outro id', async () => {
    const http = request(app.getHttpServer());
    const bearer = `Bearer ${await token(PerfilUsuario.CLIENTE)}`;
    const first = await http.post('/carrinho/itens').set('Authorization', bearer).send(body).expect(201);
    const second = await http.post('/carrinho/itens').set('Authorization', bearer)
      .send({ ...body, quantidade: 2 }).expect(201);
    expect(first.body).toEqual({
      id: itemId, carrinhoId: cartId, produtoId, quantidade: 1, personalizacaoIds: [optionId],
    });
    expect(second.body).toEqual({
      id: secondItemId, carrinhoId: cartId, produtoId, quantidade: 2, personalizacaoIds: [optionId],
    });
    expect(first.body.id).not.toBe(second.body.id);
    expect(carrinhoCreate).toHaveBeenCalledTimes(1);
    expect(carrinhoCreate).toHaveBeenCalledWith({
      data: { usuarioId: userId }, select: { id: true },
    });
    expect(itemCreate).toHaveBeenCalledTimes(2);
    expect(itemUpdate).not.toHaveBeenCalled();
    expect(itemFindMany).not.toHaveBeenCalled();
  });

  it('responde 201 com o uuid canônico e 409 para o mesmo uuid em outra caixa', async () => {
    const http = request(app.getHttpServer());
    const bearer = `Bearer ${await token(PerfilUsuario.CLIENTE)}`;
    const created = await http.post('/carrinho/itens').set('Authorization', bearer)
      .send({ ...body, personalizacaoIds: [optionId.toUpperCase()] }).expect(201);
    expect(created.body.personalizacaoIds).toEqual([optionId]);
    expect(itemCreate.mock.calls[0][0].data.personalizacoes).toEqual({
      create: [{ personalizacaoId: optionId }],
    });
    const duplicate = await http.post('/carrinho/itens').set('Authorization', bearer)
      .send({ ...body, personalizacaoIds: [optionId, optionId.toUpperCase()] }).expect(409);
    expect(duplicate.body.message).toBe('Seleção de personalizações inválida.');
    expect(itemCreate).toHaveBeenCalledTimes(1);
  });

  it('responde 401 sem token e 403 para ADMIN e ENTREGADOR', async () => {
    const http = request(app.getHttpServer());
    const anonymous = await http.post('/carrinho/itens').send(body).expect(401);
    expect(anonymous.body.message).toBe('Access token inválido.');
    for (const perfil of [PerfilUsuario.ADMIN, PerfilUsuario.ENTREGADOR]) {
      user.mockResolvedValue({ id: userId, perfil });
      const response = await http.post('/carrinho/itens')
        .set('Authorization', `Bearer ${await token(perfil)}`).send(body).expect(403);
      expect(response.body.message).toBe('Acesso negado.');
    }
    expect(itemCreate).not.toHaveBeenCalled();
    expect(carrinhoCreate).not.toHaveBeenCalled();
  });

  it('responde 400 sem persistir quantidade inválida nem campo extra', async () => {
    const http = request(app.getHttpServer());
    const bearer = `Bearer ${await token(PerfilUsuario.CLIENTE)}`;
    const payloads = [
      { ...body, quantidade: 0 },
      { ...body, quantidade: -1 },
      { ...body, quantidade: 2147483648 },
      { ...body, produtoId: 'invalid' },
      { ...body, usuarioId: userId },
      { ...body, carrinhoId: cartId },
      { produtoId, quantidade: 1 },
    ];
    for (const payload of payloads) {
      await http.post('/carrinho/itens').set('Authorization', bearer).send(payload).expect(400);
    }
    expect(produtoFind).not.toHaveBeenCalled();
    expect(carrinhoCreate).not.toHaveBeenCalled();
    expect(itemCreate).not.toHaveBeenCalled();
  });

  const otherId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const aroma = '33333333-3333-4333-8333-333333333333';
  const cremeB = '22222222-2222-4222-8222-222222222222';
  const managed = `produtos/${produtoId}/11111111-1111-4111-8111-111111111111.webp`;

  function keysOf(value: unknown, found = new Set<string>()): Set<string> {
    if (Array.isArray(value)) {
      for (const item of value) keysOf(item, found);
      return found;
    }
    if (value !== null && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        found.add(key);
        keysOf(child, found);
      }
    }
    return found;
  }

  function leituraE2e(input: {
    id: string;
    quantidade: number;
    preco?: string;
    imagem?: string | null;
    ativo?: boolean;
    opcoes?: Array<{ id: string; nome: string; ajuste?: string | null; disponivel?: boolean }>;
  }) {
    const opcoes = input.opcoes ?? [];
    return {
      id: input.id,
      produtoId,
      quantidade: input.quantidade,
      produto: {
        nome: 'Cupcake de festa',
        imagem: input.imagem === undefined ? null : input.imagem,
        ativo: input.ativo ?? true,
        precoAtual: new Prisma.Decimal(input.preco ?? '10.00'),
        estoque: { quantidadeFisica: 10, quantidadeReservada: 0 },
        personalizacoes: opcoes.map((opcao) => ({ personalizacaoId: opcao.id })),
      },
      personalizacoes: opcoes.map((opcao) => ({
        personalizacao: {
          id: opcao.id,
          nome: opcao.nome,
          disponibilidade: opcao.disponivel ?? true,
          ajusteValor: opcao.ajuste == null ? null : new Prisma.Decimal(opcao.ajuste),
        },
      })),
    };
  }

  it('devolve o carrinho do cliente com preço, subtotal e total vigentes', async () => {
    carrinhoFind.mockResolvedValue({
      id: cartId,
      itens: [
        leituraE2e({ id: secondItemId, quantidade: 4, preco: '8.00', imagem: null }),
        leituraE2e({
          id: itemId, quantidade: 1, preco: '10.00', imagem: managed,
          opcoes: [
            { id: optionId, nome: 'Creme', ajuste: '0.10' },
            { id: aroma, nome: 'Aroma', ajuste: '-0.20' },
            { id: cremeB, nome: 'Creme', ajuste: null },
          ],
        }),
      ],
    });
    const response = await request(app.getHttpServer())
      .get('/carrinho')
      .query({ usuarioId: otherId, carrinhoId: cartId })
      .set('Authorization', `Bearer ${await token(PerfilUsuario.CLIENTE)}`)
      .expect(200);
    expect(response.body).toEqual({
      id: cartId,
      subtotal: '41.90',
      total: '41.90',
      itens: [
        {
          id: itemId, produtoId, nome: 'Cupcake de festa', imagemDisponivel: true, quantidade: 1,
          precoUnitario: '9.90', subtotal: '9.90', disponivel: true, motivo: null,
          personalizacoes: [
            { id: aroma, nome: 'Aroma' },
            { id: optionId, nome: 'Creme' },
            { id: cremeB, nome: 'Creme' },
          ],
        },
        {
          id: secondItemId, produtoId, nome: 'Cupcake de festa', imagemDisponivel: false, quantidade: 4,
          precoUnitario: '8.00', subtotal: '32.00', disponivel: true, motivo: null,
          personalizacoes: [],
        },
      ],
    });
    expect(response.body.itens[0].id).not.toBe(response.body.itens[1].id);
    expect([...keysOf(response.body)].sort()).toEqual([
      'disponivel', 'id', 'imagemDisponivel', 'itens', 'motivo', 'nome', 'personalizacoes',
      'precoUnitario', 'produtoId', 'quantidade', 'subtotal', 'total',
    ]);
    expect(carrinhoFind).toHaveBeenCalledWith(expect.objectContaining({
      where: { usuarioId: userId },
    }));
    expect(carrinhoCreate).not.toHaveBeenCalled();
    expect(itemCreate).not.toHaveBeenCalled();
    expect(itemUpdate).not.toHaveBeenCalled();
    expect(estoqueFind).not.toHaveBeenCalled();
    expect(produtoFind).not.toHaveBeenCalled();
  });

  it('mantém GET /carrinho disponível acima do limite monetário do pedido', async () => {
    carrinhoFind.mockResolvedValue({ id: cartId, itens: [
      leituraE2e({ id: itemId, quantidade: 1, preco: '9999999999.99',
        opcoes: [{ id: optionId, nome: 'Extra', ajuste: '0.01' }] }),
      leituraE2e({ id: secondItemId, quantidade: 2, preco: '9999999999.99' }),
    ] });
    const response = await request(app.getHttpServer()).get('/carrinho')
      .set('Authorization', `Bearer ${await token(PerfilUsuario.CLIENTE)}`).expect(200);
    expect(response.body.itens).toEqual([
      expect.objectContaining({ id: itemId, precoUnitario: '10000000000.00',
        subtotal: '10000000000.00', disponivel: true }),
      expect.objectContaining({ id: secondItemId, precoUnitario: '9999999999.99',
        subtotal: '19999999999.98', disponivel: true }),
    ]);
    expect(response.body).toMatchObject({ subtotal: '29999999999.98', total: '29999999999.98' });
  });

  it('devolve carrinho vazio ou inexistente em 200 e não cria carrinho', async () => {
    const http = request(app.getHttpServer());
    const bearer = `Bearer ${await token(PerfilUsuario.CLIENTE)}`;
    const missing = await http.get('/carrinho').set('Authorization', bearer).expect(200);
    expect(missing.body).toEqual({ id: null, itens: [], subtotal: '0.00', total: '0.00' });
    expect(carrinhoCreate).not.toHaveBeenCalled();
    carrinhoFind.mockResolvedValue({ id: cartId, itens: [] });
    const empty = await http.get('/carrinho').set('Authorization', bearer).expect(200);
    expect(empty.body).toEqual({ id: cartId, itens: [], subtotal: '0.00', total: '0.00' });
    expect(carrinhoCreate).not.toHaveBeenCalled();
    expect(itemCreate).not.toHaveBeenCalled();
  });

  it('nega o carrinho de outro usuário, anônimo e perfil sem CLIENTE', async () => {
    carrinhoFind.mockImplementation(async ({ where }: { where: { usuarioId: string } }) =>
      where.usuarioId === userId ? { id: cartId, itens: [] } : null);
    const http = request(app.getHttpServer());
    user.mockResolvedValue({ id: otherId, perfil: PerfilUsuario.CLIENTE });
    const foreign = await http.get('/carrinho')
      .query({ usuarioId: userId, carrinhoId: cartId })
      .set('Authorization', `Bearer ${await token(PerfilUsuario.CLIENTE, otherId)}`)
      .expect(200);
    expect(foreign.body).toEqual({ id: null, itens: [], subtotal: '0.00', total: '0.00' });
    expect(carrinhoFind).toHaveBeenCalledWith(expect.objectContaining({
      where: { usuarioId: otherId },
    }));
    const anonymous = await http.get('/carrinho').expect(401);
    expect(anonymous.body.message).toBe('Access token inválido.');
    for (const perfil of [PerfilUsuario.ADMIN, PerfilUsuario.ENTREGADOR]) {
      user.mockResolvedValue({ id: userId, perfil });
      const response = await http.get('/carrinho')
        .set('Authorization', `Bearer ${await token(perfil)}`).expect(403);
      expect(response.body.message).toBe('Acesso negado.');
    }
    expect(carrinhoCreate).not.toHaveBeenCalled();
    expect(itemCreate).not.toHaveBeenCalled();
  });

  const cartBody = (quantidade: number) => ({
    id: cartId,
    itens: [leituraE2e({
      id: itemId, quantidade, preco: '9.90', imagem: null,
      opcoes: [{ id: optionId, nome: 'Aroma' }],
    })],
  });

  it('mantém linha indisponível no GET 200, fora do total e sem gravar', async () => {
    carrinhoFind.mockResolvedValue({
      id: cartId,
      itens: [leituraE2e({ id: itemId, quantidade: 2, ativo: false })],
    });
    const response = await request(app.getHttpServer())
      .get('/carrinho')
      .set('Authorization', `Bearer ${await token(PerfilUsuario.CLIENTE)}`)
      .expect(200);
    expect(response.body).toMatchObject({
      id: cartId,
      subtotal: '0.00',
      total: '0.00',
      itens: [{
        id: itemId,
        nome: 'Cupcake de festa',
        precoUnitario: null,
        subtotal: null,
        disponivel: false,
        motivo: 'Produto indisponível.',
      }],
    });
    expect(carrinhoCreate).not.toHaveBeenCalled();
    expect(itemCreate).not.toHaveBeenCalled();
    expect(itemUpdate).not.toHaveBeenCalled();
    expect(estoqueUpdate).not.toHaveBeenCalled();
    expect(reservaCreate).not.toHaveBeenCalled();
  });

  it('altera a quantidade em 200 no formato do GET sem escrita de estoque', async () => {
    itemFindFirst.mockResolvedValue({ id: itemId, produtoId, quantidade: 2 });
    itemUpdateMany.mockResolvedValue({ count: 1 });
    carrinhoFind.mockResolvedValue(cartBody(3));
    const response = await request(app.getHttpServer())
      .patch(`/carrinho/itens/${itemId}`)
      .set('Authorization', `Bearer ${await token(PerfilUsuario.CLIENTE)}`)
      .send({ quantidade: 3 })
      .expect(200);
    expect(response.body).toEqual({
      id: cartId,
      subtotal: '29.70',
      total: '29.70',
      itens: [{
        id: itemId, produtoId, nome: 'Cupcake de festa', imagemDisponivel: false, quantidade: 3,
        precoUnitario: '9.90', subtotal: '29.70', disponivel: true, motivo: null,
        personalizacoes: [{ id: optionId, nome: 'Aroma' }],
      }],
    });
    expect([...keysOf(response.body)].sort()).toEqual([
      'disponivel', 'id', 'imagemDisponivel', 'itens', 'motivo', 'nome', 'personalizacoes',
      'precoUnitario', 'produtoId', 'quantidade', 'subtotal', 'total',
    ]);
    expect(itemUpdateMany).toHaveBeenCalledWith({
      where: { id: itemId, carrinho: { usuarioId: userId } },
      data: { quantidade: 3 },
    });
    expect(itemUpdate).not.toHaveBeenCalled();
    expect(estoqueUpdate).not.toHaveBeenCalled();
    expect(reservaCreate).not.toHaveBeenCalled();
    expect(JSON.stringify(itemUpdateMany.mock.calls)).not.toMatch(/quantidadeReservada|personalizac|preco/i);
  });

  it('aceita quantidade igual ao saldo e rejeita acima, zero de saldo e estoque ausente', async () => {
    const http = request(app.getHttpServer());
    const bearer = `Bearer ${await token(PerfilUsuario.CLIENTE)}`;
    itemFindFirst.mockResolvedValue({ id: itemId, produtoId, quantidade: 2 });
    itemUpdateMany.mockResolvedValue({ count: 1 });
    carrinhoFind.mockResolvedValue(cartBody(2));
    estoqueFind.mockResolvedValue({ quantidadeFisica: 2, quantidadeReservada: 0 });
    await http.patch(`/carrinho/itens/${itemId}`).set('Authorization', bearer)
      .send({ quantidade: 2 }).expect(200);
    estoqueFind.mockResolvedValue({ quantidadeFisica: 4, quantidadeReservada: 1 });
    await http.patch(`/carrinho/itens/${itemId}`).set('Authorization', bearer)
      .send({ quantidade: 4 }).expect(409);
    estoqueFind.mockResolvedValue({ quantidadeFisica: 0, quantidadeReservada: 0 });
    const zero = await http.patch(`/carrinho/itens/${itemId}`).set('Authorization', bearer)
      .send({ quantidade: 1 }).expect(409);
    expect(zero.body.message).toBe('Quantidade superior à disponibilidade.');
    estoqueFind.mockResolvedValue(null);
    const missing = await http.patch(`/carrinho/itens/${itemId}`).set('Authorization', bearer)
      .send({ quantidade: 1 }).expect(409);
    expect(missing.body.message).toBe('Quantidade superior à disponibilidade.');
    expect(itemUpdateMany).toHaveBeenCalledTimes(1);
    expect(estoqueUpdate).not.toHaveBeenCalled();
    expect(reservaCreate).not.toHaveBeenCalled();
  });

  it('responde 400 sem gravar quantidade inválida, campo extra, usuarioId ou carrinhoId', async () => {
    const http = request(app.getHttpServer());
    const bearer = `Bearer ${await token(PerfilUsuario.CLIENTE)}`;
    const payloads = [
      { quantidade: 0 },
      { quantidade: -1 },
      { quantidade: 1.5 },
      { quantidade: 2147483648 },
      { quantidade: '2' },
      {},
      { quantidade: 1, usuarioId: userId },
      { quantidade: 1, carrinhoId: cartId },
      { quantidade: 1, preco: '10.00' },
    ];
    for (const payload of payloads) {
      await http.patch(`/carrinho/itens/${itemId}`).set('Authorization', bearer).send(payload).expect(400);
    }
    await http.patch('/carrinho/itens/nao-uuid').set('Authorization', bearer)
      .send({ quantidade: 1 }).expect(400);
    expect(itemFindFirst).not.toHaveBeenCalled();
    expect(itemUpdateMany).not.toHaveBeenCalled();
    expect(estoqueFind).not.toHaveBeenCalled();
  });

  it('responde 404 para item ausente ou de outro usuário sem ler estoque', async () => {
    const http = request(app.getHttpServer());
    const missing = await http.patch(`/carrinho/itens/${itemId}`)
      .set('Authorization', `Bearer ${await token(PerfilUsuario.CLIENTE)}`)
      .send({ quantidade: 1 }).expect(404);
    expect(missing.body.message).toBe('Item não encontrado.');
    user.mockResolvedValue({ id: otherId, perfil: PerfilUsuario.CLIENTE });
    const foreign = await http.patch(`/carrinho/itens/${itemId}`)
      .set('Authorization', `Bearer ${await token(PerfilUsuario.CLIENTE, otherId)}`)
      .send({ quantidade: 1 }).expect(404);
    expect(foreign.body.message).toBe('Item não encontrado.');
    expect(itemFindFirst).toHaveBeenLastCalledWith({
      where: { id: itemId, carrinho: { usuarioId: otherId } },
      select: { id: true, produtoId: true, quantidade: true },
    });
    expect(itemUpdateMany).not.toHaveBeenCalled();
    expect(estoqueFind).not.toHaveBeenCalled();
    expect(estoqueUpdate).not.toHaveBeenCalled();
  });

  it('responde 404 quando a gravação não altera a linha', async () => {
    itemFindFirst.mockResolvedValue({ id: itemId, produtoId, quantidade: 1 });
    itemUpdateMany.mockResolvedValue({ count: 0 });
    const raced = await request(app.getHttpServer())
      .patch(`/carrinho/itens/${itemId}`)
      .set('Authorization', `Bearer ${await token(PerfilUsuario.CLIENTE)}`)
      .send({ quantidade: 1 })
      .expect(404);
    expect(raced.body.message).toBe('Item não encontrado.');
    expect(itemUpdateMany).toHaveBeenCalledTimes(1);
    expect(carrinhoFind).not.toHaveBeenCalled();
    expect(estoqueUpdate).not.toHaveBeenCalled();
    expect(reservaCreate).not.toHaveBeenCalled();
  });

  it('nega PATCH para anônimo, ADMIN e ENTREGADOR', async () => {
    const http = request(app.getHttpServer());
    const anonymous = await http.patch(`/carrinho/itens/${itemId}`).send({ quantidade: 1 }).expect(401);
    expect(anonymous.body.message).toBe('Access token inválido.');
    for (const perfil of [PerfilUsuario.ADMIN, PerfilUsuario.ENTREGADOR]) {
      user.mockResolvedValue({ id: userId, perfil });
      const response = await http.patch(`/carrinho/itens/${itemId}`)
        .set('Authorization', `Bearer ${await token(perfil)}`).send({ quantidade: 1 }).expect(403);
      expect(response.body.message).toBe('Acesso negado.');
    }
    expect(itemFindFirst).not.toHaveBeenCalled();
    expect(itemUpdateMany).not.toHaveBeenCalled();
  });

  it('remove o item em 204 sem apagar carrinho, personalização ou estoque', async () => {
    itemDeleteMany.mockResolvedValue({ count: 1 });
    const response = await request(app.getHttpServer())
      .delete(`/carrinho/itens/${itemId}`)
      .set('Authorization', `Bearer ${await token(PerfilUsuario.CLIENTE)}`)
      .expect(204);
    expect(response.text).toBe('');
    expect(itemDeleteMany).toHaveBeenCalledWith({
      where: { id: itemId, carrinho: { usuarioId: userId } },
    });
    expect(itemOptionDelete).not.toHaveBeenCalled();
    expect(carrinhoDelete).not.toHaveBeenCalled();
    expect(estoqueFind).not.toHaveBeenCalled();
    expect(estoqueUpdate).not.toHaveBeenCalled();
    expect(reservaCreate).not.toHaveBeenCalled();
  });

  it('responde 404 ao remover item ausente ou de outro usuário', async () => {
    const http = request(app.getHttpServer());
    const missing = await http.delete(`/carrinho/itens/${itemId}`)
      .set('Authorization', `Bearer ${await token(PerfilUsuario.CLIENTE)}`).expect(404);
    expect(missing.body.message).toBe('Item não encontrado.');
    user.mockResolvedValue({ id: otherId, perfil: PerfilUsuario.CLIENTE });
    const foreign = await http.delete(`/carrinho/itens/${itemId}`)
      .set('Authorization', `Bearer ${await token(PerfilUsuario.CLIENTE, otherId)}`).expect(404);
    expect(foreign.body.message).toBe('Item não encontrado.');
    expect(itemDeleteMany).toHaveBeenLastCalledWith({
      where: { id: itemId, carrinho: { usuarioId: otherId } },
    });
    expect(carrinhoDelete).not.toHaveBeenCalled();
    expect(estoqueFind).not.toHaveBeenCalled();
  });

  it('nega DELETE para anônimo, ADMIN, ENTREGADOR e uuid inválido', async () => {
    const http = request(app.getHttpServer());
    const anonymous = await http.delete(`/carrinho/itens/${itemId}`).expect(401);
    expect(anonymous.body.message).toBe('Access token inválido.');
    for (const perfil of [PerfilUsuario.ADMIN, PerfilUsuario.ENTREGADOR]) {
      user.mockResolvedValue({ id: userId, perfil });
      const response = await http.delete(`/carrinho/itens/${itemId}`)
        .set('Authorization', `Bearer ${await token(perfil)}`).expect(403);
      expect(response.body.message).toBe('Acesso negado.');
    }
    user.mockResolvedValue({ id: userId, perfil: PerfilUsuario.CLIENTE });
    await http.delete('/carrinho/itens/nao-uuid')
      .set('Authorization', `Bearer ${await token(PerfilUsuario.CLIENTE)}`).expect(400);
    expect(itemDeleteMany).not.toHaveBeenCalled();
    expect(estoqueFind).not.toHaveBeenCalled();
  });
});

describe('fluxo consolidado do carrinho', () => {
  let app: INestApplication;
  let memoria: MemoriaCarrinho;
  const jwt = new JwtService();
  const token = (perfil: PerfilUsuario, sub: string) => jwt.signAsync(
    { sub, perfil, type: 'access' },
    { secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m' },
  );
  const auth = async (perfil: PerfilUsuario, sub: string) =>
    `Bearer ${await token(perfil, sub)}`;

  beforeAll(async () => {
    memoria = novaMemoria();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaDaMemoria(() => memoria))
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => app.close());

  beforeEach(() => {
    memoria = novaMemoria();
  });

  const http = () => request(app.getHttpServer());
  const clientA = () => auth(PerfilUsuario.CLIENTE, memoriaIds.userA);
  const clientB = () => auth(PerfilUsuario.CLIENTE, memoriaIds.userB);

  function post(
    authorization: string,
    produtoId: string,
    quantidade: number,
    personalizacaoIds: string[],
  ) {
    return http().post('/carrinho/itens').set('Authorization', authorization)
      .send({ produtoId, quantidade, personalizacaoIds });
  }

  it('POST, GET, PATCH e GET preservam a linha, o preço e o saldo', async () => {
    const authorization = await clientA();
    const created = await post(authorization, memoriaIds.product, 1, []).expect(201);
    expect(Object.keys(created.body).sort()).toEqual([
      'carrinhoId', 'id', 'personalizacaoIds', 'produtoId', 'quantidade',
    ]);
    expect(JSON.stringify(created.body)).not.toMatch(/preco|subtotal|total/i);
    const read = await http().get('/carrinho').set('Authorization', authorization).expect(200);
    expect(read.body).toMatchObject({
      id: created.body.carrinhoId,
      subtotal: '10.00',
      total: '10.00',
      itens: [{
        id: created.body.id, quantidade: 1, precoUnitario: '10.00', subtotal: '10.00',
        disponivel: true, motivo: null, personalizacoes: [],
      }],
    });
    const patched = await http().patch(`/carrinho/itens/${created.body.id}`)
      .set('Authorization', authorization).send({ quantidade: 2 }).expect(200);
    expect(patched.body).toMatchObject({
      id: created.body.carrinhoId,
      subtotal: '20.00',
      total: '20.00',
      itens: [{ id: created.body.id, quantidade: 2, precoUnitario: '10.00', subtotal: '20.00' }],
    });
    const again = await http().get('/carrinho').set('Authorization', authorization).expect(200);
    expect(again.body).toEqual(patched.body);
    expect(memoria.linha(created.body.id)?.quantidade).toBe(2);
    expect(memoria.writes.estoque).toBe(0);
    expect(memoria.writes.reserva).toBe(0);
  });

  it('PATCH preserva personalizações e DELETE deixa o carrinho vazio', async () => {
    const authorization = await clientA();
    const first = await post(authorization, memoriaIds.product, 1, [
      memoriaIds.optionNull, memoriaIds.optionAdjust,
    ]).expect(201);
    const second = await post(authorization, memoriaIds.product, 1, []).expect(201);
    expect(first.body.id).not.toBe(second.body.id);
    const patched = await http().patch(`/carrinho/itens/${first.body.id}`)
      .set('Authorization', authorization).send({ quantidade: 2 }).expect(200);
    const kept = patched.body.itens.find((item: { id: string }) => item.id === first.body.id);
    expect(kept).toMatchObject({
      quantidade: 2,
      personalizacoes: [
        { id: memoriaIds.optionAdjust, nome: 'Ajuste' },
        { id: memoriaIds.optionNull, nome: 'Nulo' },
      ],
    });
    expect(memoria.linha(first.body.id)?.personalizacaoIds).toEqual([
      memoriaIds.optionNull, memoriaIds.optionAdjust,
    ]);
    const removed = await http().delete(`/carrinho/itens/${first.body.id}`)
      .set('Authorization', authorization).expect(204);
    expect(removed.text).toBe('');
    expect(memoria.linha(first.body.id)).toBeUndefined();
    expect(memoria.writes.personalizacaoItem).toBe(0);
    const after = await http().get('/carrinho').set('Authorization', authorization).expect(200);
    expect(after.body.itens.map((item: { id: string }) => item.id)).toEqual([second.body.id]);
    await http().delete(`/carrinho/itens/${second.body.id}`)
      .set('Authorization', authorization).expect(204);
    const empty = await http().get('/carrinho').set('Authorization', authorization).expect(200);
    expect(empty.body).toEqual({
      id: first.body.carrinhoId, itens: [], subtotal: '0.00', total: '0.00',
    });
    expect(memoria.carts.has(memoriaIds.userA)).toBe(true);
    expect(memoria.writes.carrinho).toBe(0);
    expect(memoria.writes.estoque).toBe(0);
    expect(memoria.writes.reserva).toBe(0);
  });

  it('isola clientes e nega anônimo, ADMIN e ENTREGADOR', async () => {
    const authorizationA = await clientA();
    const authorizationB = await clientB();
    const created = await post(authorizationA, memoriaIds.product, 2, []).expect(201);
    const foreignRead = await http().get('/carrinho').set('Authorization', authorizationB).expect(200);
    expect(foreignRead.body).toEqual({ id: null, itens: [], subtotal: '0.00', total: '0.00' });
    const foreignPatch = await http().patch(`/carrinho/itens/${created.body.id}`)
      .set('Authorization', authorizationB).send({ quantidade: 1 }).expect(404);
    const missingPatch = await http().patch(`/carrinho/itens/${memoriaIds.optionAdjust}`)
      .set('Authorization', authorizationA).send({ quantidade: 1 }).expect(404);
    const foreignDelete = await http().delete(`/carrinho/itens/${created.body.id}`)
      .set('Authorization', authorizationB).expect(404);
    const missingDelete = await http().delete(`/carrinho/itens/${memoriaIds.zero}`)
      .set('Authorization', authorizationA).expect(404);
    for (const response of [foreignPatch, missingPatch, foreignDelete, missingDelete]) {
      expect(response.body.message).toBe('Item não encontrado.');
    }
    expect(memoria.linha(created.body.id)?.quantidade).toBe(2);
    expect(memoria.carts.has(memoriaIds.userB)).toBe(false);
    const owned = await http().get('/carrinho').set('Authorization', authorizationA).expect(200);
    expect(owned.body.itens).toEqual([expect.objectContaining({ id: created.body.id, quantidade: 2 })]);
    const anonymousGet = await http().get('/carrinho').expect(401);
    const anonymousPatch = await http().patch(`/carrinho/itens/${created.body.id}`)
      .send({ quantidade: 1 }).expect(401);
    const anonymousDelete = await http().delete(`/carrinho/itens/${created.body.id}`).expect(401);
    for (const response of [anonymousGet, anonymousPatch, anonymousDelete]) {
      expect(response.body.message).toBe('Access token inválido.');
    }
    for (const perfil of [PerfilUsuario.ADMIN, PerfilUsuario.ENTREGADOR]) {
      const sub = perfil === PerfilUsuario.ADMIN ? memoriaIds.admin : memoriaIds.courier;
      const authorization = await auth(perfil, sub);
      const deniedGet = await http().get('/carrinho').set('Authorization', authorization).expect(403);
      const deniedPatch = await http().patch(`/carrinho/itens/${created.body.id}`)
        .set('Authorization', authorization).send({ quantidade: 1 }).expect(403);
      const deniedDelete = await http().delete(`/carrinho/itens/${created.body.id}`)
        .set('Authorization', authorization).expect(403);
      for (const response of [deniedGet, deniedPatch, deniedDelete]) {
        expect(response.body.message).toBe('Acesso negado.');
      }
    }
    expect(memoria.linha(created.body.id)?.quantidade).toBe(2);
    expect(memoria.writes).toEqual({
      estoque: 0, reserva: 0, personalizacaoItem: 0, carrinho: 0, itemUpdate: 0, itemFindMany: 0,
    });
  });

  it('não soma linhas nem a quantidade antiga e mantém a linha sem estoque', async () => {
    const authorization = await clientA();
    const first = await post(authorization, memoriaIds.product, 2, []).expect(201);
    const second = await post(authorization, memoriaIds.product, 2, []).expect(201);
    const both = await http().get('/carrinho').set('Authorization', authorization).expect(200);
    expect(both.body.itens).toEqual([
      expect.objectContaining({ id: first.body.id, quantidade: 2, disponivel: true, motivo: null }),
      expect.objectContaining({ id: second.body.id, quantidade: 2, disponivel: true, motivo: null }),
    ]);
    const atBalance = await http().patch(`/carrinho/itens/${first.body.id}`)
      .set('Authorization', authorization).send({ quantidade: 3 }).expect(200);
    expect(atBalance.body).toMatchObject({ subtotal: '50.00', total: '50.00' });
    expect(atBalance.body.itens).toEqual([
      expect.objectContaining({ id: first.body.id, quantidade: 3, disponivel: true, subtotal: '30.00' }),
      expect.objectContaining({ id: second.body.id, quantidade: 2, disponivel: true, subtotal: '20.00' }),
    ]);
    const over = await http().patch(`/carrinho/itens/${first.body.id}`)
      .set('Authorization', authorization).send({ quantidade: 4 }).expect(409);
    expect(over.body.message).toBe('Quantidade superior à disponibilidade.');
    expect(memoria.linha(first.body.id)?.quantidade).toBe(3);
    memoria.definirEstoque(memoriaIds.product, null);
    const missing = await http().get('/carrinho').set('Authorization', authorization).expect(200);
    expect(missing.body).toMatchObject({ subtotal: '50.00', total: '50.00' });
    expect(missing.body.itens).toEqual([
      expect.objectContaining({
        id: first.body.id, precoUnitario: '10.00', subtotal: '30.00', disponivel: false,
        motivo: 'Quantidade superior à disponibilidade.',
      }),
      expect.objectContaining({
        id: second.body.id, disponivel: false, motivo: 'Quantidade superior à disponibilidade.',
      }),
    ]);
    const rejected = await http().patch(`/carrinho/itens/${second.body.id}`)
      .set('Authorization', authorization).send({ quantidade: 1 }).expect(409);
    expect(rejected.body.message).toBe('Quantidade superior à disponibilidade.');
    expect(memoria.linha(second.body.id)?.quantidade).toBe(2);
    expect(memoria.writes.estoque).toBe(0);
    expect(memoria.writes.reserva).toBe(0);
  });

  it('devolve preço vigente, ajuste nulo, zero e negativo calculados pela API', async () => {
    const authorization = await clientA();
    const priced = await post(authorization, memoriaIds.product, 2, [
      memoriaIds.optionAdjust, memoriaIds.optionNull,
    ]).expect(201);
    const zero = await post(authorization, memoriaIds.zero, 1, []).expect(201);
    const negative = await post(authorization, memoriaIds.negative, 1, [
      memoriaIds.optionNegative,
    ]).expect(201);
    const read = await http().get('/carrinho').set('Authorization', authorization).expect(200);
    expect(read.body.itens).toEqual([
      expect.objectContaining({ id: priced.body.id, precoUnitario: '10.10', subtotal: '20.20' }),
      expect.objectContaining({ id: zero.body.id, precoUnitario: '0.00', subtotal: '0.00' }),
      expect.objectContaining({
        id: negative.body.id, precoUnitario: null, subtotal: null, disponivel: false,
        motivo: 'Preço unitário negativo para a seleção.',
      }),
    ]);
    expect(read.body).toMatchObject({ subtotal: '20.20', total: '20.20' });
    memoria.definirPreco(memoriaIds.product, '11.00');
    const reread = await http().get('/carrinho').set('Authorization', authorization).expect(200);
    const repriced = reread.body.itens.find((item: { id: string }) => item.id === priced.body.id);
    expect(repriced).toEqual(expect.objectContaining({
      precoUnitario: '11.10', subtotal: '22.20',
    }));
    expect(reread.body.itens.map((item: { id: string }) => item.id)).toEqual(
      [priced.body.id, zero.body.id, negative.body.id].sort(),
    );
    expect(reread.body).toMatchObject({ subtotal: '22.20', total: '22.20' });
    const patched = await http().patch(`/carrinho/itens/${priced.body.id}`)
      .set('Authorization', authorization).send({ quantidade: 1 }).expect(200);
    const patchedLine = patched.body.itens.find((item: { id: string }) => item.id === priced.body.id);
    expect(patchedLine).toEqual(expect.objectContaining({
      quantidade: 1, precoUnitario: '11.10', subtotal: '11.10',
    }));
    expect(patched.body).toMatchObject({ subtotal: '11.10', total: '11.10' });
    expect(JSON.stringify(patched.body)).not.toMatch(/precoAtual|quantidadeFisica|frete|desconto/);
    expect(memoria.alteracoes).toEqual([{ quantidade: 1 }]);
    expect(memoria.writes.estoque).toBe(0);
    expect(memoria.writes.reserva).toBe(0);
  });
});
