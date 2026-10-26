import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { PedidosService } from '../src/pedidos/pedidos.service';

async function main() {
  const raw = process.env.D71_TEST_DATABASE_URL;
  if (!raw || new URL(raw).hostname !== 'localhost' || new URL(raw).pathname !== '/cupcake_d71') {
    throw new Error('D71 exige D71_TEST_DATABASE_URL para localhost/cupcake_d71.');
  }
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hash ||
      [...url.searchParams].some(([key, value]) => key !== 'schema' || value !== 'public')) {
    throw new Error('D71 exige PostgreSQL local dedicado cupcake_d71, schema public.');
  }
  const marker = `D71-${randomUUID()}`;
  url.searchParams.set('application_name', marker);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  const blocker = new Client({ connectionString: raw });
  const observer = new Client({ connectionString: raw });
  const pedidos = new PedidosService(prisma as never, { agendarStatusPedido: async () => undefined } as never);
  const clienteId = randomUUID(), adminId = randomUUID(), entregadorId = randomUUID();
  const clienteAlternativoId = randomUUID();
  const pedidoId = randomUUID(), retiradaId = randomUUID(), statusInvalidoId = randomUUID();
  const concorrenteId = randomUUID(), rollbackId = randomUUID();
  const pedidoIds = [pedidoId, retiradaId, statusInvalidoId, concorrenteId, rollbackId];
  const concurrentCalls: Promise<unknown>[] = [];
  let blockerConnected = false, observerConnected = false, lockHeld = false;
  let checks = 0;

  try {
    await blocker.connect(); blockerConnected = true;
    await observer.connect(); observerConnected = true;
    const [database] = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    assert.equal(database.name, 'cupcake_d71'); checks++;

    await prisma.usuario.createMany({ data: [
      { id: clienteId, nome: `${marker} cliente`, email: `${marker}-cliente@example.test`,
        telefone: '00000000000', credencialSenha: 'fixture', perfil: 'CLIENTE' },
      { id: adminId, nome: `${marker} admin`, email: `${marker}-admin@example.test`,
        telefone: '00000000000', credencialSenha: 'fixture', perfil: 'ADMIN' },
      { id: entregadorId, nome: `${marker} entregador`, email: `${marker}-entregador@example.test`,
        telefone: '00000000000', credencialSenha: 'fixture', perfil: 'ENTREGADOR' },
      { id: clienteAlternativoId, nome: `${marker} não entregador`, email: `${marker}-outro@example.test`,
        telefone: '00000000000', credencialSenha: 'fixture', perfil: 'CLIENTE' },
    ] });

    const criarPedido = async (id: string, modalidade: 'ENTREGA' | 'RETIRADA', statusAtual: 'EM_PREPARO' | 'PAGO' = 'EM_PREPARO') => {
      await prisma.pedido.create({ data: { id, identificadorNegocio: `${marker}-${id}`,
        clienteUsuarioId: clienteId, modalidade, statusAtual, valorItens: '10.00',
        freteAplicado: modalidade === 'ENTREGA' ? '2.00' : '0.00',
        total: modalidade === 'ENTREGA' ? '12.00' : '10.00', confirmacaoPagamento: new Date() } });
      await prisma.historicoStatusPedido.create({ data: { pedidoId: id, statusRegistrado: statusAtual,
        dataHora: new Date() } });
    };
    await criarPedido(pedidoId, 'ENTREGA');
    await criarPedido(retiradaId, 'RETIRADA');
    await criarPedido(statusInvalidoId, 'ENTREGA', 'PAGO');
    await criarPedido(concorrenteId, 'ENTREGA');
    await criarPedido(rollbackId, 'ENTREGA');

    const result = await pedidos.sairParaEntrega(pedidoId, entregadorId, adminId);
    assert.equal(result.statusAtual, 'SAIU_PARA_ENTREGA'); checks++;
    assert.deepEqual(result.entregador, { id: entregadorId, nome: `${marker} entregador` }); checks++;
    const history = await prisma.historicoStatusPedido.findMany({ where: { pedidoId },
      orderBy: [{ dataHora: 'asc' }, { id: 'asc' }], select: { statusRegistrado: true, responsavelUsuarioId: true } });
    assert.deepEqual(history.map(({ statusRegistrado, responsavelUsuarioId }) =>
      [statusRegistrado, responsavelUsuarioId]), [
      ['EM_PREPARO', null], ['SAIU_PARA_ENTREGA', adminId],
    ]); checks++;

    await assert.rejects(pedidos.sairParaEntrega(retiradaId, entregadorId, adminId)); checks++;
    await assert.rejects(pedidos.sairParaEntrega(statusInvalidoId, entregadorId, adminId)); checks++;
    await assert.rejects(pedidos.sairParaEntrega(rollbackId, clienteAlternativoId, adminId)); checks++;
    assert.equal((await prisma.pedido.findUniqueOrThrow({ where: { id: rollbackId } })).entregadorUsuarioId, null); checks++;
    assert.equal(await prisma.historicoStatusPedido.count({ where: { pedidoId: rollbackId,
      statusRegistrado: 'SAIU_PARA_ENTREGA' } }), 0); checks++;

    await assert.rejects(pedidos.sairParaEntrega(rollbackId, entregadorId, randomUUID())); checks++;
    const rollbackPedido = await prisma.pedido.findUniqueOrThrow({ where: { id: rollbackId },
      select: { statusAtual: true, entregadorUsuarioId: true } });
    assert.deepEqual(rollbackPedido, { statusAtual: 'EM_PREPARO', entregadorUsuarioId: null }); checks++;
    assert.equal(await prisma.historicoStatusPedido.count({ where: { pedidoId: rollbackId,
      statusRegistrado: 'SAIU_PARA_ENTREGA' } }), 0); checks++;

    await blocker.query('BEGIN');
    const [{ pid: blockerPid }] = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows as Array<{ pid: number }>;
    await blocker.query('SELECT id FROM "Pedido" WHERE id = $1::uuid FOR UPDATE', [concorrenteId]);
    lockHeld = true;
    concurrentCalls.push(pedidos.sairParaEntrega(concorrenteId, entregadorId, adminId));
    concurrentCalls.push(pedidos.sairParaEntrega(concorrenteId, entregadorId, adminId));
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
    assert.equal(await prisma.historicoStatusPedido.count({ where: { pedidoId: concorrenteId,
      statusRegistrado: 'SAIU_PARA_ENTREGA' } }), 1); checks++;

    await assert.rejects(pedidos.sairParaEntrega(pedidoId, entregadorId, adminId)); checks++;
  } finally {
    if (lockHeld) await blocker.query('ROLLBACK');
    await Promise.allSettled(concurrentCalls);
    await prisma.historicoStatusPedido.deleteMany({ where: { pedidoId: { in: pedidoIds } } });
    await prisma.pedido.deleteMany({ where: { id: { in: pedidoIds } } });
    await prisma.usuario.deleteMany({ where: { id: { in: [clienteId, adminId, entregadorId, clienteAlternativoId] } } });
    assert.equal(await prisma.pedido.count({ where: { identificadorNegocio: { startsWith: marker } } }), 0);
    assert.equal(await prisma.historicoStatusPedido.count({ where: { pedidoId: { in: pedidoIds } } }), 0);
    assert.equal(await prisma.usuario.count({ where: { id: { in: [clienteId, adminId, entregadorId, clienteAlternativoId] } } }), 0);
    await prisma.$disconnect();
    if (observerConnected) await observer.end();
    if (blockerConnected) await blocker.end();
  }
  process.stdout.write(`PASS D71 PostgreSQL (${checks} verificações; concorrência real; fixtures limpas)\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
