import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaClient } from '../src/generated/prisma/client';
import { PerfilUsuario } from '../src/generated/prisma/enums';

async function main() {
  const url = process.env.D36_TEST_DATABASE_URL;
  if (!url) throw new Error('Defina D36_TEST_DATABASE_URL.');
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname) ||
      parsed.pathname !== '/cupcake_d36' ||
      [...parsed.searchParams].some(([key, value]) => key !== 'schema' || value !== 'public')) {
    throw new Error('D36 exige banco local cupcake_d36, schema public.');
  }
  process.env.DATABASE_URL = url;
  process.env.JWT_ACCESS_SECRET = `d36-${randomUUID()}`;
  process.env.JWT_REFRESH_SECRET = `d36-refresh-${randomUUID()}`;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const userA = randomUUID();
  const userB = randomUUID();
  const categoryId = randomUUID();
  const productId = randomUUID();
  const optionA = randomUUID();
  const optionB = randomUUID();
  const userIds = [userA, userB];
  let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;
  try {
    await prisma.usuario.createMany({ data: userIds.map((id, index) => ({
      id, nome: `D36 ${index}`, email: `d36-${id}@example.test`, telefone: '00000000000',
      credencialSenha: 'fixture', perfil: PerfilUsuario.CLIENTE,
    })) });
    await prisma.categoria.create({ data: { id: categoryId, nome: `D36 ${categoryId}` } });
    await prisma.produto.create({ data: {
      id: productId, categoriaId: categoryId, nome: 'D36', precoAtual: '10.00',
    } });
    await prisma.estoque.create({ data: {
      produtoId: productId, quantidadeFisica: 5, quantidadeReservada: 2,
    } });
    await prisma.personalizacao.createMany({ data: [
      { id: optionA, nome: 'D36 A' },
      { id: optionB, nome: 'D36 B' },
    ] });
    await prisma.produtoPersonalizacao.createMany({ data: [
      { produtoId: productId, personalizacaoId: optionA },
      { produtoId: productId, personalizacaoId: optionB },
    ] });
    const reservasAntes = await prisma.reservaEstoque.count({ where: { produtoId: productId } });
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    const http = app.getHttpServer();
    const jwt = new JwtService();
    const bearer = async (sub: string) => `Bearer ${await jwt.signAsync(
      { sub, perfil: 'CLIENTE', type: 'access' },
      { secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m' },
    )}`;
    const authA = await bearer(userA);
    const authB = await bearer(userB);
    const post = (authorization: string, quantidade: number, personalizacaoIds: string[]) =>
      request(http).post('/carrinho/itens').set('Authorization', authorization)
        .send({ produtoId: productId, quantidade, personalizacaoIds });
    const first = await post(authA, 2, [optionA]).expect(201);
    const second = await post(authA, 1, [optionB]).expect(201);
    const cartId = first.body.carrinhoId as string;
    assert.equal(second.body.carrinhoId, cartId);
    const over = await request(http).patch(`/carrinho/itens/${first.body.id}`)
      .set('Authorization', authA).send({ quantidade: 4 }).expect(409);
    assert.equal(over.body.message, 'Quantidade superior à disponibilidade.');
    assert.equal((await prisma.itemCarrinho.findUnique({ where: { id: first.body.id } }))?.quantidade, 2);
    const foreign = await request(http).patch(`/carrinho/itens/${first.body.id}`)
      .set('Authorization', authB).send({ quantidade: 1 }).expect(404);
    assert.equal(foreign.body.message, 'Item não encontrado.');
    const patched = await request(http).patch(`/carrinho/itens/${first.body.id}`)
      .set('Authorization', authA).send({ quantidade: 3 }).expect(200);
    assert.equal(patched.body.id, cartId);
    assert.deepEqual(Object.keys(patched.body).sort(), ['id', 'itens']);
    const updated = (patched.body.itens as Array<{ id: string; quantidade: number; personalizacoes: unknown[] }>)
      .find((item) => item.id === first.body.id);
    assert.equal(updated?.quantidade, 3);
    assert.equal(updated?.personalizacoes.length, 1);
    assert.equal(JSON.stringify(patched.body).includes('preco'), false);
    const stored = await prisma.itemCarrinho.findUnique({
      where: { id: first.body.id },
      include: { personalizacoes: true },
    });
    assert.equal(stored?.quantidade, 3);
    assert.equal(stored?.produtoId, productId);
    assert.equal(stored?.carrinhoId, cartId);
    assert.deepEqual(stored?.personalizacoes.map((row) => row.personalizacaoId), [optionA]);
    const untouched = await prisma.itemCarrinho.findUnique({
      where: { id: second.body.id },
      include: { personalizacoes: true },
    });
    assert.equal(untouched?.quantidade, 1);
    assert.deepEqual(untouched?.personalizacoes.map((row) => row.personalizacaoId), [optionB]);
    const deniedDelete = await request(http).delete(`/carrinho/itens/${first.body.id}`)
      .set('Authorization', authB).expect(404);
    assert.equal(deniedDelete.body.message, 'Item não encontrado.');
    assert.equal(await prisma.itemCarrinhoPersonalizacao.count({
      where: { itemCarrinhoId: first.body.id },
    }), 1);
    await request(http).delete(`/carrinho/itens/${first.body.id}`)
      .set('Authorization', authA).expect(204);
    assert.equal(await prisma.itemCarrinho.count({ where: { id: first.body.id } }), 0);
    assert.equal(await prisma.itemCarrinhoPersonalizacao.count({
      where: { itemCarrinhoId: first.body.id },
    }), 0);
    assert.equal(await prisma.carrinho.count({ where: { id: cartId } }), 1);
    const survivor = await prisma.itemCarrinho.findUnique({
      where: { id: second.body.id },
      include: { personalizacoes: true },
    });
    assert.equal(survivor?.quantidade, 1);
    assert.deepEqual(survivor?.personalizacoes.map((row) => row.personalizacaoId), [optionB]);
    const afterDelete = await request(http).patch(`/carrinho/itens/${first.body.id}`)
      .set('Authorization', authA).send({ quantidade: 1 }).expect(404);
    assert.equal(afterDelete.body.message, 'Item não encontrado.');
    const secondDelete = await request(http).delete(`/carrinho/itens/${first.body.id}`)
      .set('Authorization', authA).expect(404);
    assert.equal(secondDelete.body.message, 'Item não encontrado.');
    await request(http).delete(`/carrinho/itens/${second.body.id}`)
      .set('Authorization', authA).expect(204);
    assert.equal(await prisma.itemCarrinho.count({ where: { carrinhoId: cartId } }), 0);
    assert.equal(await prisma.itemCarrinhoPersonalizacao.count({
      where: { itemCarrinhoId: second.body.id },
    }), 0);
    assert.equal(await prisma.carrinho.count({ where: { id: cartId, usuarioId: userA } }), 1);
    const estoque = await prisma.estoque.findUniqueOrThrow({ where: { produtoId: productId } });
    assert.equal(estoque.quantidadeFisica, 5);
    assert.equal(estoque.quantidadeReservada, 2);
    assert.equal(await prisma.reservaEstoque.count({ where: { produtoId: productId } }), reservasAntes);
    process.stdout.write('PASS D36 PostgreSQL\n');
  } finally {
    if (app) await app.close();
    await prisma.carrinho.deleteMany({ where: { usuarioId: { in: userIds } } });
    await prisma.produtoPersonalizacao.deleteMany({ where: { produtoId: productId } });
    await prisma.personalizacao.deleteMany({ where: { id: { in: [optionA, optionB] } } });
    await prisma.reservaEstoque.deleteMany({ where: { produtoId: productId } });
    await prisma.estoque.deleteMany({ where: { produtoId: productId } });
    await prisma.produto.deleteMany({ where: { id: productId } });
    await prisma.categoria.deleteMany({ where: { id: categoryId } });
    await prisma.usuario.deleteMany({ where: { id: { in: userIds } } });
    assert.equal(await prisma.carrinho.count({ where: { usuarioId: { in: userIds } } }), 0);
    assert.equal(await prisma.itemCarrinho.count({ where: { produtoId: productId } }), 0);
    assert.equal(await prisma.produto.count({ where: { id: productId } }), 0);
    assert.equal(await prisma.usuario.count({ where: { id: { in: userIds } } }), 0);
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Falha D36 PostgreSQL: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
