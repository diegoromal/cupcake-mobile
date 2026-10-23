import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaClient } from '../src/generated/prisma/client';
import { PerfilUsuario } from '../src/generated/prisma/enums';

function dedicatedDatabaseUrl(): string {
  const value = process.env.D49_TEST_DATABASE_URL;
  if (!value) throw new Error('Defina D49_TEST_DATABASE_URL.');
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      (url.port && url.port !== '5432') || url.pathname !== '/cupcake_d49' || url.hash ||
      [...url.searchParams].some(([key, content]) => key !== 'schema' || content !== 'public')) {
    throw new Error('D49 exige PostgreSQL local dedicado cupcake_d49, schema public.');
  }
  return value;
}

async function main() {
  const url = dedicatedDatabaseUrl();
  process.env.DATABASE_URL = url;
  process.env.JWT_ACCESS_SECRET = `d49-${randomUUID()}`;
  process.env.JWT_REFRESH_SECRET = `d49-refresh-${randomUUID()}`;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const marker = randomUUID();
  const userId = randomUUID();
  const otherId = randomUUID();
  const categoryId = randomUUID();
  const productIds = [randomUUID(), randomUUID()];
  const personalizationId = randomUUID();
  const addressId = randomUUID();
  const otherAddressId = randomUUID();
  const configId = randomUUID();
  const orderIds: string[] = [];
  let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;
  let databaseReady = false;
  let checks = 0;
  async function assertStock(fisica: number, reservadoA: number, reservadoB: number) {
    const stock = await prisma.estoque.findMany({ where: { produtoId: { in: productIds } } });
    assert.equal(stock.length, productIds.length); checks++;
    assert.deepEqual(stock.map((row) => row.produtoId).sort(), [...productIds].sort()); checks++;
    assert.equal(stock.find((row) => row.produtoId === productIds[0])?.quantidadeFisica, fisica); checks++;
    assert.equal(stock.find((row) => row.produtoId === productIds[1])?.quantidadeFisica, 10); checks++;
    assert.equal(stock.find((row) => row.produtoId === productIds[0])?.quantidadeReservada, reservadoA); checks++;
    assert.equal(stock.find((row) => row.produtoId === productIds[1])?.quantidadeReservada, reservadoB); checks++;
  }
  try {
    const [database] = await prisma.$queryRaw<Array<{ name: string; schema: string }>>`
      SELECT current_database() AS name, current_schema() AS schema`;
    assert.deepEqual(database, { name: 'cupcake_d49', schema: 'public' });
    databaseReady = true;
    checks++;
    const expectedMigrations = readdirSync(resolve(__dirname, '../prisma/migrations'))
      .filter((name) => /^\d+_/.test(name));
    const migrations = await prisma.$queryRaw<Array<{
      migration_name: string; finished_at: Date | null; rolled_back_at: Date | null;
    }>>`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`;
    for (const name of expectedMigrations) {
      assert(migrations.some((row) => row.migration_name === name &&
        row.finished_at !== null && row.rolled_back_at === null), `Migration pendente: ${name}`);
      checks++;
    }
    await prisma.usuario.createMany({ data: [
      { id: userId, nome: 'D49 cliente', email: `d49-${marker}@example.test`,
        telefone: '00000000000', credencialSenha: 'fixture', perfil: PerfilUsuario.CLIENTE },
      { id: otherId, nome: 'D49 outro', email: `d49-other-${marker}@example.test`,
        telefone: '00000000000', credencialSenha: 'fixture', perfil: PerfilUsuario.CLIENTE },
    ] });
    await prisma.categoria.create({ data: { id: categoryId, nome: `D49 ${marker}` } });
    await prisma.produto.createMany({ data: [
      { id: productIds[0], categoriaId: categoryId, nome: 'D49 A', precoAtual: '10.10' },
      { id: productIds[1], categoriaId: categoryId, nome: 'D49 B', precoAtual: '0.11' },
    ] });
    await prisma.estoque.createMany({ data: productIds.map((produtoId) => ({
      produtoId, quantidadeFisica: produtoId === productIds[0] ? 30 : 10, quantidadeReservada: 0,
    })) });
    await prisma.personalizacao.create({ data: {
      id: personalizationId, nome: 'D49 cobertura', ajusteValor: '0.20',
    } });
    await prisma.produtoPersonalizacao.create({ data: {
      produtoId: productIds[0], personalizacaoId: personalizationId,
    } });
    await prisma.endereco.createMany({ data: [
      { id: addressId, usuarioId: userId, rua: 'Rua original', numero: '7',
        bairro: 'Centro', cidade: 'Curitiba', cep: '80000000', complemento: 'Casa',
        latitude: '0.000000', longitude: '0.000000' },
      { id: otherAddressId, usuarioId: otherId, rua: 'Rua alheia', numero: '8',
        bairro: 'Centro', cidade: 'Curitiba', cep: '80000000',
        latitude: '0.000000', longitude: '0.000000' },
    ] });
    await prisma.configuracaoLojaEntrega.create({ data: {
      id: configId, latitudeLoja: '0.000000', longitudeLoja: '0.000000',
      raioMaximoAtendimento: '10.000', taxaBase: '2.05', valorPorQuilometro: '0.00',
    } });
    await prisma.carrinho.create({ data: { usuarioId: userId, itens: { create: [
      { produtoId: productIds[0], quantidade: 2,
        personalizacoes: { create: [{ personalizacaoId: personalizationId }] } },
      { produtoId: productIds[1], quantidade: 1 },
      { produtoId: productIds[0], quantidade: 7 },
    ] } } });
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    const http = app.getHttpServer();
    const jwt = new JwtService();
    const authorization = `Bearer ${await jwt.signAsync(
      { sub: userId, perfil: PerfilUsuario.CLIENTE, type: 'access' },
      { secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m' },
    )}`;
    const post = (body: object) => request(http).post('/pedidos')
      .set('Authorization', authorization).send(body);
    const review = (body: object) => request(http).post('/pedidos/revisao')
      .set('Authorization', authorization).send(body);

    await post({ modalidade: 'ENTREGA', enderecoId: otherAddressId, revisaoId: '0'.repeat(64) }).expect(404); checks++;
    assert.equal(await prisma.pedido.count({ where: { clienteUsuarioId: userId } }), 0); checks++;
    await prisma.produto.update({ where: { id: productIds[0] }, data: { precoAtual: '12.34' } });
    const deliveryReview = await review({ modalidade: 'ENTREGA', enderecoId: addressId }).expect(201);
    const created = await post({ modalidade: 'ENTREGA', enderecoId: addressId,
      revisaoId: deliveryReview.body.revisaoId }).expect(201); checks++;
    orderIds.push(created.body.id as string);
    assert.deepEqual([created.body.modalidade, created.body.valorItens,
      created.body.freteAplicado, created.body.total], ['ENTREGA', '111.57', '2.05', '113.62']); checks++;
    const delivery = await prisma.pedido.findUniqueOrThrow({
      where: { id: created.body.id as string },
      include: { itens: { include: { personalizacoes: true } }, enderecoEntregaSnapshot: true },
    });
    assert.equal(delivery.clienteUsuarioId, userId); checks++;
    assert.equal(delivery.itens.length, 3); checks++;
    assert.equal(delivery.enderecoEntregaSnapshot?.rua, 'Rua original'); checks++;
    assert.deepEqual(delivery.itens.map((item) => item.subtotalAplicado.toFixed(2)).sort(),
      ['0.11', '25.08', '86.38']); checks++;
    const sameProduct = delivery.itens.filter((item) => item.produtoId === productIds[0]);
    assert.equal(sameProduct.length, 2); checks++;
    const customized = sameProduct.find((item) => item.quantidade === 2);
    const plain = sameProduct.find((item) => item.quantidade === 7);
    assert.equal(customized?.quantidade, 2); checks++;
    assert.equal(customized?.precoAplicado.toFixed(2), '12.54'); checks++;
    assert.equal(customized?.personalizacoes[0].nomeAplicado, 'D49 cobertura'); checks++;
    assert.equal(customized?.personalizacoes[0].ajusteValorAplicado?.toFixed(2), '0.20'); checks++;
    assert.equal(plain?.precoAplicado.toFixed(2), '12.34'); checks++;
    assert.equal(plain?.subtotalAplicado.toFixed(2), '86.38'); checks++;
    assert.equal(plain?.personalizacoes.length, 0); checks++;
    await assertStock(30, 9, 1);
    await prisma.endereco.update({ where: { id: addressId }, data: { rua: 'Rua alterada' } });
    await prisma.personalizacao.update({ where: { id: personalizationId },
      data: { nome: 'Cobertura alterada', ajusteValor: '1.00' } });
    const historical = await prisma.pedido.findUniqueOrThrow({ where: { id: delivery.id },
      include: { enderecoEntregaSnapshot: true,
        itens: { include: { personalizacoes: true } } } });
    assert.equal(historical.enderecoEntregaSnapshot?.rua, 'Rua original'); checks++;
    assert.equal(historical.itens.find((item) => item.produtoId === productIds[0] && item.quantidade === 2)
      ?.personalizacoes[0].nomeAplicado, 'D49 cobertura'); checks++;
    assert.equal(historical.total.toFixed(2), '113.62'); checks++;

    const pickupReview = await review({ modalidade: 'RETIRADA' }).expect(201);
    const pickup = await post({ modalidade: 'RETIRADA', revisaoId: pickupReview.body.revisaoId }).expect(201); checks++;
    orderIds.push(pickup.body.id as string);
    const pickupPersisted = await prisma.pedido.findUniqueOrThrow({
      where: { id: pickup.body.id as string }, include: { enderecoEntregaSnapshot: true, itens: true },
    });
    assert.equal(pickupPersisted.modalidade, 'RETIRADA'); checks++;
    assert.equal(pickupPersisted.enderecoEntregaSnapshot, null); checks++;
    assert.equal(pickupPersisted.freteAplicado.toFixed(2), '0.00'); checks++;
    assert.equal(pickupPersisted.total.toFixed(2), '113.17'); checks++;
    assert.equal(await prisma.itemCarrinho.count({ where: { carrinho: { usuarioId: userId } } }), 3); checks++;
    const reservations = await prisma.reservaEstoque.findMany({ where: { pedidoId: { in: orderIds } } });
    assert.equal(reservations.length, 6); checks++;
    for (const orderId of orderIds) {
      const order = await prisma.pedido.findUniqueOrThrow({ where: { id: orderId }, include: { itens: true } });
      const own = reservations.filter((row) => row.pedidoId === orderId);
      assert.equal(order.statusAtual, 'PENDENTE_PAGAMENTO'); checks++;
      assert.equal(own.length, 3); checks++;
      assert.deepEqual(own.map((row) => `${row.produtoId}:${row.quantidade}`).sort(),
        order.itens.map((row) => `${row.produtoId}:${row.quantidade}`).sort()); checks++;
      assert(own.every((row) => row.estado === 'ATIVA' &&
        row.momentoExpiracaoValidade.getTime() === order.data.getTime() + 900000)); checks++;
      assert.equal(own.filter((row) => row.produtoId === productIds[0]).length, 2); checks++;
    }
    await assertStock(30, 18, 2);
    assert.equal(await prisma.movimentacaoEstoque.count({ where: { produtoId: { in: productIds } } }), 0); checks++;

    const cart = await prisma.carrinho.findUniqueOrThrow({ where: { usuarioId: userId } });
    await prisma.itemCarrinhoPersonalizacao.deleteMany({ where: { itemCarrinho: { carrinhoId: cart.id } } });
    await prisma.itemCarrinho.deleteMany({ where: { carrinhoId: cart.id } });
    await prisma.itemCarrinho.createMany({ data: [
      { carrinhoId: cart.id, produtoId: productIds[1], quantidade: 5 },
      { carrinhoId: cart.id, produtoId: productIds[1], quantidade: 4 },
    ] });
    const beforeInsufficient = await prisma.estoque.findMany({ where: { produtoId: { in: productIds } } });
    const unavailableStock = beforeInsufficient.find((row) => row.produtoId === productIds[1]);
    assert(unavailableStock); checks++;
    assert.equal(unavailableStock?.quantidadeFisica, 10); checks++;
    assert.equal(unavailableStock?.quantidadeReservada, 2); checks++;
    assert.equal(unavailableStock.quantidadeFisica - unavailableStock.quantidadeReservada, 8); checks++;
    const itemCountBeforeInsufficient = await prisma.itemPedido.count({ where: { pedido: { clienteUsuarioId: userId } } });
    const snapshotCountBeforeInsufficient = await prisma.itemPedidoPersonalizacaoSnapshot.count({
      where: { itemPedido: { pedido: { clienteUsuarioId: userId } } },
    });
    await post({ modalidade: 'RETIRADA', revisaoId: '0'.repeat(64) }).expect(409); checks++;
    assert.equal(await prisma.pedido.count({ where: { clienteUsuarioId: userId } }), 2); checks++;
    assert.equal(await prisma.itemPedido.count({ where: { pedido: { clienteUsuarioId: userId } } }),
      itemCountBeforeInsufficient); checks++;
    assert.equal(await prisma.itemPedidoPersonalizacaoSnapshot.count({
      where: { itemPedido: { pedido: { clienteUsuarioId: userId } } },
    }), snapshotCountBeforeInsufficient); checks++;
    assert.equal(await prisma.reservaEstoque.count({ where: { pedido: { clienteUsuarioId: userId } } }), 6); checks++;
    assert.deepEqual(await prisma.estoque.findMany({ where: { produtoId: { in: productIds } } }), beforeInsufficient); checks++;
    await prisma.itemCarrinho.deleteMany({ where: { carrinhoId: cart.id } });
    await prisma.itemCarrinho.create({ data: { carrinhoId: cart.id, produtoId: productIds[0], quantidade: 2,
      personalizacoes: { create: [{ personalizacaoId: personalizationId }] } } });
    await prisma.itemCarrinho.createMany({ data: [
      { carrinhoId: cart.id, produtoId: productIds[1], quantidade: 1 },
      { carrinhoId: cart.id, produtoId: productIds[0], quantidade: 7 },
    ] });
    const countsBefore = {
      pedido: await prisma.pedido.count({ where: { clienteUsuarioId: userId } }),
      item: await prisma.itemPedido.count({ where: { pedido: { clienteUsuarioId: userId } } }),
      snapshot: await prisma.itemPedidoPersonalizacaoSnapshot.count({
        where: { itemPedido: { pedido: { clienteUsuarioId: userId } } },
      }),
      endereco: await prisma.enderecoEntregaSnapshot.count({ where: { pedido: { clienteUsuarioId: userId } } }),
      reserva: await prisma.reservaEstoque.count({ where: { pedido: { clienteUsuarioId: userId } } }),
      movimento: await prisma.movimentacaoEstoque.count({ where: { produtoId: { in: productIds } } }),
      estoque: await prisma.estoque.findMany({ where: { produtoId: { in: productIds } } }),
    };
    await prisma.$executeRawUnsafe(`ALTER TABLE "ReservaEstoque"
      ADD CONSTRAINT "d49_reservation_failure" CHECK ("quantidade" <> 7) NOT VALID`);
    const rollbackReview = await review({ modalidade: 'ENTREGA', enderecoId: addressId }).expect(201);
    await post({ modalidade: 'ENTREGA', enderecoId: addressId,
      revisaoId: rollbackReview.body.revisaoId }).expect(500); checks++;
    const countsAfter = {
      pedido: await prisma.pedido.count({ where: { clienteUsuarioId: userId } }),
      item: await prisma.itemPedido.count({ where: { pedido: { clienteUsuarioId: userId } } }),
      snapshot: await prisma.itemPedidoPersonalizacaoSnapshot.count({
        where: { itemPedido: { pedido: { clienteUsuarioId: userId } } },
      }),
      endereco: await prisma.enderecoEntregaSnapshot.count({ where: { pedido: { clienteUsuarioId: userId } } }),
      reserva: await prisma.reservaEstoque.count({ where: { pedido: { clienteUsuarioId: userId } } }),
      movimento: await prisma.movimentacaoEstoque.count({ where: { produtoId: { in: productIds } } }),
      estoque: await prisma.estoque.findMany({ where: { produtoId: { in: productIds } } }),
    };
    assert.deepEqual(countsAfter, countsBefore); checks++;
    await prisma.$executeRawUnsafe(`ALTER TABLE "ReservaEstoque"
      DROP CONSTRAINT "d49_reservation_failure"`);
  } finally {
    if (app) await app.close();
    if (databaseReady) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "ReservaEstoque"
        DROP CONSTRAINT IF EXISTS "d49_reservation_failure"`);
      await prisma.itemPedidoPersonalizacaoSnapshot.deleteMany({
        where: { itemPedido: { pedidoId: { in: orderIds } } },
      });
      await prisma.reservaEstoque.deleteMany({ where: { pedidoId: { in: orderIds } } });
      await prisma.itemPedido.deleteMany({ where: { pedidoId: { in: orderIds } } });
      await prisma.enderecoEntregaSnapshot.deleteMany({ where: { pedidoId: { in: orderIds } } });
      await prisma.pedido.deleteMany({ where: { id: { in: orderIds } } });
      await prisma.carrinho.deleteMany({ where: { usuarioId: userId } });
      await prisma.configuracaoLojaEntrega.deleteMany({ where: { id: configId } });
      await prisma.endereco.deleteMany({ where: { id: { in: [addressId, otherAddressId] } } });
      await prisma.produtoPersonalizacao.deleteMany({ where: { produtoId: productIds[0] } });
      await prisma.personalizacao.deleteMany({ where: { id: personalizationId } });
      await prisma.estoque.deleteMany({ where: { produtoId: { in: productIds } } });
      await prisma.produto.deleteMany({ where: { id: { in: productIds } } });
      await prisma.categoria.deleteMany({ where: { id: categoryId } });
      await prisma.usuario.deleteMany({ where: { id: { in: [userId, otherId] } } });
      assert.equal(await prisma.usuario.count({ where: { id: { in: [userId, otherId] } } }), 0); checks++;
      assert.equal(await prisma.pedido.count({ where: { id: { in: orderIds } } }), 0); checks++;
      assert.equal(await prisma.itemPedido.count({ where: { pedidoId: { in: orderIds } } }), 0); checks++;
      assert.equal(await prisma.reservaEstoque.count({ where: { pedidoId: { in: orderIds } } }), 0); checks++;
      assert.equal(await prisma.enderecoEntregaSnapshot.count({ where: { pedidoId: { in: orderIds } } }), 0); checks++;
      assert.equal(await prisma.produto.count({ where: { id: { in: productIds } } }), 0); checks++;
      assert.equal(await prisma.estoque.count({ where: { produtoId: { in: productIds } } }), 0); checks++;
      assert.equal(await prisma.carrinho.count({ where: { usuarioId: userId } }), 0); checks++;
    }
    await prisma.$disconnect();
  }
  process.stdout.write(`PASS D49 PostgreSQL (${checks} verificações, fixtures limpas)\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`Falha D49 PostgreSQL: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
