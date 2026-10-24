import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { PedidosService } from '../src/pedidos/pedidos.service';

type Fixture = { pedidoId: string; produtoIds: string[]; reservaIds: string[] };

async function main() {
  const raw = process.env.D68_TEST_DATABASE_URL;
  if (!raw || new URL(raw).hostname !== 'localhost' || new URL(raw).pathname !== '/cupcake_d68') {
    throw new Error('D68 exige D68_TEST_DATABASE_URL para localhost/cupcake_d68.');
  }
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hash ||
      [...url.searchParams].some(([key, value]) => key !== 'schema' || value !== 'public')) {
    throw new Error('D68 exige PostgreSQL local dedicado cupcake_d68, schema public.');
  }
  const marker = `d68_${randomUUID().replaceAll('-', '')}`;
  url.searchParams.set('application_name', marker);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  const blocker = new Client({ connectionString: raw });
  const observer = new Client({ connectionString: raw });
  const service = new PedidosService(prisma as never);
  const fixtureMarker = `D68-${randomUUID()}`;
  const clienteId = randomUUID(), outroClienteId = randomUUID(), adminId = randomUUID();
  const categoriaId = randomUUID();
  const pedidos: string[] = [], produtos: string[] = [], reservas: string[] = [];
  const funcao = `${marker}_fn`, trigger = `${marker}_trigger`;
  let blockerConnected = false, observerConnected = false, lockHeld = false;
  let functionCreated = false, triggerCreated = false, originalError: unknown;
  const cleanupErrors: unknown[] = [];
  const pendingOperations: Promise<unknown>[] = [];
  let checks = 0;
  const eq = (actual: unknown, expected: unknown, label: string) => {
    assert.deepEqual(actual, expected, label); checks++;
  };
  const fixture = async (options: { status?: 'PAGO' | 'EM_PREPARO'; ownerId?: string;
    withConvertedReserves?: boolean } = {}): Promise<Fixture> => {
    const pedidoId = randomUUID(), produtoIds = [randomUUID(), randomUUID()];
    const reservaIds = options.withConvertedReserves === false ? [] : [randomUUID(), randomUUID(), randomUUID()];
    pedidos.push(pedidoId); produtos.push(...produtoIds); reservas.push(...reservaIds);
    for (let index = 0; index < produtoIds.length; index++) {
      await prisma.produto.create({ data: { id: produtoIds[index], categoriaId,
        nome: `${fixtureMarker}-${pedidoId}-${index}`, precoAtual: '10.00' } });
      await prisma.estoque.create({ data: { produtoId: produtoIds[index],
        quantidadeFisica: index === 0 ? 5 : 6, quantidadeReservada: index === 0 ? 2 : 1 } });
    }
    await prisma.pedido.create({ data: {
      id: pedidoId, identificadorNegocio: `${fixtureMarker}-${pedidoId}`,
      clienteUsuarioId: options.ownerId ?? clienteId, modalidade: 'RETIRADA',
      statusAtual: options.status ?? 'PAGO', valorItens: '60.00', freteAplicado: '0.00',
      total: '60.00', confirmacaoPagamento: new Date(),
    } });
    await prisma.historicoStatusPedido.create({ data: {
      pedidoId, statusRegistrado: options.status ?? 'PAGO', dataHora: new Date(),
    } });
    if (reservaIds.length) {
      const linhas = [
        { produtoId: produtoIds[0], quantidade: 2 },
        { produtoId: produtoIds[0], quantidade: 1 },
        { produtoId: produtoIds[1], quantidade: 3 },
      ];
      for (let index = 0; index < linhas.length; index++) {
        const linha = linhas[index];
        await prisma.reservaEstoque.create({ data: {
          id: reservaIds[index], pedidoId, ...linha, estado: 'CONVERTIDA_EM_VENDA',
          momentoExpiracaoValidade: new Date(Date.now() + 900_000),
        } });
        await prisma.movimentacaoEstoque.create({ data: {
          produtoId: linha.produtoId, pedidoId, quantidade: -linha.quantidade,
          motivoOrigem: 'VENDA_PEDIDO', data: new Date(),
        } });
      }
    }
    return { pedidoId, produtoIds, reservaIds };
  };
  const snapshot = async (alvo: Fixture) => ({
    pedido: await prisma.pedido.findUniqueOrThrow({ where: { id: alvo.pedidoId },
      select: { statusAtual: true } }),
    reservas: await prisma.reservaEstoque.findMany({ where: { pedidoId: alvo.pedidoId },
      orderBy: { id: 'asc' }, select: { id: true, produtoId: true, quantidade: true, estado: true } }),
    estoques: await prisma.estoque.findMany({ where: { produtoId: { in: alvo.produtoIds } },
      orderBy: { produtoId: 'asc' }, select: { produtoId: true, quantidadeFisica: true, quantidadeReservada: true } }),
    movimentos: await prisma.movimentacaoEstoque.findMany({ where: { pedidoId: alvo.pedidoId },
      orderBy: { id: 'asc' }, select: { produtoId: true, quantidade: true, motivoOrigem: true } }),
    historicos: await prisma.historicoStatusPedido.findMany({ where: { pedidoId: alvo.pedidoId },
      orderBy: { id: 'asc' }, select: { statusRegistrado: true, responsavelUsuarioId: true } }),
  });
  const esperaPelosLocks = async (blockerPid: number) => {
    let bloqueados: Array<{ pid: number; blockers: number[] }> = [];
    for (let attempt = 0; attempt < 120; attempt++) {
      bloqueados = (await observer.query(`
        SELECT pid, pg_blocking_pids(pid) AS blockers
        FROM pg_stat_activity
        WHERE application_name = $1 AND state = 'active'
          AND wait_event_type = 'Lock' AND query LIKE '%FOR UPDATE%'
          AND cardinality(pg_blocking_pids(pid)) > 0`, [marker])).rows as typeof bloqueados;
      const pids = new Set(bloqueados.map((row) => row.pid));
      if (bloqueados.length === 2 && bloqueados.every((row) =>
        row.blockers.some((pid) => pid === blockerPid || pids.has(pid))) &&
        bloqueados.some((row) => row.blockers.includes(blockerPid))) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.fail(`As duas operações não chegaram à disputa do lock: ${JSON.stringify(bloqueados)}`);
  };
  const disputar = async (alvo: Fixture, operations: Array<() => Promise<unknown>>) => {
    await blocker.query('BEGIN');
    const [{ pid: blockerPid }] = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows as Array<{ pid: number }>;
    await blocker.query('SELECT id FROM "Pedido" WHERE id = $1::uuid FOR UPDATE', [alvo.pedidoId]);
    lockHeld = true;
    const concorrentes = operations.map((operation) => operation());
    pendingOperations.push(...concorrentes);
    await esperaPelosLocks(blockerPid);
    await blocker.query('COMMIT'); lockHeld = false;
    return Promise.allSettled(concorrentes);
  };
  const verificarDevolucao = async (alvo: Fixture, responsavelId: string) => {
    const estado = await snapshot(alvo);
    eq(estado.pedido.statusAtual, 'CANCELADO', 'Pedido cancelado');
    eq(estado.reservas.map((reserva) => reserva.estado),
      ['DEVOLVIDA_POR_CANCELAMENTO', 'DEVOLVIDA_POR_CANCELAMENTO', 'DEVOLVIDA_POR_CANCELAMENTO'],
      'Todas as reservas convertidas devolvidas');
    eq(estado.estoques.map(({ produtoId, quantidadeFisica, quantidadeReservada }) =>
      [produtoId, quantidadeFisica, quantidadeReservada]),
    alvo.produtoIds.map((produtoId, index) => [produtoId, index === 0 ? 8 : 9, index === 0 ? 2 : 1])
      .sort(([a], [b]) => String(a).localeCompare(String(b))),
    'Saldo físico recomposto e saldo reservado preservado');
    eq(estado.movimentos.filter((movimento) => movimento.motivoOrigem === 'CANCELAMENTO_PEDIDO')
      .map(({ produtoId, quantidade }) => [produtoId, quantidade]).sort(),
    [[alvo.produtoIds[0], 2], [alvo.produtoIds[0], 1], [alvo.produtoIds[1], 3]].sort(),
    'Movimentações positivas únicas por reserva');
    eq(estado.historicos.filter((historico) => historico.statusRegistrado === 'CANCELADO').map((h) =>
      [h.statusRegistrado, h.responsavelUsuarioId]), [['CANCELADO', responsavelId]],
    'Um histórico de cancelamento com ator');
    return estado;
  };
  const removeTrigger = async () => {
    if (triggerCreated) {
      await blocker.query(`DROP TRIGGER "${trigger}" ON "HistoricoStatusPedido"`);
      triggerCreated = false;
    }
    if (functionCreated) {
      await blocker.query(`DROP FUNCTION "${funcao}"()`);
      functionCreated = false;
    }
  };

  try {
    await blocker.connect(); blockerConnected = true;
    await observer.connect(); observerConnected = true;
    eq((await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`)[0].name,
      'cupcake_d68', 'Banco dedicado confirmado');
    await prisma.usuario.create({ data: { id: clienteId, nome: `${fixtureMarker} cliente`,
      email: `${fixtureMarker}-cliente@example.test`, telefone: '00000000000',
      credencialSenha: 'fixture', perfil: 'CLIENTE' } });
    await prisma.usuario.create({ data: { id: outroClienteId, nome: `${fixtureMarker} outro cliente`,
      email: `${fixtureMarker}-outro@example.test`, telefone: '00000000000',
      credencialSenha: 'fixture', perfil: 'CLIENTE' } });
    await prisma.usuario.create({ data: { id: adminId, nome: `${fixtureMarker} admin`,
      email: `${fixtureMarker}-admin@example.test`, telefone: '00000000000',
      credencialSenha: 'fixture', perfil: 'ADMIN' } });
    await prisma.categoria.create({ data: { id: categoriaId, nome: fixtureMarker } });

    const sucesso = await fixture();
    await service.cancelarComoCliente(sucesso.pedidoId, clienteId);
    const estadoCancelado = await verificarDevolucao(sucesso, clienteId);
    await assert.rejects(service.cancelarComoCliente(sucesso.pedidoId, clienteId)); checks++;
    eq(await snapshot(sucesso), estadoCancelado, 'Retry conflita sem duplicar devolução');

    const semTitularidade = await fixture({ ownerId: outroClienteId });
    const antesSemTitularidade = await snapshot(semTitularidade);
    await assert.rejects(service.cancelarComoCliente(semTitularidade.pedidoId, clienteId)); checks++;
    eq(await snapshot(semTitularidade), antesSemTitularidade, 'Pedido de terceiro permanece intacto');

    const emPreparo = await fixture({ status: 'EM_PREPARO' });
    const antesEmPreparo = await snapshot(emPreparo);
    await assert.rejects(service.cancelarComoCliente(emPreparo.pedidoId, clienteId)); checks++;
    eq(await snapshot(emPreparo), antesEmPreparo, 'Pedido em preparo não é cancelado nem devolvido');

    const semReserva = await fixture({ withConvertedReserves: false });
    const antesSemReserva = await snapshot(semReserva);
    await assert.rejects(service.cancelarComoCliente(semReserva.pedidoId, clienteId)); checks++;
    eq(await snapshot(semReserva), antesSemReserva, 'Pedido sem reserva convertida permanece intacto');

    const rollback = await fixture();
    const antesRollback = await snapshot(rollback);
    await blocker.query(`CREATE FUNCTION "${funcao}"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW."pedidoId" = '${rollback.pedidoId}'::uuid AND NEW."statusRegistrado" = 'CANCELADO' THEN
        RAISE EXCEPTION 'D68 falha injetada após devolução do estoque';
      END IF; RETURN NEW; END $$`); functionCreated = true;
    await blocker.query(`CREATE TRIGGER "${trigger}" BEFORE INSERT ON "HistoricoStatusPedido"
      FOR EACH ROW EXECUTE FUNCTION "${funcao}"()`); triggerCreated = true;
    await assert.rejects(service.cancelarComoCliente(rollback.pedidoId, clienteId)); checks++;
    eq(await snapshot(rollback), antesRollback,
      'Rollback integral de pedido, reserva, saldos, movimentos e histórico');
    await removeTrigger();

    const duplicado = await fixture();
    const concorrenciaDuplicada = await disputar(duplicado, [
      () => service.cancelarComoCliente(duplicado.pedidoId, clienteId),
      () => service.cancelarComoCliente(duplicado.pedidoId, clienteId),
    ]);
    eq(concorrenciaDuplicada.filter((result) => result.status === 'fulfilled').length, 1,
      'Somente um cancelamento concorrente confirma');
    eq(concorrenciaDuplicada.filter((result) => result.status === 'rejected').length, 1,
      'Cancelamento concorrente repetido conflita');
    await verificarDevolucao(duplicado, clienteId);

    const corridaStatus = await fixture();
    const antesCorridaStatus = await snapshot(corridaStatus);
    const concorrenciaStatus = await disputar(corridaStatus, [
      () => service.cancelarComoCliente(corridaStatus.pedidoId, clienteId),
      () => service.iniciarProducao(corridaStatus.pedidoId, adminId),
    ]);
    eq(concorrenciaStatus.filter((result) => result.status === 'fulfilled').length, 1,
      'Cancelamento e preparo têm um único vencedor');
    eq(concorrenciaStatus.filter((result) => result.status === 'rejected').length, 1,
      'Transição concorrente perdedora conflita');
    const finalCorrida = await snapshot(corridaStatus);
    if (finalCorrida.pedido.statusAtual === 'CANCELADO') {
      await verificarDevolucao(corridaStatus, clienteId);
    } else {
      eq(finalCorrida.pedido.statusAtual, 'EM_PREPARO', 'Preparo vence sem cancelamento');
      eq(finalCorrida.reservas, antesCorridaStatus.reservas, 'Reservas permanecem convertidas');
      eq(finalCorrida.estoques, antesCorridaStatus.estoques, 'Saldo não é recomposto após início do preparo');
      eq(finalCorrida.movimentos, antesCorridaStatus.movimentos, 'Movimentos não duplicados se preparo vence');
      eq(finalCorrida.historicos.filter((history) => history.statusRegistrado === 'CANCELADO'), [],
        'Nenhum histórico de cancelamento se preparo vence');
    }

    eq(await prisma.pedido.count({ where: { identificadorNegocio: { startsWith: fixtureMarker } } }),
      pedidos.length, 'Todas as fixtures criadas foram rastreadas');
  } catch (error) {
    originalError = error;
  } finally {
    const cleanup = async (label: string, action: () => Promise<unknown>) => {
      try { await action(); } catch (error) { cleanupErrors.push(new Error(label, { cause: error })); }
    };
    if (lockHeld) await cleanup('rollback lock', () => blocker.query('ROLLBACK'));
    await Promise.allSettled(pendingOperations);
    await cleanup('remover trigger', removeTrigger);
    if (blockerConnected) await cleanup('resíduos de instrumentação', async () => {
      const result = await blocker.query(`SELECT
        (SELECT count(*)::int FROM pg_trigger WHERE tgname = $1) AS triggers,
        (SELECT count(*)::int FROM pg_proc WHERE proname = $2) AS functions`, [trigger, funcao]);
      eq(result.rows[0], { triggers: 0, functions: 0 }, 'Sem trigger/função residual');
    });
    await cleanup('movimentações', () => prisma.movimentacaoEstoque.deleteMany({ where: { pedidoId: { in: pedidos } } }));
    await cleanup('históricos', () => prisma.historicoStatusPedido.deleteMany({ where: { pedidoId: { in: pedidos } } }));
    await cleanup('reservas', () => prisma.reservaEstoque.deleteMany({ where: { pedidoId: { in: pedidos } } }));
    await cleanup('pedidos', () => prisma.pedido.deleteMany({ where: { id: { in: pedidos } } }));
    await cleanup('estoques', () => prisma.estoque.deleteMany({ where: { produtoId: { in: produtos } } }));
    await cleanup('produtos', () => prisma.produto.deleteMany({ where: { id: { in: produtos } } }));
    await cleanup('categoria', () => prisma.categoria.deleteMany({ where: { id: categoriaId } }));
    await cleanup('usuários', () => prisma.usuario.deleteMany({ where: { id: { in: [clienteId, outroClienteId, adminId] } } }));
    await cleanup('resíduos', async () => {
      eq(await prisma.pedido.count({ where: { identificadorNegocio: { startsWith: fixtureMarker } } }), 0,
        'Sem pedidos residuais');
      eq(await prisma.reservaEstoque.count({ where: { pedidoId: { in: pedidos } } }), 0, 'Sem reservas residuais');
      eq(await prisma.movimentacaoEstoque.count({ where: { pedidoId: { in: pedidos } } }), 0,
        'Sem movimentos residuais');
      eq(await prisma.historicoStatusPedido.count({ where: { pedidoId: { in: pedidos } } }), 0,
        'Sem históricos residuais');
      eq(await prisma.estoque.count({ where: { produtoId: { in: produtos } } }), 0, 'Sem saldos residuais');
      eq(await prisma.produto.count({ where: { id: { in: produtos } } }), 0, 'Sem produtos residuais');
      eq(await prisma.categoria.count({ where: { id: categoriaId } }), 0, 'Sem categoria residual');
      eq(await prisma.usuario.count({ where: { id: { in: [clienteId, outroClienteId, adminId] } } }), 0,
        'Sem usuários residuais');
    });
    if (observerConnected) await cleanup('fechar observer', () => observer.end());
    if (blockerConnected) await cleanup('fechar blocker', () => blocker.end());
    await cleanup('fechar Prisma', () => prisma.$disconnect());
  }
  if (originalError || cleanupErrors.length) throw new AggregateError(
    [...(originalError ? [originalError] : []), ...cleanupErrors], 'D68/D69 PostgreSQL falhou');
  process.stdout.write(`PASS D68+D69 PostgreSQL (${checks} verificações; rollback e fixtures limpas)\n`);
}

main().catch((error: unknown) => { process.stderr.write(`${String(error)}\n`); process.exitCode = 1; });
