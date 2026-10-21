import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';
import { PerfilUsuario } from '../src/generated/prisma/enums';

async function main() {
  const url = process.env.D34_TEST_DATABASE_URL;
  if (!url) throw new Error('Defina D34_TEST_DATABASE_URL.');
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname) ||
      parsed.pathname !== '/cupcake_d34' ||
      [...parsed.searchParams].some(([key, value]) => key !== 'schema' || value !== 'public')) {
    throw new Error('D34 exige banco local cupcake_d34, schema public.');
  }
  process.env.DATABASE_URL = url;
  process.env.JWT_ACCESS_SECRET = `d34-${randomUUID()}`;
  process.env.JWT_REFRESH_SECRET = `d34-refresh-${randomUUID()}`;
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
      id, nome: `D34 ${index}`, email: `d34-${id}@example.test`, telefone: '00000000000',
      credencialSenha: 'fixture', perfil: PerfilUsuario.CLIENTE,
    })) });
    await prisma.categoria.create({ data: { id: categoryId, nome: `D34 ${categoryId}` } });
    await prisma.produto.create({ data: {
      id: productId, categoriaId: categoryId, nome: 'D34', precoAtual: '10.00',
    } });
    await prisma.estoque.create({ data: {
      produtoId: productId, quantidadeFisica: 5, quantidadeReservada: 2,
    } });
    await prisma.personalizacao.createMany({ data: [
      { id: optionA, nome: 'D34 A' },
      { id: optionB, nome: 'D34 B' },
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
    const second = await post(authA, 3, [optionA]).expect(201);
    const third = await post(authA, 1, [optionB]).expect(201);
    const plain = await post(authA, 1, []).expect(201);
    const upper = await post(authA, 1, [optionA.toUpperCase()]).expect(201);
    const duplicateCase = await post(authA, 1, [optionA, optionA.toUpperCase()]).expect(409);
    assert.equal(duplicateCase.body.message, 'Seleção de personalizações inválida.');
    for (const response of [first, second, third, plain, upper]) {
      assert.deepEqual(Object.keys(response.body).sort(),
        ['carrinhoId', 'id', 'personalizacaoIds', 'produtoId', 'quantidade']);
      assert.equal(response.body.produtoId, productId);
    }
    assert.equal(first.body.quantidade, 2);
    assert.deepEqual(first.body.personalizacaoIds, [optionA]);
    assert.equal(second.body.quantidade, 3);
    assert.deepEqual(second.body.personalizacaoIds, [optionA]);
    assert.notEqual(first.body.id, second.body.id);
    assert.equal(first.body.carrinhoId, second.body.carrinhoId);
    assert.deepEqual(third.body.personalizacaoIds, [optionB]);
    assert.equal(third.body.carrinhoId, first.body.carrinhoId);
    assert.equal(plain.body.quantidade, 1);
    assert.deepEqual(plain.body.personalizacaoIds, []);
    assert.equal(plain.body.carrinhoId, first.body.carrinhoId);
    assert.equal(upper.body.quantidade, 1);
    assert.deepEqual(upper.body.personalizacaoIds, [optionA]);
    assert.equal(upper.body.carrinhoId, first.body.carrinhoId);
    const linhasA = await prisma.itemCarrinho.findMany({
      where: { carrinhoId: first.body.carrinhoId },
      include: { personalizacoes: true },
    });
    assert.equal(linhasA.length, 5);
    assert.deepEqual(linhasA.map((item) => item.quantidade).sort(), [1, 1, 1, 2, 3]);
    assert.equal(linhasA.find((item) => item.id === plain.body.id)?.personalizacoes.length, 0);
    assert.deepEqual(
      linhasA.find((item) => item.id === upper.body.id)?.personalizacoes.map((row) => row.personalizacaoId),
      [optionA],
    );
    assert.equal(await prisma.carrinho.count({ where: { usuarioId: userA } }), 1);
    const beforeB = await prisma.itemCarrinho.findMany({
      where: { carrinhoId: first.body.carrinhoId },
      select: { id: true, quantidade: true },
      orderBy: { id: 'asc' },
    });
    const other = await post(authB, 1, [optionA]).expect(201);
    assert.notEqual(other.body.carrinhoId, first.body.carrinhoId);
    const afterB = await prisma.itemCarrinho.findMany({
      where: { carrinhoId: first.body.carrinhoId },
      select: { id: true, quantidade: true },
      orderBy: { id: 'asc' },
    });
    assert.deepEqual(afterB, beforeB);
    assert.equal(await prisma.carrinho.count({ where: { usuarioId: userB } }), 1);
    assert.equal(await prisma.itemCarrinho.count({ where: { carrinhoId: other.body.carrinhoId } }), 1);
    const estoque = await prisma.estoque.findUniqueOrThrow({ where: { produtoId: productId } });
    assert.equal(estoque.quantidadeFisica, 5);
    assert.equal(estoque.quantidadeReservada, 2);
    assert.equal(await prisma.reservaEstoque.count({ where: { produtoId: productId } }), reservasAntes);
    const indexes = await prisma.$queryRaw<Array<{ indexdef: string }>>(Prisma.sql`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'ItemCarrinho'
    `);
    assert.equal(indexes.some((row) => row.indexdef.includes('UNIQUE')
      && row.indexdef.includes('carrinhoId') && row.indexdef.includes('produtoId')), false);
    const uniques = await prisma.$queryRaw<Array<{ conname: string }>>(Prisma.sql`
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = 'public' AND rel.relname = 'ItemCarrinho' AND con.contype = 'u'
    `);
    assert.equal(uniques.length, 0);
    process.stdout.write('PASS D34 PostgreSQL\n');
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
  process.stderr.write(`Falha D34 PostgreSQL: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
