import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { PedidosService } from '../src/pedidos/pedidos.service';

async function main() {
  const raw = process.env.D67_TEST_DATABASE_URL;
  if (!raw || new URL(raw).hostname !== 'localhost' || new URL(raw).pathname !== '/cupcake_d67') {
    throw new Error('D67 exige D67_TEST_DATABASE_URL para localhost/cupcake_d67.');
  }
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hash ||
      [...url.searchParams].some(([key, value]) => key !== 'schema' || value !== 'public')) {
    throw new Error('D67 exige PostgreSQL local dedicado cupcake_d67, schema public.');
  }
  const marker = `D67-${randomUUID()}`;
  url.searchParams.set('application_name', marker);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  const blocker = new Client({ connectionString: raw });
  const observer = new Client({ connectionString: raw });
  const service = new PedidosService(prisma as never);
  const clienteId = randomUUID(), adminId = randomUUID();
  const prontoId = randomUUID(), retiradoId = randomUUID(), invalidoId = randomUUID();
  const concorrenteId = randomUUID(), rollbackId = randomUUID();
  const ids = [prontoId, retiradoId, invalidoId, concorrenteId, rollbackId];
  const concurrentCalls: Promise<unknown>[] = [];
  let blockerConnected = false, observerConnected = false, lockHeld = false;
  let checks = 0;
  try {
    await blocker.connect(); blockerConnected = true;
    await observer.connect(); observerConnected = true;
    const [database] = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    assert.equal(database.name, 'cupcake_d67'); checks++;
    await prisma.usuario.create({ data: { id: clienteId, nome: marker,
      email: `${marker}-cliente@example.test`, telefone: '00000000000', credencialSenha: 'fixture', perfil: 'CLIENTE' } });
    await prisma.usuario.create({ data: { id: adminId, nome: `${marker} admin`,
      email: `${marker}-admin@example.test`, telefone: '00000000000', credencialSenha: 'fixture', perfil: 'ADMIN' } });
    for (const [id, statusAtual] of [[prontoId, 'EM_PREPARO'], [retiradoId, 'PRONTO_PARA_RETIRADA'],
      [invalidoId, 'EM_PREPARO'], [concorrenteId, 'PRONTO_PARA_RETIRADA'],
      [rollbackId, 'PRONTO_PARA_RETIRADA']] as const) {
      await prisma.pedido.create({ data: { id, identificadorNegocio: `${marker}-${id}`,
        clienteUsuarioId: clienteId, modalidade: id === invalidoId ? 'ENTREGA' : 'RETIRADA',
        statusAtual, valorItens: '10.00', freteAplicado: id === invalidoId ? '2.00' : '0.00',
        total: id === invalidoId ? '12.00' : '10.00',
        confirmacaoPagamento: new Date() } });
      await prisma.historicoStatusPedido.create({ data: { pedidoId: id, statusRegistrado: statusAtual,
        dataHora: new Date() } });
    }
    assert.equal((await service.marcarProntoParaRetirada(prontoId, adminId)).statusAtual, 'PRONTO_PARA_RETIRADA'); checks++;
    assert.equal((await service.confirmarRetirada(retiradoId, adminId)).statusAtual, 'RETIRADO'); checks++;
    await assert.rejects(service.marcarProntoParaRetirada(invalidoId, adminId)); checks++;
    const history = await prisma.historicoStatusPedido.findMany({ where: { pedidoId: { in: ids } },
      orderBy: [{ dataHora: 'asc' }, { id: 'asc' }] });
    assert.equal(history.filter((item) => item.responsavelUsuarioId === adminId).length, 2); checks++;
    assert.deepEqual(history.filter((item) => item.pedidoId === prontoId).map((item) => item.statusRegistrado),
      ['EM_PREPARO', 'PRONTO_PARA_RETIRADA']); checks++;
    assert.deepEqual(history.filter((item) => item.pedidoId === retiradoId).map((item) => item.statusRegistrado),
      ['PRONTO_PARA_RETIRADA', 'RETIRADO']); checks++;

    await blocker.query('BEGIN');
    const [{ pid: blockerPid }] = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows as Array<{ pid: number }>;
    await blocker.query('SELECT id FROM "Pedido" WHERE id = $1::uuid FOR UPDATE', [concorrenteId]);
    lockHeld = true;
    concurrentCalls.push(service.confirmarRetirada(concorrenteId, adminId));
    concurrentCalls.push(service.confirmarRetirada(concorrenteId, adminId));
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
      where: { pedidoId: concorrenteId, statusRegistrado: 'RETIRADO' },
    }), 1); checks++;

    await assert.rejects(service.confirmarRetirada(rollbackId, randomUUID())); checks++;
    assert.equal((await prisma.pedido.findUniqueOrThrow({ where: { id: rollbackId } })).statusAtual,
      'PRONTO_PARA_RETIRADA'); checks++;
    assert.equal(await prisma.historicoStatusPedido.count({
      where: { pedidoId: rollbackId, statusRegistrado: 'RETIRADO' },
    }), 0); checks++;
  } finally {
    if (lockHeld) await blocker.query('ROLLBACK');
    await Promise.allSettled(concurrentCalls);
    await prisma.historicoStatusPedido.deleteMany({ where: { pedidoId: { in: ids } } });
    await prisma.pedido.deleteMany({ where: { id: { in: ids } } });
    await prisma.usuario.deleteMany({ where: { id: { in: [clienteId, adminId] } } });
    assert.equal(await prisma.pedido.count({ where: { identificadorNegocio: { startsWith: marker } } }), 0);
    await prisma.$disconnect();
    if (observerConnected) await observer.end();
    if (blockerConnected) await blocker.end();
  }
  process.stdout.write(`PASS D67 PostgreSQL (${checks} verificações; fixtures limpas)\n`);
}

main().catch((error: unknown) => { process.stderr.write(`${String(error)}\n`); process.exitCode = 1; });
