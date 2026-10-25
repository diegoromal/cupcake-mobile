import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { ExpiracaoPedidosService } from '../src/pedidos/expiracao-pedidos.service';
import { LiberacaoReservasService } from '../src/pedidos/liberacao-reservas.service';

function dedicatedUrl(): string {
  const value = process.env.D52_TEST_DATABASE_URL;
  if (!value) throw new Error('Defina D52_TEST_DATABASE_URL.');
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      (url.port && url.port !== '5432') || url.pathname !== '/cupcake_d52' || url.hash ||
      [...url.searchParams].some(([key, content]) => key !== 'schema' || content !== 'public')) {
    throw new Error('D52 exige PostgreSQL local dedicado cupcake_d52, schema public.');
  }
  return value;
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: dedicatedUrl() }) });
  const release = new LiberacaoReservasService(prisma as never);
  const expire = new ExpiracaoPedidosService(prisma as never);
  const user = randomUUID(), category = randomUUID();
  const products = [randomUUID(), randomUUID()];
  const orders: string[] = [];
  const reservations: string[] = [];
  let ready = false, checks = 0;
  const check = (value: unknown, expected: unknown) => { assert.deepEqual(value, expected); checks++; };
  const stock = async (product: string) => prisma.estoque.findUniqueOrThrow({ where: { produtoId: product } });
  const state = async (id: string) => (await prisma.reservaEstoque.findUniqueOrThrow({ where: { id } })).estado;
  const now = async () => (await prisma.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`)[0].now;
  try {
    const [database] = await prisma.$queryRaw<Array<{ name: string; schema: string }>>`
      SELECT current_database() AS name, current_schema() AS schema`;
    check(database, { name: 'cupcake_d52', schema: 'public' });
    ready = true;
    const migrations = await prisma.$queryRaw<Array<{
      migration_name: string; finished_at: Date | null; rolled_back_at: Date | null;
    }>>`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`;
    for (const name of readdirSync(resolve(__dirname, '../prisma/migrations')).filter((v) => /^\d+_/.test(v))) {
      assert(migrations.some((m) => m.migration_name === name && m.finished_at && !m.rolled_back_at),
        `Migration pendente: ${name}`);
      checks++;
    }
    const expectedTables = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public'
        AND tablename IN ('Pedido', 'ReservaEstoque', 'Estoque')`;
    check(expectedTables.map((table) => table.name).sort(), ['Estoque', 'Pedido', 'ReservaEstoque']);
    check(await prisma.usuario.count({ where: { id: user } }), 0);
    await prisma.usuario.create({ data: { id: user, nome: 'D52 cliente',
      email: `d52-${user}@example.test`, telefone: '00000000000',
      credencialSenha: 'fixture', perfil: 'CLIENTE' } });
    await prisma.categoria.create({ data: { id: category, nome: `D52 ${category}` } });
    await prisma.produto.createMany({ data: products.map((id, i) => ({
      id, categoriaId: category, nome: `D52 produto ${i}`, precoAtual: '1.00',
    })) });
    await prisma.estoque.createMany({ data: products.map((produtoId) => ({
      produtoId, quantidadeFisica: 100, quantidadeReservada: 0,
    })) });
    const past = new Date((await now()).getTime() - 20 * 60_000);
    const future = new Date((await now()).getTime() + 60 * 60_000);
    async function order(status: 'EXPIRADO' | 'PENDENTE_PAGAMENTO' | 'PAGO', data = past) {
      const id = randomUUID(); orders.push(id);
      await prisma.pedido.create({ data: { id, identificadorNegocio: `D52-${id}`,
        clienteUsuarioId: user, data, statusAtual: status, modalidade: 'RETIRADA',
        valorItens: '1.00', freteAplicado: '0.00', total: '1.00' } });
      return id;
    }
    async function reserve(pedidoId: string, produtoId: string, quantidade: number,
      estado: 'ATIVA' | 'EXPIRADA_LIBERADA' | 'CONVERTIDA_EM_VENDA' |
        'DEVOLVIDA_POR_CANCELAMENTO' = 'ATIVA', deadline = past) {
      const id = randomUUID(); reservations.push(id);
      await prisma.reservaEstoque.create({ data: { id, pedidoId, produtoId,
        quantidade, estado, momentoExpiracaoValidade: deadline } });
      if (estado === 'ATIVA') await prisma.estoque.update({ where: { produtoId },
        data: { quantidadeReservada: { increment: quantidade } } });
      return id;
    }

    // A, B e C: uma reserva, duas linhas do mesmo produto e produtos distintos.
    const one = await reserve(await order('EXPIRADO'), products[0], 5);
    const twoOrder = await order('EXPIRADO');
    const twoA = await reserve(twoOrder, products[0], 5);
    const twoB = await reserve(twoOrder, products[0], 3, 'ATIVA', future);
    const other = await reserve(await order('EXPIRADO'), products[1], 2);
    const pending = await reserve(await order('PENDENTE_PAGAMENTO'), products[0], 4);
    const paid = await reserve(await order('PAGO'), products[1], 1);
    const historicOrder = await order('EXPIRADO');
    const historic = await Promise.all([
      reserve(historicOrder, products[0], 1, 'EXPIRADA_LIBERADA'),
      reserve(historicOrder, products[0], 1, 'CONVERTIDA_EM_VENDA'),
      reserve(historicOrder, products[0], 1, 'DEVOLVIDA_POR_CANCELAMENTO'),
    ]);
    check((await stock(products[0])).quantidadeReservada, 17);
    check((await stock(products[1])).quantidadeReservada, 3);
    check(await release.executar(), 3);
    check(await Promise.all([state(one), state(twoA), state(twoB), state(other)]),
      ['EXPIRADA_LIBERADA', 'EXPIRADA_LIBERADA', 'ATIVA', 'EXPIRADA_LIBERADA']);
    check((await stock(products[0])).quantidadeReservada, 7);
    check((await stock(products[1])).quantidadeReservada, 1);
    check(await release.executar(), 0);
    check((await stock(products[0])).quantidadeReservada, 7);
    check(await state(pending), 'ATIVA');
    check(await state(paid), 'ATIVA');
    check(await Promise.all(historic.map(state)),
      ['EXPIRADA_LIBERADA', 'CONVERTIDA_EM_VENDA', 'DEVOLVIDA_POR_CANCELAMENTO']);
    await prisma.reservaEstoque.update({ where: { id: twoB },
      data: { momentoExpiracaoValidade: past } });
    check(await release.executar(), 1);
    check((await stock(products[0])).quantidadeReservada, 4);
    check(await release.executar(), 0);

    // Fronteira D51 → D52, incluindo validade exatamente atingida.
    const boundary = await now();
    const integratedOrder = await order('PENDENTE_PAGAMENTO',
      new Date(boundary.getTime() - 16 * 60_000));
    const integrated = await reserve(integratedOrder, products[1], 6, 'ATIVA', boundary);
    check(await release.executar(), 0);
    check(await state(integrated), 'ATIVA');
    check(await expire.executar(), 2); // pedido pendente antigo e pedido integrado
    check((await prisma.pedido.findUniqueOrThrow({ where: { id: integratedOrder } })).statusAtual, 'EXPIRADO');
    check(await state(integrated), 'ATIVA');
    check((await stock(products[1])).quantidadeReservada, 7);
    check(await release.executar(), 2); // pedido pendente inicial e pedido integrado
    check(await state(integrated), 'EXPIRADA_LIBERADA');
    check((await stock(products[1])).quantidadeReservada, 1);
    check(await state(pending), 'EXPIRADA_LIBERADA');

    // Lote de 50, com a mesma linha de estoque para todos.
    const batchOrders = Array.from({ length: 51 }, () => randomUUID());
    const batchReservations = Array.from({ length: 51 }, () => randomUUID());
    orders.push(...batchOrders); reservations.push(...batchReservations);
    await prisma.pedido.createMany({ data: batchOrders.map((id) => ({
      id, identificadorNegocio: `D52-${id}`, clienteUsuarioId: user, data: past,
      statusAtual: 'EXPIRADO' as const, modalidade: 'RETIRADA' as const,
      valorItens: '1.00', freteAplicado: '0.00', total: '1.00',
    })) });
    await prisma.reservaEstoque.createMany({ data: batchReservations.map((id, i) => ({
      id, pedidoId: batchOrders[i], produtoId: products[0], quantidade: 1,
      estado: 'ATIVA' as const, momentoExpiracaoValidade: past,
    })) });
    await prisma.estoque.update({ where: { produtoId: products[0] },
      data: { quantidadeReservada: { increment: 51 } } });
    check(await release.executar(), 50);
    check(await prisma.reservaEstoque.count({ where: { id: { in: batchReservations }, estado: 'ATIVA' } }), 1);
    check(await release.executar(), 1);
    check(await release.executar(), 0);
    check((await stock(products[0])).quantidadeReservada, 0);

    // Rollback real: primeiro saldo reduzido; segunda atualização provoca erro SQL.
    const rollbackOrderA = await order('EXPIRADO');
    const rollbackOrderB = await order('EXPIRADO');
    const rollbackA = await reserve(rollbackOrderA, products[0], 3);
    const rollbackB = await reserve(rollbackOrderB, products[1], 4);
    const before = await Promise.all(products.map(stock));
    const movementCount = await prisma.movimentacaoEstoque.count({ where: { produtoId: { in: products } } });
    const failing = new LiberacaoReservasService({
      $queryRaw: prisma.$queryRaw.bind(prisma), reservaEstoque: prisma.reservaEstoque,
      $transaction: (fn: (db: object) => Promise<number>) => prisma.$transaction(async (tx) => {
        let updates = 0;
        return fn({ $queryRaw: tx.$queryRaw.bind(tx), reservaEstoque: tx.reservaEstoque,
          estoque: { updateMany: async (...args: Parameters<typeof tx.estoque.updateMany>) => {
            updates++;
            if (updates === 2) await tx.$queryRawUnsafe('SELECT 1/0');
            return tx.estoque.updateMany(...args);
          } },
        });
      }),
    } as never);
    await assert.rejects(failing.executar()); checks++;
    check(await Promise.all(products.map(stock)), before);
    check(await Promise.all([state(rollbackA), state(rollbackB)]), ['ATIVA', 'ATIVA']);
    check(await prisma.pedido.findMany({ where: { id: { in: [rollbackOrderA, rollbackOrderB] } },
      select: { statusAtual: true } }).then((rows) => rows.map((row) => row.statusAtual)),
    ['EXPIRADO', 'EXPIRADO']);
    check(await prisma.movimentacaoEstoque.count({ where: { produtoId: { in: products } } }), movementCount);
    check(await Promise.all([new LiberacaoReservasService(prisma as never).executar(),
      new LiberacaoReservasService(prisma as never).executar()]).then((n) => n.reduce((a, b) => a + b)), 2);
    check(await Promise.all([state(rollbackA), state(rollbackB)]),
      ['EXPIRADA_LIBERADA', 'EXPIRADA_LIBERADA']);
    check((await stock(products[0])).quantidadeReservada, 0);
    check((await stock(products[1])).quantidadeReservada, 1);
    check(await release.executar(), 0);
    check((await stock(products[0])).quantidadeFisica, 100);
    check((await stock(products[1])).quantidadeFisica, 100);
    check(await prisma.reservaEstoque.count({ where: { id: { in: reservations } } }), reservations.length);
    check(await prisma.movimentacaoEstoque.count({ where: { produtoId: { in: products } } }), 0);
  } finally {
    if (ready) {
      await prisma.reservaEstoque.deleteMany({ where: { id: { in: reservations } } });
      await prisma.historicoStatusPedido.deleteMany({ where: { pedidoId: { in: orders } } });
      await prisma.pedido.deleteMany({ where: { id: { in: orders } } });
      await prisma.estoque.deleteMany({ where: { produtoId: { in: products } } });
      await prisma.produto.deleteMany({ where: { id: { in: products } } });
      await prisma.categoria.deleteMany({ where: { id: category } });
      await prisma.usuario.deleteMany({ where: { id: user } });
      check(await prisma.reservaEstoque.count({ where: { id: { in: reservations } } }), 0);
      check(await prisma.historicoStatusPedido.count({ where: { pedidoId: { in: orders } } }), 0);
      check(await prisma.pedido.count({ where: { id: { in: orders } } }), 0);
    }
    await prisma.$disconnect();
  }
  process.stdout.write(`PASS D52 PostgreSQL (${checks} verificações; fixtures limpas)\n`);
}
main().catch((error: unknown) => { process.stderr.write(`${String(error)}\n`); process.exitCode = 1; });
