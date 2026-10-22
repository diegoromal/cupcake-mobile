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
  const url = process.env.D37_TEST_DATABASE_URL;
  if (!url) throw new Error('Defina D37_TEST_DATABASE_URL.');
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname) ||
      parsed.pathname !== '/cupcake_d37' ||
      [...parsed.searchParams].some(([key, value]) => key !== 'schema' || value !== 'public')) {
    throw new Error('D37 exige banco local cupcake_d37, schema public.');
  }
  process.env.DATABASE_URL = url;
  process.env.JWT_ACCESS_SECRET = `d37-${randomUUID()}`;
  process.env.JWT_REFRESH_SECRET = `d37-refresh-${randomUUID()}`;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const userId = randomUUID();
  const categoryId = randomUUID();
  const productId = randomUUID();
  const optionAdjust = randomUUID();
  const optionNull = randomUUID();
  let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;
  try {
    await prisma.usuario.create({ data: {
      id: userId, nome: 'D37', email: `d37-${userId}@example.test`, telefone: '00000000000',
      credencialSenha: 'fixture', perfil: PerfilUsuario.CLIENTE,
    } });
    await prisma.categoria.create({ data: { id: categoryId, nome: `D37 ${categoryId}` } });
    await prisma.produto.create({ data: {
      id: productId, categoriaId: categoryId, nome: 'D37', precoAtual: '10.00', ativo: true,
    } });
    await prisma.estoque.create({ data: {
      produtoId: productId, quantidadeFisica: 5, quantidadeReservada: 2,
    } });
    await prisma.personalizacao.createMany({ data: [
      { id: optionAdjust, nome: 'D37 ajuste', ajusteValor: '0.10' },
      { id: optionNull, nome: 'D37 nulo', ajusteValor: null },
    ] });
    await prisma.produtoPersonalizacao.createMany({ data: [
      { produtoId: productId, personalizacaoId: optionAdjust },
      { produtoId: productId, personalizacaoId: optionNull },
    ] });
    const reservasAntes = await prisma.reservaEstoque.count({ where: { produtoId: productId } });
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    const http = app.getHttpServer();
    const jwt = new JwtService();
    const authorization = `Bearer ${await jwt.signAsync(
      { sub: userId, perfil: 'CLIENTE', type: 'access' },
      { secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m' },
    )}`;
    const post = (quantidade: number) => request(http).post('/carrinho/itens')
      .set('Authorization', authorization)
      .send({ produtoId: productId, quantidade, personalizacaoIds: [optionAdjust, optionNull] });
    const created = await post(2).expect(201);
    assert.deepEqual(Object.keys(created.body).sort(),
      ['carrinhoId', 'id', 'personalizacaoIds', 'produtoId', 'quantidade']);
    assert.equal(JSON.stringify(created.body).includes('preco'), false);
    const second = await post(2).expect(201);
    assert.notEqual(second.body.id, created.body.id);
    const priced = await request(http).get('/carrinho').set('Authorization', authorization).expect(200);
    assert.equal(priced.body.subtotal, '40.40');
    assert.equal(priced.body.total, '40.40');
    const lines = priced.body.itens as Array<{
      id: string; quantidade: number; precoUnitario: string; subtotal: string;
      disponivel: boolean; motivo: string | null;
    }>;
    assert.equal(lines.length, 2);
    for (const line of lines) {
      assert.equal(line.quantidade, 2);
      assert.equal(line.precoUnitario, '10.10');
      assert.equal(line.subtotal, '20.20');
      assert.equal(line.disponivel, true);
      assert.equal(line.motivo, null);
    }
    await prisma.estoque.update({
      where: { produtoId: productId },
      data: { quantidadeReservada: 4 },
    });
    const short = await request(http).get('/carrinho').set('Authorization', authorization).expect(200);
    assert.equal(short.body.subtotal, '40.40');
    assert.equal(short.body.total, '40.40');
    for (const line of short.body.itens as typeof lines) {
      assert.equal(line.precoUnitario, '10.10');
      assert.equal(line.subtotal, '20.20');
      assert.equal(line.disponivel, false);
      assert.equal(line.motivo, 'Quantidade superior à disponibilidade.');
    }
    await prisma.produto.update({ where: { id: productId }, data: { ativo: false } });
    const inactive = await request(http).get('/carrinho').set('Authorization', authorization).expect(200);
    assert.equal(inactive.body.subtotal, '0.00');
    assert.equal(inactive.body.total, '0.00');
    for (const line of inactive.body.itens as typeof lines) {
      assert.equal(line.precoUnitario, null);
      assert.equal(line.subtotal, null);
      assert.equal(line.disponivel, false);
      assert.equal(line.motivo, 'Produto indisponível.');
    }
    await request(http).delete(`/carrinho/itens/${created.body.id}`)
      .set('Authorization', authorization).expect(204);
    const estoque = await prisma.estoque.findUniqueOrThrow({ where: { produtoId: productId } });
    assert.equal(estoque.quantidadeFisica, 5);
    assert.equal(estoque.quantidadeReservada, 4);
    assert.equal(await prisma.reservaEstoque.count({ where: { produtoId: productId } }), reservasAntes);
    assert.equal(await prisma.itemCarrinho.count({ where: { produtoId: productId } }), 1);
    process.stdout.write('PASS D37 PostgreSQL\n');
  } finally {
    if (app) await app.close();
    await prisma.carrinho.deleteMany({ where: { usuarioId: userId } });
    await prisma.produtoPersonalizacao.deleteMany({ where: { produtoId: productId } });
    await prisma.personalizacao.deleteMany({ where: { id: { in: [optionAdjust, optionNull] } } });
    await prisma.reservaEstoque.deleteMany({ where: { produtoId: productId } });
    await prisma.estoque.deleteMany({ where: { produtoId: productId } });
    await prisma.produto.deleteMany({ where: { id: productId } });
    await prisma.categoria.deleteMany({ where: { id: categoryId } });
    await prisma.usuario.deleteMany({ where: { id: userId } });
    assert.equal(await prisma.carrinho.count({ where: { usuarioId: userId } }), 0);
    assert.equal(await prisma.itemCarrinho.count({ where: { produtoId: productId } }), 0);
    assert.equal(await prisma.produto.count({ where: { id: productId } }), 0);
    assert.equal(await prisma.usuario.count({ where: { id: userId } }), 0);
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Falha D37 PostgreSQL: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
