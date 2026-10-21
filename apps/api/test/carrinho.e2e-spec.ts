import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PerfilUsuario } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';

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
        estoque: { findUnique: estoqueFind },
        personalizacao: { findMany: personalizacaoFindMany },
        produtoPersonalizacao: { findMany: linkFindMany },
        carrinho: { findUnique: carrinhoFind, create: carrinhoCreate },
        itemCarrinho: { create: itemCreate, update: itemUpdate, findMany: itemFindMany },
      }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
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

  it('devolve o carrinho do cliente com linhas, nomes, quantidades e ordem', async () => {
    carrinhoFind.mockResolvedValue({
      id: cartId,
      itens: [
        {
          id: secondItemId, produtoId, quantidade: 4,
          produto: { nome: 'Cupcake de festa', imagem: null, precoAtual: '8.00' },
          personalizacoes: [],
        },
        {
          id: itemId, produtoId, quantidade: 1,
          produto: { nome: 'Cupcake de festa', imagem: managed, precoAtual: '9.90' },
          personalizacoes: [
            { personalizacao: { id: optionId, nome: 'Creme' } },
            { personalizacao: { id: aroma, nome: 'Aroma' } },
            { personalizacao: { id: cremeB, nome: 'Creme' } },
          ],
        },
      ],
    });
    const response = await request(app.getHttpServer())
      .get('/carrinho')
      .query({ usuarioId: otherId, carrinhoId: cartId })
      .set('Authorization', `Bearer ${await token(PerfilUsuario.CLIENTE)}`)
      .expect(200);
    expect(response.body).toEqual({
      id: cartId,
      itens: [
        {
          id: itemId, produtoId, nome: 'Cupcake de festa', imagemDisponivel: true, quantidade: 1,
          personalizacoes: [
            { id: aroma, nome: 'Aroma' },
            { id: optionId, nome: 'Creme' },
            { id: cremeB, nome: 'Creme' },
          ],
        },
        {
          id: secondItemId, produtoId, nome: 'Cupcake de festa', imagemDisponivel: false, quantidade: 4,
          personalizacoes: [],
        },
      ],
    });
    expect(response.body.itens[0].id).not.toBe(response.body.itens[1].id);
    expect([...keysOf(response.body)].sort()).toEqual([
      'id', 'imagemDisponivel', 'itens', 'nome', 'personalizacoes', 'produtoId', 'quantidade',
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

  it('devolve carrinho vazio ou inexistente em 200 e não cria carrinho', async () => {
    const http = request(app.getHttpServer());
    const bearer = `Bearer ${await token(PerfilUsuario.CLIENTE)}`;
    const missing = await http.get('/carrinho').set('Authorization', bearer).expect(200);
    expect(missing.body).toEqual({ id: null, itens: [] });
    expect(carrinhoCreate).not.toHaveBeenCalled();
    carrinhoFind.mockResolvedValue({ id: cartId, itens: [] });
    const empty = await http.get('/carrinho').set('Authorization', bearer).expect(200);
    expect(empty.body).toEqual({ id: cartId, itens: [] });
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
    expect(foreign.body).toEqual({ id: null, itens: [] });
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
});
