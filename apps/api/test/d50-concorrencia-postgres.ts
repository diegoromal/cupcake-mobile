import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import type { Response } from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaClient } from '../src/generated/prisma/client';

async function main() {
  const url = process.env.D50_TEST_DATABASE_URL;
  if (!url || new URL(url).hostname !== 'localhost' || new URL(url).pathname !== '/cupcake_d50') {
    throw new Error('D50 exige D50_TEST_DATABASE_URL para localhost/cupcake_d50.');
  }
  process.env.DATABASE_URL = url;
  process.env.JWT_ACCESS_SECRET = `d50-${randomUUID()}`;
  process.env.JWT_REFRESH_SECRET = `d50-refresh-${randomUUID()}`;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const users = [randomUUID(), randomUUID()];
  const category = randomUUID();
  const product = randomUUID();
  const otherProduct = randomUUID();
  const personalization = randomUUID();
  const config = randomUUID();
  const addresses = [randomUUID(), randomUUID()];
  const independentUsers = [randomUUID(), randomUUID()];
  const orders = new Set<string>();
  const pending = new Set<Promise<Response>>();
  const allUsers = [...users, ...independentUsers];
  const allProducts = [product, otherProduct];
  const track = (operation: PromiseLike<Response>): Promise<Response> => {
    const promise = Promise.resolve(operation).then((response) => {
      if (response.status === 201 && typeof response.body.id === 'string') orders.add(response.body.id);
      return response;
    });
    pending.add(promise);
    void promise.then(() => pending.delete(promise), () => pending.delete(promise));
    return promise;
  };
  const bounded = async <T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([promise, new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), milliseconds);
      })]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
  const removeOrders = async (scopedUsers: string[]) => {
    const found = await prisma.pedido.findMany({ where: { clienteUsuarioId: { in: scopedUsers } },
      select: { id: true } });
    const ids = found.map((row) => row.id);
    await prisma.itemPedidoPersonalizacaoSnapshot.deleteMany({
      where: { itemPedido: { pedidoId: { in: ids } } },
    });
    await prisma.reservaEstoque.deleteMany({ where: { pedidoId: { in: ids } } });
    await prisma.itemPedido.deleteMany({ where: { pedidoId: { in: ids } } });
    await prisma.enderecoEntregaSnapshot.deleteMany({ where: { pedidoId: { in: ids } } });
    await prisma.pedido.deleteMany({ where: { id: { in: ids } } });
    for (const id of ids) orders.delete(id);
    return ids;
  };
  let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;
  let checks = 0;
  try {
    const [database] = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    assert.equal(database.name, 'cupcake_d50'); checks++;
    const migrations = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
      SELECT migration_name, finished_at FROM "_prisma_migrations"`;
    for (const name of readdirSync(resolve(__dirname, '../prisma/migrations')).filter((v) => /^\d+_/.test(v))) {
      assert(migrations.some((row) => row.migration_name === name && row.finished_at)); checks++;
    }
    await prisma.usuario.createMany({ data: users.map((id, i) => ({ id, nome: `D50 ${i}`,
      email: `d50-${id}@example.test`, telefone: '00000000000', credencialSenha: 'fixture', perfil: 'CLIENTE' })) });
    await prisma.categoria.create({ data: { id: category, nome: `D50 ${category}` } });
    await prisma.produto.create({ data: { id: product, categoriaId: category, nome: 'D50 produto', precoAtual: '10.00' } });
    await prisma.estoque.create({ data: { produtoId: product, quantidadeFisica: 3, quantidadeReservada: 0 } });
    for (const user of users) {
      await prisma.carrinho.create({ data: { usuarioId: user,
        itens: { create: [{ produtoId: product, quantidade: 1 }, { produtoId: product, quantidade: 1 }] } } });
    }
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    const http = app.getHttpServer();
    const jwt = new JwtService();
    const auth = new Map<string, string>(allUsers.map((user) => [user, `Bearer ${jwt.sign(
      { sub: user, perfil: 'CLIENTE', type: 'access' },
      { secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m' })}`]));
    const post = (user: string, body: object) => track(request(http).post('/pedidos')
      .set('Authorization', auth.get(user)!)
      .send(body));
    const review = (user: string, body: object = { modalidade: 'RETIRADA' }) => request(http).post('/pedidos/revisao')
      .set('Authorization', auth.get(user)!)
      .send(body);
    const firstReview = await review(users[0]);
    assert.equal(firstReview.status, 201); checks++;
    assert.equal(firstReview.body.total, '20.00'); checks++;
    assert.equal(firstReview.body.itens.length, 2); checks++;
    const sameContextOtherClient = await review(users[1]);
    assert.equal(sameContextOtherClient.status, 201); checks++;
    assert.notEqual(sameContextOtherClient.body.revisaoId, firstReview.body.revisaoId); checks++;
    const foreignRevision = await post(users[1], { modalidade: 'RETIRADA',
      tentativaId: randomUUID(), revisaoId: firstReview.body.revisaoId });
    assert.equal(foreignRevision.status, 409); checks++;
    assert.equal(foreignRevision.body.message, 'Revisão desatualizada. Atualize os valores.'); checks++;
    assert.equal(await prisma.pedido.count({ where: { clienteUsuarioId: { in: users } } }), 0); checks++;
    assert.equal(await prisma.reservaEstoque.count({ where: { produtoId: product } }), 0); checks++;
    assert.equal((await prisma.estoque.findUniqueOrThrow({ where: { produtoId: product } })).quantidadeReservada, 0); checks++;
    await prisma.produto.update({ where: { id: product }, data: { precoAtual: '11.00' } });
    const stale = await post(users[0], { modalidade: 'RETIRADA', revisaoId: firstReview.body.revisaoId });
    assert.equal(stale.status, 409); checks++;
    assert.equal(await prisma.pedido.count({ where: { clienteUsuarioId: { in: users } } }), 0); checks++;
    const currentReview = await review(users[0]);
    assert.equal(currentReview.body.total, '22.00'); checks++;
    const otherReview = await review(users[1]);
    assert.equal(otherReview.status, 201); checks++;
    const attempts = users.map(() => randomUUID());
    const responses = await Promise.all(users.map((user, i) => post(user,
      { modalidade: 'RETIRADA', tentativaId: attempts[i],
        revisaoId: i === 0 ? currentReview.body.revisaoId : otherReview.body.revisaoId })));
    assert.equal(responses.filter((r) => r.status === 201).length, 1); checks++;
    assert.equal(responses.filter((r) => r.status === 409).length, 1); checks++;
    const winner = responses.findIndex((r) => r.status === 201);
    const winnerRevision = winner === 0 ? currentReview.body.revisaoId : otherReview.body.revisaoId;
    const retry = await post(users[winner], { modalidade: 'RETIRADA', tentativaId: attempts[winner],
      revisaoId: winnerRevision });
    assert.equal(retry.status, 201); checks++;
    assert.equal(retry.body.id, responses[winner].body.id); checks++;
    const stolen = await post(users[1 - winner], { modalidade: 'RETIRADA', tentativaId: attempts[winner],
      revisaoId: winnerRevision });
    assert.equal(stolen.status, 409); checks++;
    const stock = await prisma.estoque.findUniqueOrThrow({ where: { produtoId: product } });
    assert.equal(stock.quantidadeFisica, 3); checks++;
    assert.equal(stock.quantidadeReservada, 2); checks++;
    assert(stock.quantidadeReservada <= stock.quantidadeFisica); checks++;
    assert.equal(await prisma.pedido.count({ where: { clienteUsuarioId: { in: users } } }), 1); checks++;
    assert.equal(await prisma.itemPedido.count({ where: { pedidoId: { in: [...orders] } } }), 2); checks++;
    assert.equal(await prisma.reservaEstoque.count({ where: { pedidoId: { in: [...orders] }, estado: 'ATIVA' } }), 2); checks++;
    assert.equal(await prisma.movimentacaoEstoque.count({ where: { produtoId: product } }), 0); checks++;
    // Outra tentativa, enviada duas vezes ao mesmo tempo, deve criar apenas um pedido.
    await prisma.estoque.update({ where: { produtoId: product }, data: { quantidadeFisica: 4 } });
    const duplicateKey = randomUUID();
    const duplicateReview = await review(users[1 - winner]);
    assert.equal(duplicateReview.status, 201); checks++;
    const duplicates = await Promise.all([0, 1].map(() => post(users[1 - winner],
      { modalidade: 'RETIRADA', tentativaId: duplicateKey,
        revisaoId: duplicateReview.body.revisaoId })));
    assert(duplicates.every((response) => response.status === 201)); checks++;
    assert.equal(duplicates[0].body.id, duplicates[1].body.id); checks++;
    assert.equal(await prisma.pedido.count({ where: { clienteUsuarioId: { in: users } } }), 2); checks++;
    const finalStock = await prisma.estoque.findUniqueOrThrow({ where: { produtoId: product } });
    assert.equal(finalStock.quantidadeFisica, 4); checks++;
    assert.equal(finalStock.quantidadeReservada, 4); checks++;
    assert.equal(await prisma.reservaEstoque.count({ where: { pedidoId: { in: [...orders] } } }), 4); checks++;
    assert.equal(await prisma.movimentacaoEstoque.count({ where: { produtoId: product } }), 0); checks++;
    // Produtos distintos compartilham a mesma configuração e, depois, a mesma personalização.
    await prisma.usuario.createMany({ data: independentUsers.map((id, i) => ({ id,
      nome: `D50 independente ${i}`, email: `d50-${id}@example.test`,
      telefone: '00000000000', credencialSenha: 'fixture', perfil: 'CLIENTE' })) });
    await prisma.produto.create({ data: { id: otherProduct, categoriaId: category,
      nome: 'D50 outro produto', precoAtual: '10.00' } });
    await prisma.estoque.create({ data: { produtoId: otherProduct,
      quantidadeFisica: 1, quantidadeReservada: 0 } });
    await prisma.estoque.update({ where: { produtoId: product }, data: { quantidadeFisica: 5 } });
    for (const [i, user] of independentUsers.entries()) {
      await prisma.carrinho.create({ data: { usuarioId: user,
        itens: { create: [{ produtoId: i === 0 ? product : otherProduct, quantidade: 1 }] } } });
    }
    await prisma.endereco.createMany({ data: independentUsers.map((user, i) => ({
      id: addresses[i], usuarioId: user, rua: 'Rua D50', numero: String(i + 1),
      bairro: 'Centro', cidade: 'Curitiba', cep: '80000000',
      latitude: '0.000000', longitude: '0.000000',
    })) });
    assert.equal(await prisma.configuracaoLojaEntrega.count(), 0); checks++;
    await prisma.configuracaoLojaEntrega.create({ data: {
      id: config, latitudeLoja: '0.000000', longitudeLoja: '0.000000',
      raioMaximoAtendimento: '10.000', taxaBase: '2.05', valorPorQuilometro: '0.00',
    } });
    const runIndependent = async (modalidade: 'ENTREGA' | 'RETIRADA', failAfterB = false) => {
      const body = (i: number) => modalidade === 'ENTREGA'
        ? { modalidade, enderecoId: addresses[i] } : { modalidade };
      const revisions = await Promise.all(independentUsers.map((user, i) => review(user, body(i))));
      assert(revisions.every((response) => response.status === 201)); checks++;
      let release!: () => void;
      let locked!: (pid: number) => void;
      const held = new Promise<number>((resolve) => { locked = resolve; });
      const freed = new Promise<void>((resolve) => { release = resolve; });
      const blocker = prisma.$transaction(async (db) => {
        await db.$queryRaw`SELECT "produtoId" FROM "Estoque" WHERE "produtoId" = ${product}::uuid FOR UPDATE`;
        const [connection] = await db.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
        locked(connection.pid);
        await freed;
      }, { timeout: 20000 });
      void blocker.catch(() => undefined);
      let resultA: Promise<Response> | undefined;
      let resultB: Promise<Response> | undefined;
      try {
        const blockerPid = await bounded(held, 4000, 'Lock de teste não adquirido');
        let aFinished = false;
        resultA = post(independentUsers[0], { ...body(0), tentativaId: randomUUID(),
          revisaoId: revisions[0].body.revisaoId }).then((response) => {
          aFinished = true; return response;
        });
        void resultA.catch(() => undefined);
        let blocked = false;
        for (let i = 0; i < 80 && !blocked; i++) {
          const [activity] = await prisma.$queryRaw<Array<{ waiting: bigint }>>`
            SELECT count(*) AS waiting FROM pg_stat_activity
            WHERE datname = current_database() AND wait_event_type = 'Lock'
              AND query LIKE '%"Estoque"%' AND ${blockerPid} = ANY(pg_blocking_pids(pid))`;
          blocked = activity.waiting > 0n;
          if (!blocked) await new Promise((resolve) => setTimeout(resolve, 50));
        }
        assert(blocked, 'A deve aguardar exclusivamente o lock controlado de Estoque A'); checks++;
        resultB = post(independentUsers[1], { ...body(1), tentativaId: randomUUID(),
          revisaoId: revisions[1].body.revisaoId });
        const completedB = await bounded(resultB, 4000, 'B bloqueado por A');
        assert.equal(completedB.status, 201); checks++;
        assert.equal(aFinished, false); checks++;
        if (failAfterB) throw new Error('falha de assertion injetada após B');
      } finally {
        release();
        const outstanding: Promise<unknown>[] = [blocker];
        if (resultA) outstanding.push(resultA);
        if (resultB) outstanding.push(resultB);
        await Promise.allSettled(outstanding);
      }
      assert.equal((await resultA!).status, 201); checks++;
    };
    await runIndependent('ENTREGA');
    await prisma.estoque.update({ where: { produtoId: product }, data: { quantidadeFisica: 6 } });
    await prisma.estoque.update({ where: { produtoId: otherProduct }, data: { quantidadeFisica: 2 } });
    await prisma.personalizacao.create({ data: { id: personalization,
      nome: 'D50 compartilhada', ajusteValor: '0.20' } });
    await prisma.produtoPersonalizacao.createMany({ data: allProducts.map((produtoId) => ({
      produtoId, personalizacaoId: personalization,
    })) });
    const independentCarts = await prisma.itemCarrinho.findMany({
      where: { carrinho: { usuarioId: { in: independentUsers } } }, select: { id: true },
    });
    await prisma.itemCarrinhoPersonalizacao.createMany({ data: independentCarts.map((item) => ({
      itemCarrinhoId: item.id, personalizacaoId: personalization,
    })) });
    await runIndependent('RETIRADA');
    await prisma.estoque.update({ where: { produtoId: product }, data: { quantidadeFisica: 7 } });
    await prisma.estoque.update({ where: { produtoId: otherProduct }, data: { quantidadeFisica: 3 } });
    await assert.rejects(runIndependent('RETIRADA', true), /falha de assertion injetada/); checks++;
    const cleanedAfterFailure = await removeOrders(independentUsers);
    assert.equal(cleanedAfterFailure.length, 6); checks++;
    assert.equal(await prisma.pedido.count({ where: { clienteUsuarioId: { in: independentUsers } } }), 0); checks++;
    assert.equal(await prisma.reservaEstoque.count({ where: { pedidoId: { in: cleanedAfterFailure } } }), 0); checks++;
    assert.equal(await prisma.itemPedidoPersonalizacaoSnapshot.count({
      where: { itemPedido: { pedidoId: { in: cleanedAfterFailure } } },
    }), 0); checks++;
    const stockA = await prisma.estoque.findUniqueOrThrow({ where: { produtoId: product } });
    const stockB = await prisma.estoque.findUniqueOrThrow({ where: { produtoId: otherProduct } });
    assert.equal(stockA.quantidadeFisica, 7); checks++;
    assert.equal(stockA.quantidadeReservada, 7); checks++;
    assert.equal(stockB.quantidadeFisica, 3); checks++;
    assert.equal(stockB.quantidadeReservada, 3); checks++;
    assert.equal(await prisma.movimentacaoEstoque.count({ where: { produtoId: { in: [product, otherProduct] } } }), 0); checks++;
  } finally {
    await Promise.allSettled([...pending]);
    if (app) await app.close();
    const removed = await removeOrders(allUsers);
    await prisma.itemCarrinhoPersonalizacao.deleteMany({ where: {
      itemCarrinho: { carrinho: { usuarioId: { in: allUsers } } },
    } });
    await prisma.itemCarrinho.deleteMany({ where: { carrinho: { usuarioId: { in: allUsers } } } });
    await prisma.carrinho.deleteMany({ where: { usuarioId: { in: allUsers } } });
    await prisma.configuracaoLojaEntrega.deleteMany({ where: { id: config } });
    await prisma.endereco.deleteMany({ where: { id: { in: addresses } } });
    await prisma.produtoPersonalizacao.deleteMany({ where: { produtoId: { in: allProducts },
      personalizacaoId: personalization } });
    await prisma.personalizacao.deleteMany({ where: { id: personalization } });
    await prisma.estoque.deleteMany({ where: { produtoId: { in: allProducts } } });
    await prisma.produto.deleteMany({ where: { id: { in: allProducts } } });
    await prisma.categoria.deleteMany({ where: { id: category } });
    await prisma.usuario.deleteMany({ where: { id: { in: allUsers } } });
    assert.equal(await prisma.pedido.count({ where: { id: { in: removed } } }), 0); checks++;
    assert.equal(await prisma.reservaEstoque.count({ where: { pedidoId: { in: removed } } }), 0); checks++;
    assert.equal(await prisma.itemPedido.count({ where: { pedidoId: { in: removed } } }), 0); checks++;
    assert.equal(await prisma.itemPedidoPersonalizacaoSnapshot.count({
      where: { itemPedido: { pedidoId: { in: removed } } },
    }), 0); checks++;
    assert.equal(await prisma.enderecoEntregaSnapshot.count({ where: { pedidoId: { in: removed } } }), 0); checks++;
    assert.equal(await prisma.carrinho.count({ where: { usuarioId: { in: allUsers } } }), 0); checks++;
    assert.equal(await prisma.itemCarrinho.count({ where: { produtoId: { in: allProducts } } }), 0); checks++;
    assert.equal(await prisma.estoque.count({ where: { produtoId: { in: allProducts } } }), 0); checks++;
    assert.equal(await prisma.produto.count({ where: { id: { in: allProducts } } }), 0); checks++;
    assert.equal(await prisma.personalizacao.count({ where: { id: personalization } }), 0); checks++;
    assert.equal(await prisma.endereco.count({ where: { id: { in: addresses } } }), 0); checks++;
    assert.equal(await prisma.configuracaoLojaEntrega.count({ where: { id: config } }), 0); checks++;
    assert.equal(await prisma.usuario.count({ where: { id: { in: allUsers } } }), 0); checks++;
    await prisma.$disconnect();
  }
  process.stdout.write(`PASS D50 PostgreSQL (${checks} verificações; fixtures limpas)\n`);
}
main().catch((error: unknown) => { process.stderr.write(`${String(error)}\n`); process.exitCode = 1; });
