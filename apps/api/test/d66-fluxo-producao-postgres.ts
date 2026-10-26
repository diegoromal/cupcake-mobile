import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { PedidosService } from '../src/pedidos/pedidos.service';

async function main() {
  const raw = process.env.D66_TEST_DATABASE_URL;
  if (!raw || new URL(raw).hostname !== 'localhost' || new URL(raw).pathname !== '/cupcake_d66') {
    throw new Error('D66 exige D66_TEST_DATABASE_URL para localhost/cupcake_d66.');
  }
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hash ||
      [...url.searchParams].some(([key, value]) => key !== 'schema' || value !== 'public')) {
    throw new Error('D66 exige PostgreSQL local dedicado cupcake_d66, schema public.');
  }
  const marker = `d66_${randomUUID().replaceAll('-', '')}`;
  url.searchParams.set('application_name', marker);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  const blocker = new Client({ connectionString: raw });
  const observer = new Client({ connectionString: raw });
  const service = new PedidosService(prisma as never, { agendarStatusPedido: async () => undefined } as never);
  const fixtureMarker = `D66-${randomUUID()}`;
  const clienteId = randomUUID(), adminId = randomUUID();
  const pedidoId = randomUUID(), concorrenteId = randomUUID();
  const concurrentCalls: Promise<unknown>[] = [];
  let blockerConnected = false, observerConnected = false, lockHeld = false;
  let checks = 0;
  const fixture = async (id: string) => {
    await prisma.pedido.create({ data: {
      id, identificadorNegocio: `${fixtureMarker}-${id}`, clienteUsuarioId: clienteId,
      modalidade: 'RETIRADA', statusAtual: 'PAGO', valorItens: '10.00',
      freteAplicado: '0.00', total: '10.00', confirmacaoPagamento: new Date(),
    } });
    await prisma.historicoStatusPedido.create({ data: {
      pedidoId: id, statusRegistrado: 'PAGO', dataHora: new Date(),
    } });
  };
  try {
    await blocker.connect(); blockerConnected = true;
    await observer.connect(); observerConnected = true;
    const [database] = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    assert.equal(database.name, 'cupcake_d66'); checks++;
    await prisma.usuario.create({ data: { id: clienteId, nome: fixtureMarker, email: `${fixtureMarker}-cliente@example.test`,
      telefone: '00000000000', credencialSenha: 'fixture', perfil: 'CLIENTE' } });
    await prisma.usuario.create({ data: { id: adminId, nome: `${fixtureMarker} admin`,
      email: `${fixtureMarker}-admin@example.test`, telefone: '00000000000', credencialSenha: 'fixture', perfil: 'ADMIN' } });
    await fixture(pedidoId);
    const result = await service.iniciarProducao(pedidoId, adminId);
    assert.equal(result.statusAtual, 'EM_PREPARO'); checks++;
    const history = await prisma.historicoStatusPedido.findMany({ where: { pedidoId },
      orderBy: [{ dataHora: 'asc' }, { id: 'asc' }] });
    assert.deepEqual(history.map((item) => [item.statusRegistrado, item.responsavelUsuarioId]), [
      ['PAGO', null], ['EM_PREPARO', adminId],
    ]); checks++;

    await fixture(concorrenteId);
    await blocker.query('BEGIN');
    const [{ pid: blockerPid }] = (await blocker.query(
      'SELECT pg_backend_pid() AS pid',
    )).rows as Array<{ pid: number }>;
    await blocker.query('SELECT id FROM "Pedido" WHERE id = $1::uuid FOR UPDATE', [concorrenteId]);
    lockHeld = true;
    concurrentCalls.push(service.iniciarProducao(concorrenteId, adminId));
    concurrentCalls.push(service.iniciarProducao(concorrenteId, adminId));
    let blocked: Array<{ pid: number; blockers: number[] }> = [];
    for (let attempt = 0; attempt < 100; attempt++) {
      blocked = (await observer.query(`
        SELECT pid, pg_blocking_pids(pid) AS blockers
        FROM pg_stat_activity
        WHERE application_name = $1 AND state = 'active'
          AND wait_event_type = 'Lock' AND query LIKE '%FOR UPDATE%'
          AND cardinality(pg_blocking_pids(pid)) > 0`, [marker])).rows as typeof blocked;
      if (blocked.length === 2 && blocked.every((row) => row.blockers.length > 0) &&
          blocked.some((row) => row.blockers.includes(blockerPid))) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.equal(blocked.length, 2); checks++;
    assert.equal(blocked.every((row) => row.blockers.length > 0), true); checks++;
    assert.equal(blocked.some((row) => row.blockers.includes(blockerPid)), true); checks++;
    await blocker.query('COMMIT'); lockHeld = false;
    const concurrent = await Promise.allSettled(concurrentCalls);
    assert.equal(concurrent.filter((item) => item.status === 'fulfilled').length, 1); checks++;
    assert.equal(concurrent.filter((item) => item.status === 'rejected').length, 1); checks++;
    assert.equal(await prisma.historicoStatusPedido.count({
      where: { pedidoId: concorrenteId, statusRegistrado: 'EM_PREPARO' },
    }), 1); checks++;

    const rollbackId = randomUUID();
    await fixture(rollbackId);
    await assert.rejects(service.iniciarProducao(rollbackId, randomUUID())); checks++;
    assert.equal((await prisma.pedido.findUniqueOrThrow({ where: { id: rollbackId } })).statusAtual, 'PAGO'); checks++;
    assert.equal(await prisma.historicoStatusPedido.count({
      where: { pedidoId: rollbackId, statusRegistrado: 'EM_PREPARO' },
    }), 0); checks++;
  } finally {
    if (lockHeld) await blocker.query('ROLLBACK');
    await Promise.allSettled(concurrentCalls);
    const ids = [pedidoId, concorrenteId];
    await prisma.historicoStatusPedido.deleteMany({ where: { pedidoId: { in: ids } } });
    await prisma.pedido.deleteMany({ where: { id: { in: ids } } });
    const rollbackRows = await prisma.pedido.findMany({
      where: { identificadorNegocio: { startsWith: fixtureMarker } }, select: { id: true },
    });
    if (rollbackRows.length) {
      const rollbackIds = rollbackRows.map(({ id }) => id);
      await prisma.historicoStatusPedido.deleteMany({ where: { pedidoId: { in: rollbackIds } } });
      await prisma.pedido.deleteMany({ where: { id: { in: rollbackIds } } });
    }
    await prisma.usuario.deleteMany({ where: { id: { in: [clienteId, adminId] } } });
    assert.equal(await prisma.pedido.count({ where: { identificadorNegocio: { startsWith: fixtureMarker } } }), 0);
    await prisma.$disconnect();
    if (observerConnected) await observer.end();
    if (blockerConnected) await blocker.end();
  }
  process.stdout.write(`PASS D66 PostgreSQL (${checks} verificações; fixtures limpas)\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
