import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { PedidosService } from '../src/pedidos/pedidos.service';

async function main() {
  const raw = process.env.D75_TEST_DATABASE_URL;
  if (!raw) throw new Error('D75 exige D75_TEST_DATABASE_URL para localhost:5432/cupcake_d75.');
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== 'localhost' ||
      url.port !== '5432' || url.pathname !== '/cupcake_d75' || url.hash ||
      [...url.searchParams].some(([key, value]) => key !== 'schema' || value !== 'public')) {
    throw new Error('D75 exige PostgreSQL local dedicado localhost:5432/cupcake_d75, schema public.');
  }
  const marker = `D75-${randomUUID()}`;
  url.searchParams.set('application_name', marker);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  const blocker = new Client({ connectionString: raw });
  const observer = new Client({ connectionString: raw });
  const pedidos = new PedidosService(prisma as never, { agendarStatusPedido: async () => undefined } as never);
  const clienteId = randomUUID(), courierId = randomUUID(), otherCourierId = randomUUID();
  const eligibleId = randomUUID(), foreignId = randomUUID(), statusId = randomUUID();
  const modalityId = randomUUID(), rollbackId = randomUUID(), concurrentId = randomUUID();
  const ids = [eligibleId, foreignId, statusId, modalityId, rollbackId, concurrentId];
  const functionName = `d75_fail_${randomUUID().replaceAll('-', '')}`;
  const triggerName = `d75_trigger_${randomUUID().replaceAll('-', '')}`;
  const concurrentCalls: Promise<unknown>[] = [];
  let blockerConnected = false, observerConnected = false, lockHeld = false;
  let functionCreated = false, triggerCreated = false;
  let checks = 0;

  try {
    await blocker.connect(); blockerConnected = true;
    await observer.connect(); observerConnected = true;
    const [database] = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    assert.equal(database.name, 'cupcake_d75'); checks++;

    await prisma.usuario.createMany({ data: [
      { id: clienteId, nome: `${marker} cliente`, email: `${marker}-cliente@example.test`,
        telefone: '00000000000', credencialSenha: 'fixture', perfil: 'CLIENTE' },
      { id: courierId, nome: `${marker} courier`, email: `${marker}-courier@example.test`,
        telefone: '00000000000', credencialSenha: 'fixture', perfil: 'ENTREGADOR' },
      { id: otherCourierId, nome: `${marker} outro`, email: `${marker}-outro@example.test`,
        telefone: '00000000000', credencialSenha: 'fixture', perfil: 'ENTREGADOR' },
    ] });
    await prisma.pedido.createMany({ data: ids.map((id) => ({
      id, identificadorNegocio: `${marker}-${id}`, clienteUsuarioId: clienteId,
      entregadorUsuarioId: id === foreignId ? otherCourierId : courierId,
      modalidade: id === modalityId ? 'RETIRADA' as const : 'ENTREGA' as const,
      statusAtual: id === statusId ? 'PAGO' as const : 'SAIU_PARA_ENTREGA' as const,
      valorItens: '10.00',
      freteAplicado: id === modalityId ? '0.00' : '2.00',
      total: id === modalityId ? '10.00' : '12.00',
      confirmacaoPagamento: new Date(),
    })) });
    await prisma.historicoStatusPedido.createMany({ data: ids.map((pedidoId) => ({
      pedidoId, statusRegistrado: pedidoId === statusId ? 'PAGO' as const : 'SAIU_PARA_ENTREGA' as const,
      dataHora: new Date(),
    })) });

    await assert.rejects(pedidos.confirmarEntrega(eligibleId, otherCourierId), NotFoundException); checks++;
    await assert.rejects(pedidos.confirmarEntrega(randomUUID(), courierId), NotFoundException); checks++;
    assert.equal((await prisma.pedido.findUniqueOrThrow({ where: { id: eligibleId } })).statusAtual,
      'SAIU_PARA_ENTREGA'); checks++;
    assert.equal(await prisma.historicoStatusPedido.count({ where: {
      pedidoId: eligibleId, statusRegistrado: 'ENTREGUE',
    } }), 0); checks++;

    await assert.rejects(pedidos.confirmarEntrega(statusId, courierId), ConflictException); checks++;
    await assert.rejects(pedidos.confirmarEntrega(modalityId, courierId), ConflictException); checks++;
    for (const id of [statusId, modalityId]) {
      assert.equal(await prisma.historicoStatusPedido.count({ where: {
        pedidoId: id, statusRegistrado: 'ENTREGUE',
      } }), 0); checks++;
    }

    const confirmed = await pedidos.confirmarEntrega(eligibleId, courierId);
    assert.equal(confirmed.statusAtual, 'ENTREGUE'); checks++;
    assert.ok(confirmed.dataHora instanceof Date); checks++;
    assert.equal((await prisma.pedido.findUniqueOrThrow({ where: { id: eligibleId } })).statusAtual,
      'ENTREGUE'); checks++;
    const history = await prisma.historicoStatusPedido.findMany({ where: {
      pedidoId: eligibleId, statusRegistrado: 'ENTREGUE',
    } });
    assert.equal(history.length, 1); checks++;
    assert.equal(history[0].responsavelUsuarioId, courierId); checks++;
    assert.equal(history[0].dataHora.getTime(), confirmed.dataHora.getTime()); checks++;
    await assert.rejects(pedidos.confirmarEntrega(eligibleId, courierId), ConflictException); checks++;
    assert.equal(await prisma.historicoStatusPedido.count({ where: {
      pedidoId: eligibleId, statusRegistrado: 'ENTREGUE',
    } }), 1); checks++;

    await observer.query(`CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW."pedidoId" = '${rollbackId}'::uuid THEN
        RAISE EXCEPTION 'D75 forced history failure';
      END IF; RETURN NEW; END; $$`);
    functionCreated = true;
    await observer.query(`CREATE TRIGGER ${triggerName} BEFORE INSERT ON "HistoricoStatusPedido"
      FOR EACH ROW EXECUTE FUNCTION ${functionName}()`);
    triggerCreated = true;
    await assert.rejects(pedidos.confirmarEntrega(rollbackId, courierId),
      /D75 forced history failure/); checks++;
    assert.equal((await prisma.pedido.findUniqueOrThrow({ where: { id: rollbackId } })).statusAtual,
      'SAIU_PARA_ENTREGA'); checks++;
    assert.equal(await prisma.historicoStatusPedido.count({ where: {
      pedidoId: rollbackId, statusRegistrado: 'ENTREGUE',
    } }), 0); checks++;

    await blocker.query('BEGIN');
    const [{ pid: blockerPid }] = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows as Array<{ pid: number }>;
    await blocker.query('SELECT id FROM "Pedido" WHERE id = $1::uuid FOR UPDATE', [concurrentId]);
    lockHeld = true;
    concurrentCalls.push(pedidos.confirmarEntrega(concurrentId, courierId));
    concurrentCalls.push(pedidos.confirmarEntrega(concurrentId, courierId));
    let blocked: Array<{ pid: number; blockers: number[] }> = [];
    for (let attempt = 0; attempt < 100; attempt++) {
      blocked = (await observer.query(`
        SELECT pid, pg_blocking_pids(pid) AS blockers FROM pg_stat_activity
        WHERE application_name = $1 AND state = 'active' AND wait_event_type = 'Lock'
          AND query LIKE '%FOR UPDATE%' AND cardinality(pg_blocking_pids(pid)) > 0`,
        [marker])).rows as typeof blocked;
      if (blocked.length === 2 && blocked.some((row) => row.blockers.includes(blockerPid))) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.equal(blocked.length, 2); checks++;
    assert.equal(blocked.every((row) => row.blockers.length > 0), true); checks++;
    assert.equal(blocked.some((row) => row.blockers.includes(blockerPid)), true); checks++;
    await blocker.query('COMMIT'); lockHeld = false;
    const concurrent = await Promise.allSettled(concurrentCalls);
    assert.equal(concurrent.filter((item) => item.status === 'fulfilled').length, 1); checks++;
    assert.equal(concurrent.filter((item) => item.status === 'rejected').length, 1); checks++;
    assert.equal((await prisma.pedido.findUniqueOrThrow({ where: { id: concurrentId } })).statusAtual,
      'ENTREGUE'); checks++;
    assert.equal(await prisma.historicoStatusPedido.count({ where: {
      pedidoId: concurrentId, statusRegistrado: 'ENTREGUE',
    } }), 1); checks++;
  } finally {
    if (lockHeld) await blocker.query('ROLLBACK');
    await Promise.allSettled(concurrentCalls);
    try {
      if (triggerCreated) await observer.query(`DROP TRIGGER ${triggerName} ON "HistoricoStatusPedido"`);
      if (functionCreated) await observer.query(`DROP FUNCTION ${functionName}()`);
      await prisma.historicoStatusPedido.deleteMany({ where: { pedidoId: { in: ids } } });
      await prisma.pedido.deleteMany({ where: { id: { in: ids } } });
      await prisma.usuario.deleteMany({ where: { id: { in: [clienteId, courierId, otherCourierId] } } });
      assert.equal(await prisma.pedido.count({ where: {
        identificadorNegocio: { startsWith: marker },
      } }), 0);
      assert.equal(await prisma.historicoStatusPedido.count({ where: { pedidoId: { in: ids } } }), 0);
      assert.equal(await prisma.usuario.count({ where: { id: { in: [clienteId, courierId, otherCourierId] } } }), 0);
    } finally {
      await prisma.$disconnect();
      if (observerConnected) await observer.end();
      if (blockerConnected) await blocker.end();
    }
  }
  process.stdout.write(`PASS D75/D76 PostgreSQL (${checks} checks; DB dedicado; concorrência real; rollback; resíduos zero)\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
