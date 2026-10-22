import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaClient } from '../src/generated/prisma/client';
import { PerfilUsuario } from '../src/generated/prisma/enums';

type Linha = {
  id: string;
  quantidade: number;
  precoUnitario: string | null;
  subtotal: string | null;
  disponivel: boolean;
  motivo: string | null;
  personalizacoes: Array<{ id: string; nome: string }>;
};

async function main() {
  const url = process.env.D38_TEST_DATABASE_URL;
  if (!url) throw new Error('Defina D38_TEST_DATABASE_URL.');
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname) ||
      parsed.pathname !== '/cupcake_d38' ||
      [...parsed.searchParams].some(([key, value]) => key !== 'schema' || value !== 'public')) {
    throw new Error('D38 exige banco local cupcake_d38, schema public.');
  }
  process.env.DATABASE_URL = url;
  process.env.JWT_ACCESS_SECRET = `d38-${randomUUID()}`;
  process.env.JWT_REFRESH_SECRET = `d38-refresh-${randomUUID()}`;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const userA = randomUUID();
  const userB = randomUUID();
  const adminId = randomUUID();
  const courierId = randomUUID();
  const categoryId = randomUUID();
  const productId = randomUUID();
  const zeroId = randomUUID();
  const negativeId = randomUUID();
  const optionAdjust = randomUUID();
  const optionNull = randomUUID();
  const optionNegative = randomUUID();
  const userIds = [userA, userB, adminId, courierId];
  const productIds = [productId, zeroId, negativeId];
  const optionIds = [optionAdjust, optionNull, optionNegative];
  let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;
  let ready = false;
  try {
    await prisma.usuario.createMany({ data: [
      { id: userA, nome: 'D38 A', email: `d38-a-${userA}@example.test`, telefone: '11900000001', credencialSenha: 'fixture', perfil: PerfilUsuario.CLIENTE },
      { id: userB, nome: 'D38 B', email: `d38-b-${userB}@example.test`, telefone: '11900000002', credencialSenha: 'fixture', perfil: PerfilUsuario.CLIENTE },
      { id: adminId, nome: 'D38 admin', email: `d38-admin-${adminId}@example.test`, telefone: '11900000003', credencialSenha: 'fixture', perfil: PerfilUsuario.ADMIN },
      { id: courierId, nome: 'D38 courier', email: `d38-courier-${courierId}@example.test`, telefone: '11900000004', credencialSenha: 'fixture', perfil: PerfilUsuario.ENTREGADOR },
    ] });
    ready = true;
    await prisma.categoria.create({ data: { id: categoryId, nome: `D38 ${categoryId}` } });
    await prisma.produto.createMany({ data: [
      { id: productId, categoriaId: categoryId, nome: 'D38', precoAtual: '10.00', ativo: true },
      { id: zeroId, categoriaId: categoryId, nome: 'D38 zero', precoAtual: '0.00', ativo: true },
      { id: negativeId, categoriaId: categoryId, nome: 'D38 negativo', precoAtual: '1.00', ativo: true },
    ] });
    await prisma.estoque.createMany({ data: [
      { produtoId: productId, quantidadeFisica: 5, quantidadeReservada: 2 },
      { produtoId: zeroId, quantidadeFisica: 10, quantidadeReservada: 0 },
      { produtoId: negativeId, quantidadeFisica: 10, quantidadeReservada: 0 },
    ] });
    await prisma.personalizacao.createMany({ data: [
      { id: optionAdjust, nome: 'Ajuste', ajusteValor: '0.10' },
      { id: optionNull, nome: 'Nulo', ajusteValor: null },
      { id: optionNegative, nome: 'Menos', ajusteValor: '-2.00' },
    ] });
    await prisma.produtoPersonalizacao.createMany({ data: [
      { produtoId: productId, personalizacaoId: optionAdjust },
      { produtoId: productId, personalizacaoId: optionNull },
      { produtoId: negativeId, personalizacaoId: optionNegative },
    ] });
    const reservasAntes = await prisma.reservaEstoque.count({ where: { produtoId: { in: productIds } } });
    const pedidosAntes = await prisma.itemPedido.count({ where: { produtoId: { in: productIds } } });
    const movimentosAntes = await prisma.movimentacaoEstoque.count({ where: { produtoId: { in: productIds } } });
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    const http = app.getHttpServer();
    const jwt = new JwtService();
    const bearer = async (sub: string, perfil: PerfilUsuario) => `Bearer ${await jwt.signAsync(
      { sub, perfil, type: 'access' },
      { secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m' },
    )}`;
    const authA = await bearer(userA, PerfilUsuario.CLIENTE);
    const authB = await bearer(userB, PerfilUsuario.CLIENTE);
    const authAdmin = await bearer(adminId, PerfilUsuario.ADMIN);
    const authCourier = await bearer(courierId, PerfilUsuario.ENTREGADOR);
    const post = (authorization: string, produto: string, quantidade: number, personalizacaoIds: string[]) =>
      request(http).post('/carrinho/itens').set('Authorization', authorization)
        .send({ produtoId: produto, quantidade, personalizacaoIds });
    const linhas = (body: { itens: Linha[] }) => body.itens;
    const porId = (body: { itens: Linha[] }, id: string) => {
      const linha = linhas(body).find((item) => item.id === id);
      assert.ok(linha);
      return linha;
    };

    const first = await post(authA, productId, 2, []).expect(201);
    assert.equal(JSON.stringify(first.body).includes('preco'), false);
    const second = await post(authA, productId, 2, []).expect(201);
    assert.notEqual(second.body.id, first.body.id);
    const both = await request(http).get('/carrinho').set('Authorization', authA).expect(200);
    assert.deepEqual(linhas(both.body).map((item) => item.id), [first.body.id, second.body.id].sort());
    for (const id of [first.body.id, second.body.id]) {
      const linha = porId(both.body, id);
      assert.equal(linha.quantidade, 2);
      assert.equal(linha.precoUnitario, '10.00');
      assert.equal(linha.subtotal, '20.00');
      assert.equal(linha.disponivel, true);
      assert.equal(linha.motivo, null);
    }
    assert.equal(both.body.subtotal, '40.00');
    assert.equal(both.body.total, '40.00');

    const atBalance = await request(http).patch(`/carrinho/itens/${first.body.id}`)
      .set('Authorization', authA).send({ quantidade: 3 }).expect(200);
    assert.equal(porId(atBalance.body, first.body.id).quantidade, 3);
    assert.equal(porId(atBalance.body, first.body.id).subtotal, '30.00');
    assert.equal(porId(atBalance.body, second.body.id).quantidade, 2);
    assert.equal(porId(atBalance.body, second.body.id).disponivel, true);
    assert.equal(atBalance.body.subtotal, '50.00');
    assert.equal(atBalance.body.total, '50.00');
    const reread = await request(http).get('/carrinho').set('Authorization', authA).expect(200);
    assert.equal(porId(reread.body, first.body.id).quantidade, 3);
    assert.equal(porId(reread.body, first.body.id).precoUnitario, '10.00');
    const over = await request(http).patch(`/carrinho/itens/${first.body.id}`)
      .set('Authorization', authA).send({ quantidade: 4 }).expect(409);
    assert.equal(over.body.message, 'Quantidade superior à disponibilidade.');
    assert.equal((await prisma.itemCarrinho.findUniqueOrThrow({ where: { id: first.body.id } })).quantidade, 3);

    const personalized = await post(authA, productId, 1, [optionNull, optionAdjust]).expect(201);
    const withOptions = await request(http).patch(`/carrinho/itens/${personalized.body.id}`)
      .set('Authorization', authA).send({ quantidade: 1 }).expect(200);
    const kept = porId(withOptions.body, personalized.body.id);
    assert.equal(kept.precoUnitario, '10.10');
    assert.equal(kept.subtotal, '10.10');
    assert.deepEqual(kept.personalizacoes, [
      { id: optionAdjust, nome: 'Ajuste' },
      { id: optionNull, nome: 'Nulo' },
    ]);
    assert.equal(withOptions.body.subtotal, '60.10');
    assert.equal(withOptions.body.total, '60.10');
    const storedOptions = await prisma.itemCarrinhoPersonalizacao.findMany({
      where: { itemCarrinhoId: personalized.body.id },
      orderBy: { personalizacaoId: 'asc' },
    });
    assert.deepEqual(storedOptions.map((row) => row.personalizacaoId).sort(), [optionAdjust, optionNull].sort());

    const foreignRead = await request(http).get('/carrinho').set('Authorization', authB).expect(200);
    assert.deepEqual(foreignRead.body, { id: null, itens: [], subtotal: '0.00', total: '0.00' });
    const foreignPatch = await request(http).patch(`/carrinho/itens/${first.body.id}`)
      .set('Authorization', authB).send({ quantidade: 1 }).expect(404);
    const missingPatch = await request(http).patch(`/carrinho/itens/${randomUUID()}`)
      .set('Authorization', authA).send({ quantidade: 1 }).expect(404);
    const foreignDelete = await request(http).delete(`/carrinho/itens/${first.body.id}`)
      .set('Authorization', authB).expect(404);
    const missingDelete = await request(http).delete(`/carrinho/itens/${randomUUID()}`)
      .set('Authorization', authA).expect(404);
    for (const response of [foreignPatch, missingPatch, foreignDelete, missingDelete]) {
      assert.equal(response.body.message, 'Item não encontrado.');
    }
    assert.equal(await prisma.carrinho.count({ where: { usuarioId: userB } }), 0);
    const owned = await post(authB, productId, 1, []).expect(201);
    const cartB = await request(http).get('/carrinho').set('Authorization', authB).expect(200);
    assert.deepEqual(linhas(cartB.body).map((item) => item.id), [owned.body.id]);
    const cartA = await request(http).get('/carrinho').set('Authorization', authA).expect(200);
    assert.equal(linhas(cartA.body).some((item) => item.id === owned.body.id), false);
    assert.equal(linhas(cartB.body).some((item) => item.id === first.body.id), false);

    const anonymous = await request(http).get('/carrinho').expect(401);
    assert.equal(anonymous.body.message, 'Access token inválido.');
    const admin = await request(http).patch(`/carrinho/itens/${first.body.id}`)
      .set('Authorization', authAdmin).send({ quantidade: 1 }).expect(403);
    const courier = await request(http).delete(`/carrinho/itens/${first.body.id}`)
      .set('Authorization', authCourier).expect(403);
    assert.equal(admin.body.message, 'Acesso negado.');
    assert.equal(courier.body.message, 'Acesso negado.');
    assert.equal((await prisma.itemCarrinho.findUniqueOrThrow({ where: { id: first.body.id } })).quantidade, 3);

    await prisma.estoque.delete({ where: { produtoId: productId } });
    const missingStock = await request(http).get('/carrinho').set('Authorization', authA).expect(200);
    for (const id of [first.body.id, second.body.id, personalized.body.id]) {
      const linha = porId(missingStock.body, id);
      assert.equal(linha.disponivel, false);
      assert.equal(linha.motivo, 'Quantidade superior à disponibilidade.');
      assert.notEqual(linha.precoUnitario, null);
    }
    assert.equal(missingStock.body.total, '60.10');
    const rejected = await request(http).patch(`/carrinho/itens/${second.body.id}`)
      .set('Authorization', authA).send({ quantidade: 1 }).expect(409);
    assert.equal(rejected.body.message, 'Quantidade superior à disponibilidade.');
    assert.equal((await prisma.itemCarrinho.findUniqueOrThrow({ where: { id: second.body.id } })).quantidade, 2);
    await prisma.estoque.create({ data: { produtoId: productId, quantidadeFisica: 5, quantidadeReservada: 2 } });

    await prisma.produto.update({ where: { id: productId }, data: { precoAtual: '12.00' } });
    const repriced = await request(http).get('/carrinho').set('Authorization', authA).expect(200);
    assert.equal(porId(repriced.body, first.body.id).precoUnitario, '12.00');
    assert.equal(porId(repriced.body, first.body.id).subtotal, '36.00');
    assert.equal(porId(repriced.body, personalized.body.id).precoUnitario, '12.10');
    assert.equal(porId(repriced.body, personalized.body.id).subtotal, '12.10');
    assert.equal(repriced.body.subtotal, '72.10');
    assert.equal(repriced.body.total, '72.10');
    await prisma.produto.update({ where: { id: productId }, data: { precoAtual: '0.00' } });
    const zeroed = await request(http).get('/carrinho').set('Authorization', authA).expect(200);
    assert.equal(porId(zeroed.body, first.body.id).precoUnitario, '0.00');
    assert.equal(porId(zeroed.body, first.body.id).subtotal, '0.00');
    assert.equal(porId(zeroed.body, personalized.body.id).precoUnitario, '0.10');
    await prisma.produto.update({ where: { id: productId }, data: { precoAtual: '10.00' } });

    const zero = await post(authA, zeroId, 1, []).expect(201);
    const negative = await post(authA, negativeId, 1, [optionNegative]).expect(201);
    const priced = await request(http).get('/carrinho').set('Authorization', authA).expect(200);
    assert.equal(porId(priced.body, zero.body.id).precoUnitario, '0.00');
    assert.equal(porId(priced.body, zero.body.id).subtotal, '0.00');
    assert.equal(porId(priced.body, zero.body.id).disponivel, true);
    const invalid = porId(priced.body, negative.body.id);
    assert.equal(invalid.precoUnitario, null);
    assert.equal(invalid.subtotal, null);
    assert.equal(invalid.disponivel, false);
    assert.equal(invalid.motivo, 'Preço unitário negativo para a seleção.');
    assert.equal(priced.body.subtotal, '60.10');
    assert.equal(priced.body.total, '60.10');

    await request(http).delete(`/carrinho/itens/${personalized.body.id}`).set('Authorization', authA).expect(204);
    assert.equal(await prisma.itemCarrinho.count({ where: { id: personalized.body.id } }), 0);
    assert.equal(await prisma.itemCarrinhoPersonalizacao.count({ where: { itemCarrinhoId: personalized.body.id } }), 0);
    assert.equal(await prisma.personalizacao.count({ where: { id: optionAdjust } }), 1);
    const afterDelete = await request(http).get('/carrinho').set('Authorization', authA).expect(200);
    assert.equal(linhas(afterDelete.body).some((item) => item.id === personalized.body.id), false);
    assert.equal(linhas(afterDelete.body).some((item) => item.id === first.body.id), true);
    for (const id of [first.body.id, second.body.id, zero.body.id, negative.body.id]) {
      await request(http).delete(`/carrinho/itens/${id}`).set('Authorization', authA).expect(204);
    }
    await request(http).delete(`/carrinho/itens/${owned.body.id}`).set('Authorization', authB).expect(204);
    const empty = await request(http).get('/carrinho').set('Authorization', authA).expect(200);
    const cartId = (await prisma.carrinho.findUniqueOrThrow({ where: { usuarioId: userA } })).id;
    assert.deepEqual(empty.body, { id: cartId, itens: [], subtotal: '0.00', total: '0.00' });
    assert.equal(await prisma.itemCarrinho.count({ where: { carrinhoId: cartId } }), 0);
    assert.equal(await prisma.carrinho.count({ where: { id: cartId } }), 1);
    const estoque = await prisma.estoque.findUniqueOrThrow({ where: { produtoId: productId } });
    assert.equal(estoque.quantidadeFisica, 5);
    assert.equal(estoque.quantidadeReservada, 2);
    assert.equal(await prisma.reservaEstoque.count({ where: { produtoId: { in: productIds } } }), reservasAntes);
    assert.equal(await prisma.itemPedido.count({ where: { produtoId: { in: productIds } } }), pedidosAntes);
    assert.equal(await prisma.movimentacaoEstoque.count({ where: { produtoId: { in: productIds } } }), movimentosAntes);
    process.stdout.write('PASS D38 PostgreSQL\n');
  } finally {
    if (app) await app.close();
    if (ready) {
      await prisma.carrinho.deleteMany({ where: { usuarioId: { in: userIds } } });
      await prisma.produtoPersonalizacao.deleteMany({ where: { produtoId: { in: productIds } } });
      await prisma.personalizacao.deleteMany({ where: { id: { in: optionIds } } });
      await prisma.reservaEstoque.deleteMany({ where: { produtoId: { in: productIds } } });
      await prisma.estoque.deleteMany({ where: { produtoId: { in: productIds } } });
      await prisma.produto.deleteMany({ where: { id: { in: productIds } } });
      await prisma.categoria.deleteMany({ where: { id: categoryId } });
      await prisma.usuario.deleteMany({ where: { id: { in: userIds } } });
      assert.equal(await prisma.carrinho.count({ where: { usuarioId: { in: userIds } } }), 0);
      assert.equal(await prisma.itemCarrinho.count({ where: { produtoId: { in: productIds } } }), 0);
      assert.equal(await prisma.produto.count({ where: { id: { in: productIds } } }), 0);
      assert.equal(await prisma.usuario.count({ where: { id: { in: userIds } } }), 0);
    }
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Falha D38 PostgreSQL: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
