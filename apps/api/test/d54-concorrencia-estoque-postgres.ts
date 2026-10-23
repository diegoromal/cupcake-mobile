import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { BaseExceptionFilter } from '@nestjs/core';
import type { ArgumentsHost } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import type { Response } from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaClient } from '../src/generated/prisma/client';
import { LiberacaoReservasService } from '../src/pedidos/liberacao-reservas.service';

const raw = process.env.D54_TEST_DATABASE_URL;
if (!raw) throw new Error('Defina D54_TEST_DATABASE_URL.');
const url = new URL(raw);
if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    (url.port && url.port !== '5432') || url.pathname !== '/cupcake_d54' || url.hash ||
    [...url.searchParams].some(([key, value]) => key !== 'schema' || value !== 'public')) {
  throw new Error('D54 exige PostgreSQL local dedicado cupcake_d54, schema public.');
}
const runId = `d54_${randomUUID()}`;
url.searchParams.set('application_name', runId);
const databaseUrl = url.toString();
process.env.DATABASE_URL = databaseUrl;
process.env.JWT_ACCESS_SECRET = `d54-${randomUUID()}`;
process.env.JWT_REFRESH_SECRET = `d54-refresh-${randomUUID()}`;

type Fixture = { ids: string[]; clients: string[]; reviews: string[];
  carts: Array<Array<[number, number]>>; stock: number[] };
type SqlFailure = { sqlstate?: string; constraint?: string; message: string };
const failureConstraint = 'd54_reservation_failure';
function sqlError(error: unknown): SqlFailure {
  const result: SqlFailure = { message: String(error) };
  const visited = new Set<object>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    const fields = value as Record<string, unknown>;
    for (const key of ['sqlstate', 'sqlState', 'originalCode', 'code']) {
      if (fields[key] === '23514') result.sqlstate = '23514';
    }
    if (typeof fields.constraint === 'string') result.constraint = fields.constraint;
    if (typeof fields.message === 'string') result.message = fields.message;
    for (const nested of Object.values(fields)) visit(nested);
  };
  visit(error);
  if (!result.constraint && result.sqlstate === '23514') {
    const match = result.message.match(/violates check constraint "([^"]+)"/);
    if (match) result.constraint = match[1];
  }
  return result;
}
async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  const category = randomUUID(), users: string[] = [], products: string[] = [];
  const fiveNames = Array.from({ length: 5 }, (_, i) => `${runId}-d54-five-${i + 1}`);
  const pending = new Set<Promise<unknown>>();
  let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;
  const taggedApps: Array<Awaited<ReturnType<typeof NestFactory.create>>> = [];
  let ready = false, constraint = false, checks = 0, scenarios = 0;
  let initialDeadlocks = 0n;
  const sqlEvidence: { current?: SqlFailure } = {};
  const observedSqlFailure = () => sqlEvidence.current;
  let originalError: unknown;
  const cleanupErrors: unknown[] = [];
  const eq = (actual: unknown, expected: unknown, label?: string) => {
    assert.deepEqual(actual, expected, label ?? 'D54 assertion'); checks++;
  };
  const track = <T>(promise: Promise<T>): Promise<T> => {
    pending.add(promise);
    void promise.then(() => pending.delete(promise), () => pending.delete(promise));
    return promise;
  };
  const bounded = async <T>(promise: Promise<T>, label: string, ms = 20000): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([promise, new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timeout D54: ${label}`)), ms);
      })]);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Timeout D54:')) {
        process.stderr.write(`${error.message}; aguardando operação original antes da limpeza\n`);
        await Promise.allSettled([promise]);
      }
      throw error;
    } finally { if (timer) clearTimeout(timer); }
  };
  const awaitPending = async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      timer = setTimeout(() => process.stderr.write(
        `D54: ${pending.size} operações ainda pendentes após 30s; aguardando conclusão real antes da limpeza\n`), 30000);
      const results = await Promise.allSettled([...pending]);
      for (const result of results) if (result.status === 'rejected') cleanupErrors.push(result.reason);
      eq(pending.size, 0, 'Nenhuma operação permanece pendente antes da limpeza');
    } finally { if (timer) clearTimeout(timer); }
  };
  try {
    const [database] = await prisma.$queryRaw<Array<{ name: string; schema: string }>>`
      SELECT current_database() AS name, current_schema() AS schema`;
    eq(database, { name: 'cupcake_d54', schema: 'public' }); ready = true;
    const [databaseStats] = await prisma.$queryRaw<Array<{ deadlocks: bigint }>>`
      SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()`;
    initialDeadlocks = databaseStats.deadlocks;
    const migrations = await prisma.$queryRaw<Array<{
      migration_name: string; finished_at: Date | null; rolled_back_at: Date | null;
    }>>`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`;
    for (const name of readdirSync(resolve(__dirname, '../prisma/migrations')).filter((v) => /^\d+_/.test(v))) {
      assert(migrations.some((m) => m.migration_name === name && m.finished_at && !m.rolled_back_at),
        `Migration pendente: ${name}`); checks++;
    }
    await prisma.categoria.create({ data: { id: category, nome: `D54 ${category}` } });
    app = await NestFactory.create(AppModule, { logger: false });
    const defaultFilter = new BaseExceptionFilter(app.getHttpAdapter());
    app.useGlobalFilters({ catch(error: unknown, host: ArgumentsHost) {
      const failure = sqlError(error);
      if (failure.sqlstate === '23514' || failure.constraint === failureConstraint) sqlEvidence.current = failure;
      defaultFilter.catch(error, host);
    } });
    await app.init();
    const http = app.getHttpServer(), jwt = new JwtService();
    const token = (user: string) => `Bearer ${jwt.sign({ sub: user, perfil: 'CLIENTE', type: 'access' },
      { secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m' })}`;
    const review = (user: string) => track(Promise.resolve(request(http).post('/pedidos/revisao')
      .set('Authorization', token(user)).send({ modalidade: 'RETIRADA' })));
    const lockReady = <T>(signal: Promise<T>, blocker: Promise<unknown>, label: string) =>
      bounded(Promise.race([signal, blocker.then(() => {
        throw new Error(`Bloqueador terminou antes do sinal: ${label}`);
      })]), label, 5000);
    const post = (user: string, revisaoId: string, tentativaId = randomUUID(),
      server = http) => {
      const promise = Promise.resolve(request(server).post('/pedidos').set('Authorization', token(user))
        .send({ modalidade: 'RETIRADA', revisaoId, tentativaId }));
      return track(promise);
    };
    const fixture = async (stock: number[], carts: Fixture['carts']): Promise<Fixture> => {
      const ids = stock.map(() => randomUUID()).sort(); products.push(...ids);
      await prisma.produto.createMany({ data: ids.map((id, i) => ({ id, categoriaId: category,
        nome: `D54 produto ${i}`, precoAtual: '1.00' })) });
      await prisma.estoque.createMany({ data: ids.map((produtoId, i) => ({ produtoId,
        quantidadeFisica: stock[i], quantidadeReservada: 0 })) });
      const clients: string[] = [];
      for (const [i, cart] of carts.entries()) {
        const user = randomUUID(); users.push(user); clients.push(user);
        await prisma.usuario.create({ data: { id: user, nome: `D54 cliente ${i}`,
          email: `d54-${user}@example.test`, telefone: '00000000000',
          credencialSenha: 'fixture', perfil: 'CLIENTE' } });
        await prisma.carrinho.create({ data: { usuarioId: user,
          itens: { create: cart.map(([p, quantity]) => ({ produtoId: ids[p], quantidade: quantity })) } } });
      }
      const revisions = await Promise.all(clients.map(review));
      revisions.forEach((r) => eq(r.status, 201, `Revisão: ${JSON.stringify(r.body)}`));
      return { ids, clients, reviews: revisions.map((r) => r.body.revisaoId as string), carts, stock };
    };
    const verify = async (f: Fixture, responses: Response[], expected?: number,
      countScenario = true) => {
      eq(responses.filter((r) => /40P01|deadlock/i.test(JSON.stringify(r.body) + r.text)).length,
        0, `Deadlock SQLSTATE 40P01; produtos ${f.ids.join(',')}; locks por produtoId`);
      responses.forEach((r) => assert([201, 409, 500].includes(r.status), JSON.stringify(r.body)));
      const orders = await prisma.pedido.findMany({ where: { clienteUsuarioId: { in: f.clients } },
        include: { itens: true, reservasEstoque: true } });
      if (expected !== undefined) eq(orders.length, expected);
      eq(new Set(orders.map((p) => p.id)), new Set(responses.filter((r) => r.status === 201)
        .map((r) => r.body.id as string)));
      for (const order of orders) {
        const client = f.clients.indexOf(order.clienteUsuarioId);
        assert(client >= 0); checks++;
        eq(order.statusAtual, 'PENDENTE_PAGAMENTO');
        eq(order.itens.map((item) => [f.ids.indexOf(item.produtoId), item.quantidade]).sort(),
          [...f.carts[client]].sort());
        eq(order.reservasEstoque.length, order.itens.length);
        for (const item of order.itens) eq(order.reservasEstoque.filter((r) =>
          r.produtoId === item.produtoId && r.quantidade === item.quantidade && r.estado === 'ATIVA').length, 1);
      }
      for (const [i, product] of f.ids.entries()) {
        const row = await prisma.estoque.findUniqueOrThrow({ where: { produtoId: product } });
        const reservations = await prisma.reservaEstoque.findMany({ where: { produtoId: product,
          estado: 'ATIVA' }, select: { quantidade: true } });
        eq(row.quantidadeFisica, f.stock[i]);
        eq(row.quantidadeReservada, reservations.reduce((sum, r) => sum + r.quantidade, 0));
        assert(row.quantidadeReservada <= row.quantidadeFisica); checks++;
        eq(await prisma.movimentacaoEstoque.count({ where: { produtoId: product } }), 0);
      }
      eq(await prisma.itemPedido.count({ where: { pedido: { clienteUsuarioId: { in: f.clients } } } }),
        orders.reduce((n, p) => n + p.itens.length, 0));
      eq(await prisma.reservaEstoque.count({ where: { pedido: { clienteUsuarioId: { in: f.clients } } } }),
        orders.reduce((n, p) => n + p.reservasEstoque.length, 0));
      if (countScenario) scenarios++;
    };
    const launchContested = async (f: Fixture, sharedProduct: string) => {
      let unlock!: () => void, locked!: (pid: number) => void;
      const held = new Promise<number>((done) => { locked = done; });
      const freed = new Promise<void>((done) => { unlock = done; });
      const blocker = track(prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "produtoId" FROM "Estoque"
          WHERE "produtoId" = ${sharedProduct}::uuid FOR UPDATE`;
        const [backend] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
        locked(backend.pid); await freed;
      }, { timeout: 20000 }));
      void blocker.catch(() => undefined);
      let requests: Promise<Response>[] = [];
      try {
        const pid = await lockReady(held, blocker, 'lock multiproduto');
        requests = f.clients.map((user, i) => post(user, f.reviews[i]));
        let waiting = 0n, directlyBlocked = 0n;
        const expected = BigInt(requests.length);
        eq(requests.length, f.clients.length, 'Todas as requisições foram iniciadas');
        for (let i = 0; i < 160 && (waiting < expected || directlyBlocked < 1n); i++) {
          const [activity] = await prisma.$queryRaw<Array<{ n: bigint; direct: bigint }>>`
            SELECT count(*) AS n,
              count(*) FILTER (WHERE ${pid} = ANY(pg_blocking_pids(pid))) AS direct
            FROM pg_stat_activity WHERE datname = current_database() AND pid <> ${pid}
              AND wait_event_type = 'Lock'
              AND (query LIKE '%"Estoque"%' OR query LIKE '%"Produto"%')`;
          waiting = activity.n; directlyBlocked = activity.direct;
          if (waiting < expected || directlyBlocked < 1n) {
            await new Promise((done) => setTimeout(done, 50));
          }
        }
        eq(waiting, expected, `Todas as ${expected} transações devem aguardar Estoque ${sharedProduct}`);
        assert(directlyBlocked >= 1n, `Nenhuma espera direta no lock de ${sharedProduct}`); checks++;
        eq(requests.every((requestPromise) => pending.has(requestPromise)), true,
          'Nenhuma requisição pode terminar antes da liberação');
        const [owner] = await prisma.$queryRaw<Array<{ held: boolean }>>`
          SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE pid = ${pid}
            AND state = 'idle in transaction') AS held`;
        eq(owner.held, true, 'Lock principal ainda mantido');
      } finally { unlock(); await Promise.allSettled([blocker, ...requests]); }
      return bounded(Promise.all(requests), 'pedidos multiproduto');
    };
    const one = await fixture([10], [[[0, 7]], [[0, 7]]]);
    const r1 = await launchContested(one, one.ids[0]);
    eq(r1.map((r) => r.status).sort(), [201, 409]);
    await verify(one, r1, 1);

    const many = await fixture([20], [7, 6, 5, 4, 3].map((n) => [[0, n]]));
    const r2 = await launchContested(many, many.ids[0]);
    assert(r2.some((r) => r.status === 201) && r2.some((r) => r.status === 409)
      && r2.every((r) => [201, 409].includes(r.status))); checks++;
    await verify(many, r2);

    // O lock comercial de Produto serializa pedidos do mesmo produto. Cinco esperas
    // simultâneas em Estoque exigem cinco produtos distintos, todos bloqueados pela
    // mesma transação. A disputa do mesmo produto acima continua coberta.
    const five = await fixture([1, 1, 1, 1, 1],
      [0, 1, 2, 3, 4].map((i) => [[i, 1]]));
    const fiveServers: Array<typeof http> = [];
    const fiveErrors: string[] = [];
    for (const name of fiveNames) {
      const taggedUrl = new URL(databaseUrl);
      taggedUrl.searchParams.set('application_name', name);
      process.env.DATABASE_URL = taggedUrl.toString();
      const taggedApp = await NestFactory.create(AppModule, { logger: false });
      taggedApps.push(taggedApp);
      const taggedFilter = new BaseExceptionFilter(taggedApp.getHttpAdapter());
      taggedApp.useGlobalFilters({ catch(error: unknown, host: ArgumentsHost) {
        fiveErrors.push(`${name}: ${String(error)}`);
        taggedFilter.catch(error, host);
      } });
      await taggedApp.init();
      fiveServers.push(taggedApp.getHttpServer());
    }
    process.env.DATABASE_URL = databaseUrl;
    let releaseFive!: () => void, signalFive!: (pid: number) => void;
    const fiveHeld = new Promise<number>((done) => { signalFive = done; });
    const fiveFreed = new Promise<void>((done) => { releaseFive = done; });
    const fiveBlocker = track(prisma.$transaction(async (tx) => {
      for (const product of five.ids) {
        await tx.$queryRaw`SELECT "produtoId" FROM "Estoque"
          WHERE "produtoId" = ${product}::uuid FOR UPDATE`;
      }
      const [backend] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      signalFive(backend.pid); await fiveFreed;
    }, { timeout: 30000 }));
    void fiveBlocker.catch(() => undefined);
    let fiveRequests: Promise<Response>[] = [];
    try {
      const ownerPid = await lockReady(fiveHeld, fiveBlocker, 'cinco locks de Estoque');
      fiveRequests = five.clients.map((user, i) =>
        post(user, five.reviews[i], randomUUID(), fiveServers[i]));
      eq(fiveRequests.length, 5, 'Cinco requisições D54 identificadas');
      type FiveSession = { application_name: string; pid: number; state: string;
        wait_event_type: string | null; wait_event: string | null; query: string;
        blockers: number[]; estoque_relation: boolean; transaction_wait: boolean;
        owner_transaction: boolean };
      let sessions: FiveSession[] = [];
      const waitingOnStock = (row: FiveSession) => row.state === 'active'
        && row.wait_event_type === 'Lock' && row.wait_event === 'transactionid'
        && row.query.includes('FROM "Estoque"') && row.query.includes('FOR UPDATE')
        && !row.query.includes('FROM "Produto"')
        && row.blockers.length === 1 && row.blockers[0] === ownerPid
        && row.estoque_relation && row.transaction_wait && row.owner_transaction;
      for (let attempt = 0; attempt < 200; attempt++) {
        sessions = await prisma.$queryRaw<FiveSession[]>`
          SELECT a.application_name, a.pid, a.state, a.wait_event_type, a.wait_event,
            a.query, pg_blocking_pids(a.pid) AS blockers,
            EXISTS (SELECT 1 FROM pg_locks relation_lock
              WHERE relation_lock.pid = a.pid AND relation_lock.granted
                AND relation_lock.locktype = 'relation'
                AND relation_lock.relation = '"Estoque"'::regclass
                AND relation_lock.mode = 'RowShareLock') AS estoque_relation,
            EXISTS (SELECT 1 FROM pg_locks waiting_lock
              WHERE waiting_lock.pid = a.pid AND NOT waiting_lock.granted
                AND waiting_lock.locktype = 'transactionid') AS transaction_wait,
            EXISTS (SELECT 1 FROM pg_locks waiting_lock
              JOIN pg_locks owner_lock ON owner_lock.locktype = 'transactionid'
                AND owner_lock.transactionid = waiting_lock.transactionid
                AND owner_lock.granted AND owner_lock.pid = ${ownerPid}
              WHERE waiting_lock.pid = a.pid AND NOT waiting_lock.granted
                AND waiting_lock.locktype = 'transactionid') AS owner_transaction
          FROM pg_stat_activity a WHERE a.datname = current_database()
            AND a.state = 'active' AND a.wait_event_type = 'Lock'
            AND a.application_name IN (${fiveNames[0]}, ${fiveNames[1]},
              ${fiveNames[2]}, ${fiveNames[3]}, ${fiveNames[4]})`;
        if (sessions.length === 5 && fiveNames.every((name) =>
          sessions.filter((row) => row.application_name === name && waitingOnStock(row)).length === 1)) break;
        await new Promise((done) => setTimeout(done, 50));
      }
      eq(sessions.length, 5, `Cinco sessões PostgreSQL: ${JSON.stringify(sessions)}`);
      eq(new Set(sessions.map((row) => row.pid)).size, 5, 'Cinco PIDs distintos');
      for (const [i, name] of fiveNames.entries()) {
        const match = sessions.filter((row) => row.application_name === name);
        eq(match.length, 1, `${name}: sessão única do produto ${five.ids[i]}`);
        eq(waitingOnStock(match[0]), true,
          `${name} → Estoque ${five.ids[i]}, bloqueador ${ownerPid}: ${JSON.stringify(match[0])}`);
        process.stdout.write(`${name} → PID ${match[0].pid}, Estoque ${five.ids[i]}, bloqueador ${ownerPid}\n`);
      }
      eq(fiveRequests.every((p) => pending.has(p)), true,
        'Cinco requisições permanecem pendentes antes da liberação');
    } finally { releaseFive(); await Promise.allSettled([fiveBlocker, ...fiveRequests]); }
    const fiveResponses = await bounded(Promise.all(fiveRequests), 'cinco esperas em Estoque');
    eq(fiveResponses.map((response) => response.status), [201, 201, 201, 201, 201],
      `Respostas após liberar Estoque: ${JSON.stringify(fiveResponses.map((r) => r.body))}; ${fiveErrors.join('; ')}`);
    await verify(five, fiveResponses, 5, false); // Segunda fase do cenário dos cinco concorrentes.

    const independent = await fixture([1, 1], [[[0, 1]], [[1, 1]]]);
    let unlock!: () => void, locked!: (pid: number) => void;
    const held = new Promise<number>((done) => { locked = done; });
    const freed = new Promise<void>((done) => { unlock = done; });
    const blocker = track(prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "produtoId" FROM "Estoque" WHERE "produtoId" = ${independent.ids[0]}::uuid FOR UPDATE`;
      const [backend] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      locked(backend.pid); await freed;
    }, { timeout: 20000 }));
    void blocker.catch(() => undefined);
    let a: Promise<Response> | undefined, b: Promise<Response> | undefined;
    try {
      const pid = await lockReady(held, blocker, 'lock A');
      a = post(independent.clients[0], independent.reviews[0]);
      let waiting = false;
      for (let i = 0; i < 100 && !waiting; i++) {
        const [activity] = await prisma.$queryRaw<Array<{ n: bigint }>>`
          SELECT count(*) AS n FROM pg_stat_activity WHERE datname = current_database()
            AND wait_event_type = 'Lock' AND query LIKE '%"Estoque"%'
            AND ${pid} = ANY(pg_blocking_pids(pid))`;
        waiting = activity.n > 0n;
        if (!waiting) await new Promise((done) => setTimeout(done, 50));
      }
      eq(waiting, true, 'A deve aguardar o lock PostgreSQL de Estoque A');
      b = post(independent.clients[1], independent.reviews[1]);
      eq((await bounded(b, 'B independente', 5000)).status, 201);
      const [activity] = await prisma.$queryRaw<Array<{ n: bigint }>>`
        SELECT count(*) AS n FROM pg_stat_activity WHERE datname = current_database()
          AND wait_event_type = 'Lock' AND query LIKE '%"Estoque"%'
          AND ${pid} = ANY(pg_blocking_pids(pid))`;
      eq(activity.n > 0n, true);
    } finally { unlock(); await Promise.allSettled([blocker, ...(a ? [a] : []), ...(b ? [b] : [])]); }
    await verify(independent, [await a!, await b!], 2);

    const overlap = await fixture([2, 1, 2], [[[0, 1], [1, 1]], [[1, 1], [2, 1]]]);
    const r4 = await launchContested(overlap, overlap.ids[1]);
    eq(r4.map((r) => r.status).sort(), [201, 409]);
    await verify(overlap, r4, 1);
    const reversed = await fixture([2, 2], [[[0, 1], [1, 1]], [[1, 1], [0, 1]]]);
    const r5 = await launchContested(reversed, reversed.ids[0]);
    eq(r5.map((r) => r.status).sort(), [201, 409]);
    await verify(reversed, r5, 1);
    const revisionRace = await fixture([3], [[[0, 1]], [[0, 1]]]);
    eq(new Set(revisionRace.reviews).size, 2, 'Duas revisões D53 autenticadas e distintas');
    const d53 = await launchContested(revisionRace, revisionRace.ids[0]);
    eq(d53.map((r) => r.status).sort(), [201, 409]);
    eq(d53.filter((r) => r.status === 409).length, 1, 'Revisão invalidada retorna 409');
    await verify(revisionRace, d53, 1);
    eq(await prisma.pedido.count({ where: { clienteUsuarioId: {
      in: revisionRace.clients.filter((_, i) => d53[i].status === 409) } } }), 0);
    eq(await prisma.reservaEstoque.count({ where: { pedido: { clienteUsuarioId: {
      in: revisionRace.clients.filter((_, i) => d53[i].status === 409) } } } }), 0);
    eq((await prisma.estoque.findUniqueOrThrow({ where: { produtoId: revisionRace.ids[0] } }))
      .quantidadeReservada, 1);

    const same = await fixture([2], [[[0, 1]]]);
    const attempt = randomUUID();
    let releaseCart!: () => void, cartHeld!: (pid: number) => void;
    const cartReady = new Promise<number>((done) => { cartHeld = done; });
    const cartFree = new Promise<void>((done) => { releaseCart = done; });
    const cartBlocker = track(prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Carrinho" WHERE "usuarioId" = ${same.clients[0]}::uuid FOR UPDATE`;
      const [backend] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      cartHeld(backend.pid); await cartFree;
    }, { timeout: 20000 }));
    void cartBlocker.catch(() => undefined);
    let sameRequests: Promise<Response>[] = [];
    try {
      const cartPid = await lockReady(cartReady, cartBlocker, 'lock do carrinho');
      sameRequests = [post(same.clients[0], same.reviews[0], attempt),
        post(same.clients[0], same.reviews[0], attempt)];
      let cartWaiters = 0n, advisoryWaiters = 0n;
      for (let i = 0; i < 160 && (cartWaiters !== 1n || advisoryWaiters !== 1n); i++) {
        const [state] = await prisma.$queryRaw<Array<{ cart: bigint; advisory: bigint }>>`
          SELECT count(*) FILTER (WHERE query LIKE '%"Carrinho"%' AND
            ${cartPid} = ANY(pg_blocking_pids(pid))) AS cart,
            count(*) FILTER (WHERE wait_event = 'advisory' AND query LIKE '%pg_advisory_xact_lock%') AS advisory
          FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`;
        cartWaiters = state.cart; advisoryWaiters = state.advisory;
        if (cartWaiters !== 1n || advisoryWaiters !== 1n) await new Promise((done) => setTimeout(done, 50));
      }
      eq(cartWaiters, 1n, 'Primeira tentativa bloqueada no carrinho');
      eq(advisoryWaiters, 1n, 'Segunda tentativa disputa a idempotência da primeira');
      eq(sameRequests.every((p) => pending.has(p)), true);
    } finally { releaseCart(); await Promise.allSettled([cartBlocker, ...sameRequests]); }
    const r7 = await bounded(Promise.all(sameRequests), 'mesma tentativa');
    eq(r7.map((r) => r.status), [201, 201]); eq(r7[0].body.id, r7[1].body.id);
    await verify(same, r7, 1);
    eq(await prisma.reservaEstoque.count({ where: { pedidoId: r7[0].body.id } }), 1);
    eq((await prisma.estoque.findUniqueOrThrow({ where: { produtoId: same.ids[0] } }))
      .quantidadeReservada, 1);

    const rollback = await fixture([7], [[[0, 7]], [[0, 6]]]);
    sqlEvidence.current = undefined;
    await prisma.$executeRawUnsafe(`ALTER TABLE "ReservaEstoque"
      ADD CONSTRAINT "d54_reservation_failure" CHECK ("quantidade" <> 7) NOT VALID`);
    constraint = true;
    const temporaryChecks = await prisma.$queryRaw<Array<{ conname: string }>>`
      SELECT conname FROM pg_constraint WHERE conname = ${failureConstraint}
        AND conrelid = '"ReservaEstoque"'::regclass`;
    eq(temporaryChecks.map((row) => row.conname), [failureConstraint],
      'Nome exato da constraint temporária instalada antes da requisição');
    let unlockFailure!: () => void, signalFailure!: (pid: number) => void;
    const heldFailure = new Promise<number>((done) => { signalFailure = done; });
    const freedFailure = new Promise<void>((done) => { unlockFailure = done; });
    const failureBlocker = track(prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "produtoId" FROM "Estoque" WHERE "produtoId" = ${rollback.ids[0]}::uuid FOR UPDATE`;
      const [backend] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      signalFailure(backend.pid); await freedFailure;
    }, { timeout: 20000 }));
    void failureBlocker.catch(() => undefined);
    let failed: Promise<Response> | undefined, competitor: Promise<Response> | undefined;
    try {
      const pid = await lockReady(heldFailure, failureBlocker, 'lock de rollback');
      failed = post(rollback.clients[0], rollback.reviews[0]);
      type RollbackSession = { application_name: string; pid: number; state: string;
        wait_event_type: string | null; query: string; blockers: number[] };
      let failedSessions: RollbackSession[] = [];
      const waitingOnStock = (row: RollbackSession) => row.state === 'active'
        && row.wait_event_type === 'Lock' && row.query.includes('FROM "Estoque"')
        && row.query.includes('FOR UPDATE') && row.blockers.length > 0;
      for (let i = 0; i < 100; i++) {
        failedSessions = await prisma.$queryRaw<RollbackSession[]>`
          SELECT application_name, pid, state, wait_event_type, query,
            pg_blocking_pids(pid) AS blockers
          FROM pg_stat_activity WHERE datname = current_database()
            AND application_name = ${runId} AND pid <> ${pid}
            AND state = 'active' AND wait_event_type = 'Lock'
            AND query LIKE '%"Estoque"%'`;
        if (failedSessions.filter((row) => waitingOnStock(row)
          && row.blockers.includes(pid)).length === 1) break;
        await new Promise((done) => setTimeout(done, 50));
      }
      const failedWaiting = failedSessions.filter((row) => waitingOnStock(row)
        && row.blockers.includes(pid));
      eq(failedWaiting.length, 1, 'Rollback aguarda Estoque no PostgreSQL');
      const failedWaitingPid = failedWaiting[0].pid;
      const waitingOnProduct = (row: RollbackSession) => row.state === 'active'
        && row.wait_event_type === 'Lock' && row.query.includes('FROM "Produto"')
        && row.query.includes('FOR UPDATE') && row.blockers.includes(failedWaitingPid);
      process.stdout.write(`rollback → PID ${failedWaiting[0].pid}, Estoque ${rollback.ids[0]}, bloqueador ${pid}\n`);
      competitor = post(rollback.clients[1], rollback.reviews[1], randomUUID(), fiveServers[0]);
      let competitorSessions: RollbackSession[] = [];
      for (let i = 0; i < 100; i++) {
        competitorSessions = await prisma.$queryRaw<RollbackSession[]>`
          SELECT application_name, pid, state, wait_event_type, query,
            pg_blocking_pids(pid) AS blockers
          FROM pg_stat_activity WHERE datname = current_database()
            AND application_name = ${fiveNames[0]} AND state = 'active'
            AND wait_event_type = 'Lock' AND query LIKE '%"Produto"%'`;
        if (competitorSessions.length === 1 && waitingOnProduct(competitorSessions[0])
          && competitorSessions[0].pid !== failedWaitingPid) break;
        await new Promise((done) => setTimeout(done, 50));
      }
      eq(competitorSessions.length, 1, 'Competitor identificado individualmente no PostgreSQL');
      eq(waitingOnProduct(competitorSessions[0]), true,
        'Competitor aguarda FOR UPDATE de Produto, bloqueado pelo rollback antes da liberação');
      assert(competitorSessions[0].pid !== failedWaiting[0].pid,
        'Rollback e competitor devem usar PIDs distintos'); checks++;
      eq([failed, competitor].every((requestPromise) => pending.has(requestPromise)), true,
        'Rollback e competitor permanecem pendentes antes da liberação');
      process.stdout.write(`competitor ${fiveNames[0]} → PID ${competitorSessions[0].pid}, Produto ${rollback.ids[0]}, bloqueador ${failedWaitingPid}\n`);
    } finally { unlockFailure(); await Promise.allSettled([failureBlocker,
      ...(failed ? [failed] : []), ...(competitor ? [competitor] : [])]); }
    eq((await failed!).status, 500);
    eq(observedSqlFailure()?.sqlstate, '23514',
      `SQLSTATE do rollback: ${JSON.stringify(observedSqlFailure())}`);
    eq(observedSqlFailure()?.constraint, failureConstraint,
      `Constraint do rollback: ${JSON.stringify(observedSqlFailure())}`);
    eq((await competitor!).status, 201);
    eq(await prisma.pedido.count({ where: { clienteUsuarioId: rollback.clients[0] } }), 0);
    eq(await prisma.itemPedido.count({ where: { pedido: { clienteUsuarioId: rollback.clients[0] } } }), 0);
    eq(await prisma.itemPedidoPersonalizacaoSnapshot.count({ where: {
      itemPedido: { pedido: { clienteUsuarioId: rollback.clients[0] } } } }), 0);
    eq(await prisma.enderecoEntregaSnapshot.count({ where: {
      pedido: { clienteUsuarioId: rollback.clients[0] } } }), 0);
    eq(await prisma.reservaEstoque.count({ where: { pedido: {
      clienteUsuarioId: rollback.clients[0] } } }), 0);
    const rollbackStock = await prisma.estoque.findUniqueOrThrow({ where: { produtoId: rollback.ids[0] } });
    eq(rollbackStock.quantidadeReservada, 6, 'Apenas a reserva concorrente válida permanece');
    eq(rollbackStock.quantidadeFisica, 7, 'Quantidade física intacta após rollback');
    eq(await prisma.movimentacaoEstoque.count({ where: { produtoId: rollback.ids[0] } }), 0);
    await verify(rollback, [await failed!, await competitor!], 1);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ReservaEstoque" DROP CONSTRAINT "d54_reservation_failure"`);
    constraint = false;
    const droppedCheck = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n FROM pg_constraint WHERE conname = ${failureConstraint}
        AND conrelid = '"ReservaEstoque"'::regclass`;
    eq(droppedCheck[0].n, 0n, 'Constraint temporária removida após rollback');

    const expiring = await fixture([3], [[[0, 2]]]);
    const created = await post(expiring.clients[0], expiring.reviews[0]); eq(created.status, 201);
    await prisma.pedido.update({ where: { id: created.body.id }, data: { statusAtual: 'EXPIRADO' } });
    await prisma.reservaEstoque.updateMany({ where: { pedidoId: created.body.id },
      data: { momentoExpiracaoValidade: new Date(Date.now() - 20 * 60_000) } });
    let releaseStock!: () => void, stockHeld!: (pid: number) => void;
    const stockReady = new Promise<number>((done) => { stockHeld = done; });
    const stockFree = new Promise<void>((done) => { releaseStock = done; });
    const stockBlocker = track(prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "produtoId" FROM "Estoque"
        WHERE "produtoId" = ${expiring.ids[0]}::uuid FOR UPDATE`;
      const [backend] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      stockHeld(backend.pid); await stockFree;
    }, { timeout: 30000 }));
    void stockBlocker.catch(() => undefined);
    let releasePromises: Promise<number>[] = [];
    try {
      const stockPid = await lockReady(stockReady, stockBlocker, 'lock D52');
      releasePromises = [0, 1].map(() => track(new LiberacaoReservasService(prisma as never).executar()));
      let waiting = 0n, direct = 0n;
      for (let i = 0; i < 160 && (waiting !== 2n || direct < 1n); i++) {
        const [activity] = await prisma.$queryRaw<Array<{ n: bigint; direct: bigint }>>`
          SELECT count(*) AS n,
            count(*) FILTER (WHERE ${stockPid} = ANY(pg_blocking_pids(pid))) AS direct
          FROM pg_stat_activity WHERE datname = current_database()
            AND wait_event_type = 'Lock' AND query LIKE '%"Estoque"%'`;
        waiting = activity.n; direct = activity.direct;
        if (waiting !== 2n || direct < 1n) await new Promise((done) => setTimeout(done, 50));
      }
      eq(waiting, 2n, 'Duas execuções D52 bloqueadas pelo mesmo Estoque');
      assert(direct >= 1n); checks++;
      eq(releasePromises.every((p) => pending.has(p)), true);
    } finally { releaseStock(); await Promise.allSettled([stockBlocker, ...releasePromises]); }
    const releases = await bounded(Promise.all(releasePromises), 'D52 concorrente');
    eq(releases.reduce((sum, n) => sum + n), 1);
    eq(await prisma.reservaEstoque.count({ where: { pedidoId: created.body.id,
      estado: 'EXPIRADA_LIBERADA' } }), 1);
    const lastStock = await prisma.estoque.findUniqueOrThrow({ where: { produtoId: expiring.ids[0] } });
    eq(lastStock.quantidadeReservada, 0); eq(lastStock.quantidadeFisica, 3);
    eq(await prisma.reservaEstoque.count({ where: { pedidoId: created.body.id,
      estado: 'ATIVA' } }), 0);
    const stillActive = await prisma.reservaEstoque.findMany({ where: { produtoId: expiring.ids[0],
      estado: 'ATIVA' }, select: { quantidade: true } });
    eq(lastStock.quantidadeReservada, stillActive.reduce((sum, r) => sum + r.quantidade, 0));
    eq(await prisma.movimentacaoEstoque.count({ where: { produtoId: expiring.ids[0] } }), 0);
    scenarios++;
    const [finalStats] = await prisma.$queryRaw<Array<{ deadlocks: bigint }>>`
      SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()`;
    eq(finalStats.deadlocks, initialDeadlocks, 'PostgreSQL registrou deadlock no banco D54');
  } catch (error) { originalError = error; } finally {
    const cleanup = async (label: string, action: () => Promise<unknown>) => {
      try { await action(); } catch (error) {
        cleanupErrors.push(error);
        process.stderr.write(`Limpeza D54 ${label}: ${String(error)}\n`);
      }
    };
    await cleanup('promises pendentes', awaitPending);
    if (ready) {
      if (constraint) await cleanup('constraint', async () => { await prisma.$executeRawUnsafe(`ALTER TABLE "ReservaEstoque"
        DROP CONSTRAINT IF EXISTS "d54_reservation_failure"`); constraint = false; });
      let removed: string[] = [], removedItems: string[] = [];
      await cleanup('listar pedidos', async () => { removed = (await prisma.pedido.findMany({
        where: { clienteUsuarioId: { in: users } }, select: { id: true },
      })).map((row) => row.id); });
      await cleanup('listar itens', async () => { removedItems = (await prisma.itemPedido.findMany({
        where: { pedidoId: { in: removed } }, select: { id: true },
      })).map((row) => row.id); });
      await cleanup('snapshots de itens', () => prisma.itemPedidoPersonalizacaoSnapshot.deleteMany({
        where: { itemPedido: { pedidoId: { in: removed } } } }));
      await cleanup('reservas', () => prisma.reservaEstoque.deleteMany({ where: { pedidoId: { in: removed } } }));
      await cleanup('movimentações inesperadas', async () => {
        const n = await prisma.movimentacaoEstoque.count({ where: { produtoId: { in: products } } });
        eq(n, 0, 'D54 não deve criar movimentações de estoque');
      });
      await cleanup('remover movimentações inesperadas', () => prisma.movimentacaoEstoque.deleteMany({
        where: { produtoId: { in: products } } }));
      await cleanup('itens de pedidos', () => prisma.itemPedido.deleteMany({ where: { pedidoId: { in: removed } } }));
      await cleanup('snapshots de endereço', () => prisma.enderecoEntregaSnapshot.deleteMany({
        where: { pedidoId: { in: removed } } }));
      await cleanup('pedidos', () => prisma.pedido.deleteMany({ where: { id: { in: removed } } }));
      await cleanup('personalizações do carrinho', () => prisma.itemCarrinhoPersonalizacao.deleteMany({
        where: { itemCarrinho: { carrinho: { usuarioId: { in: users } } } } }));
      await cleanup('itens do carrinho', () => prisma.itemCarrinho.deleteMany({
        where: { carrinho: { usuarioId: { in: users } } } }));
      await cleanup('carrinhos', () => prisma.carrinho.deleteMany({ where: { usuarioId: { in: users } } }));
      await cleanup('endereços', () => prisma.endereco.deleteMany({ where: { usuarioId: { in: users } } }));
      await cleanup('relações produto-personalização', () => prisma.produtoPersonalizacao.deleteMany({
        where: { produtoId: { in: products } } }));
      await cleanup('estoques', () => prisma.estoque.deleteMany({ where: { produtoId: { in: products } } }));
      await cleanup('produtos', () => prisma.produto.deleteMany({ where: { id: { in: products } } }));
      await cleanup('categoria', () => prisma.categoria.deleteMany({ where: { id: category } }));
      await cleanup('usuários', () => prisma.usuario.deleteMany({ where: { id: { in: users } } }));
      await cleanup('verificação de limpeza', async () => {
        const zero = async (label: string, count: Promise<number>) =>
          cleanup(`resíduo ${label}`, async () => eq(await count, 0, `Resíduo D54: ${label}`));
        await zero('pedidos', prisma.pedido.count({ where: { clienteUsuarioId: { in: users } } }));
        await zero('itens de pedido', prisma.itemPedido.count({ where: { pedidoId: { in: removed } } }));
        await zero('snapshots de itens', prisma.itemPedidoPersonalizacaoSnapshot.count({
          where: { itemPedidoId: { in: removedItems } } }));
        await zero('snapshots de endereço', prisma.enderecoEntregaSnapshot.count({
          where: { pedidoId: { in: removed } } }));
        await zero('reservas', prisma.reservaEstoque.count({ where: { produtoId: { in: products } } }));
        await zero('movimentações', prisma.movimentacaoEstoque.count({ where: { produtoId: { in: products } } }));
        await zero('estoques', prisma.estoque.count({ where: { produtoId: { in: products } } }));
        await zero('itens do carrinho', prisma.itemCarrinho.count({ where: { produtoId: { in: products } } }));
        await zero('carrinhos', prisma.carrinho.count({ where: { usuarioId: { in: users } } }));
        await zero('endereços', prisma.endereco.count({ where: { usuarioId: { in: users } } }));
        await zero('produto-personalização', prisma.produtoPersonalizacao.count({
          where: { produtoId: { in: products } } }));
        await zero('produtos', prisma.produto.count({ where: { id: { in: products } } }));
        await zero('categoria', prisma.categoria.count({ where: { id: category } }));
        await zero('usuários', prisma.usuario.count({ where: { id: { in: users } } }));
        await cleanup('resíduo constraint', async () => { const [check] = await prisma.$queryRaw<Array<{ n: bigint }>>`
          SELECT count(*) AS n FROM pg_constraint WHERE conname = ${failureConstraint}
            AND conrelid = '"ReservaEstoque"'::regclass`;
          eq(check.n, 0n, 'Constraint D54 remanescente'); });
        await cleanup('operações pendentes', async () => eq(pending.size, 0, 'Operações D54 remanescentes'));
        await cleanup('atividade PostgreSQL', async () => { const [activity] = await prisma.$queryRaw<Array<{ n: bigint }>>`
          SELECT count(*) AS n FROM pg_stat_activity
          WHERE application_name IN (${runId}, ${fiveNames[0]}, ${fiveNames[1]},
            ${fiveNames[2]}, ${fiveNames[3]}, ${fiveNames[4]}) AND pid <> pg_backend_pid()
            AND (state = 'active' OR wait_event_type = 'Lock')`;
          eq(activity.n, 0n, 'Operações D54 ativas no PostgreSQL'); });
      });
    }
    process.env.DATABASE_URL = databaseUrl;
    for (const [i, taggedApp] of taggedApps.entries()) {
      await cleanup(`servidor d54-five-${i + 1}`, () => taggedApp.close());
    }
    if (app) await cleanup('servidor', () => app!.close());
    await cleanup('Prisma disconnect', () => prisma.$disconnect());
  }
  if (originalError || cleanupErrors.length) throw new AggregateError(
    [...(originalError ? [originalError] : []), ...cleanupErrors],
    `Falha D54: ${String(originalError ?? cleanupErrors[0])}`);
  process.stdout.write(`PASS D54 PostgreSQL (${scenarios} cenários; ${checks} verificações; fixtures limpas)\n`);
}
main().catch((error: unknown) => {
  if (error instanceof AggregateError) for (const cause of error.errors) {
    process.stderr.write(`${cause instanceof Error ? cause.stack : String(cause)}\n`);
  }
  process.stderr.write(`${String(error)}\n`); process.exitCode = 1;
});
