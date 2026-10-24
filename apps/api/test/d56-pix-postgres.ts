import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import request from 'supertest';
import { PagamentosModule } from '../src/pagamentos/pagamentos.module';
import { PagamentoSimuladorService } from '../src/pagamentos/pagamento-simulador.service';
import { PrismaClient } from '../src/generated/prisma/client';

const raw = process.env.D56_TEST_DATABASE_URL;
if (!raw) throw new Error('Defina D56_TEST_DATABASE_URL.');
const url = new URL(raw);
if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    (url.port && url.port !== '5432') || url.pathname !== '/cupcake_d56' || url.hash ||
    [...url.searchParams].some(([key, value]) => key !== 'schema' || value !== 'public')) {
  throw new Error('D56 exige PostgreSQL local dedicado cupcake_d56, schema public.');
}
const marker = `d56_${randomUUID().replaceAll('-', '')}`;
url.searchParams.set('application_name', marker);
process.env.DATABASE_URL = url.toString();
process.env.JWT_ACCESS_SECRET = `d56-access-${randomUUID()}`;
process.env.JWT_REFRESH_SECRET = `d56-refresh-${randomUUID()}`;

class SimuladorControlado extends PagamentoSimuladorService {
  readonly entradas = new Map<string, number>();
  private readonly barreiras = new Map<string, {
    promise: Promise<void>; liberar: () => void; descartar: () => void;
  }>();

  bloquear(id: string) {
    let liberar!: () => void, descartar!: () => void;
    const promise = new Promise<void>((resolve, reject) => {
      liberar = resolve;
      descartar = () => reject(new Error('Interrupção simulada do processo D56'));
    });
    // A barreira também pode ser descartada durante cleanup antes de ser alcançada.
    void promise.catch(() => undefined);
    this.barreiras.set(id, { promise, liberar, descartar });
  }
  liberar(id: string) { this.barreiras.get(id)?.liberar(); }
  descartar() { for (const barreira of this.barreiras.values()) barreira.descartar(); }
  override async simular(id: string) {
    this.entradas.set(id, (this.entradas.get(id) ?? 0) + 1);
    await this.barreiras.get(id)?.promise;
    return super.simular(id);
  }
}

async function aguardar(condicao: () => boolean | Promise<boolean>, descricao: string) {
  const limite = Date.now() + 5000;
  while (!await condicao()) {
    if (Date.now() >= limite) throw new Error(`Barreira D56 não atingida: ${descricao}`);
    await delay(10);
  }
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  const blocker = new Client({ connectionString: url.toString(), application_name: `${marker}_blocker` });
  const apps: INestApplication[] = [], simuladores: SimuladorControlado[] = [];
  const tasks: Promise<unknown>[] = [], pedidos: string[] = [], usuarios: string[] = [];
  const categoriaId = randomUUID(), produtoId = randomUUID();
  const audit = `${marker}_audit`, fn = `${marker}_fn`, trigger = `${marker}_trigger`;
  let checks = 0, originalError: unknown, conectado = false, auditoria = false;
  const cleanupErrors: unknown[] = [];
  const eq = (actual: unknown, expected: unknown, label: string) => {
    assert.deepEqual(actual, expected, label); checks++;
  };
  const track = <T>(promise: Promise<T>) => {
    tasks.push(promise); void promise.catch(() => undefined); return promise;
  };
  const novaApp = async () => {
    const simulador = new SimuladorControlado();
    simuladores.push(simulador);
    const module = await Test.createTestingModule({ imports: [PagamentosModule] })
      .overrideProvider(PagamentoSimuladorService).useValue(simulador).compile();
    const app = module.createNestApplication();
    app.useLogger(false);
    apps.push(app);
    await app.init();
    return { app, simulador };
  };
  const tentativa = (aprovada = true) => randomUUID().slice(0, -1) + (aprovada ? '0' : '1');
  const novoPedido = async (clienteUsuarioId: string) => {
    const id = randomUUID(); pedidos.push(id);
    await prisma.pedido.create({ data: { id, identificadorNegocio: `${marker}-${id}`,
      clienteUsuarioId, modalidade: 'ENTREGA', valorItens: '12.34', freteAplicado: '1.23', total: '13.57' } });
    await prisma.reservaEstoque.create({ data: { pedidoId: id, produtoId, quantidade: 1,
      estado: 'ATIVA', momentoExpiracaoValidade: new Date(Date.now() + 900000) } });
    return id;
  };
  const snapshot = async (id: string) => ({
    pedido: await prisma.pedido.findUniqueOrThrow({ where: { id } }),
    reservas: await prisma.reservaEstoque.findMany({ where: { pedidoId: id }, orderBy: { id: 'asc' } }),
    estoque: await prisma.estoque.findUniqueOrThrow({ where: { produtoId } }),
    movimentos: await prisma.movimentacaoEstoque.findMany({ where: { produtoId } }),
    historicos: await prisma.historicoStatusPedido.findMany({ where: { pedidoId: id } }),
  });
  const eqVenda = (antes: Awaited<ReturnType<typeof snapshot>>,
    depois: Awaited<ReturnType<typeof snapshot>>, pedidoId: string) => {
    eq(depois.pedido.statusAtual, 'PAGO', 'Pedido pago');
    eq(depois.pedido.confirmacaoPagamento instanceof Date, true, 'Confirmação registrada');
    eq(depois.reservas.map((r) => r.estado), ['CONVERTIDA_EM_VENDA'], 'Reserva convertida');
    eq([depois.estoque.quantidadeFisica, depois.estoque.quantidadeReservada],
      [antes.estoque.quantidadeFisica - 1, antes.estoque.quantidadeReservada - 1], 'Saldo baixado uma vez');
    const movimentos = depois.movimentos.filter((m) => m.pedidoId === pedidoId);
    eq(movimentos.map((m) => [m.quantidade, m.motivoOrigem]), [[-1, 'VENDA_PEDIDO']],
      'Movimentação de venda registrada');
    eq(depois.historicos.map((h) => h.statusRegistrado), ['PAGO'], 'Histórico do pedido');
  };
  const bloqueados = async (fragmento: string, minimo: number) => {
    const rows = await prisma.$queryRaw<Array<{ pid: number; blockers: number[] }>>`
      SELECT pid, pg_blocking_pids(pid) AS blockers FROM pg_stat_activity
      WHERE application_name = ${marker} AND wait_event_type = 'Lock'
        AND query LIKE ${`%${fragmento}%`} AND cardinality(pg_blocking_pids(pid)) > 0`;
    if (rows.length >= minimo) {
      process.stdout.write(`D56 locks ${fragmento}: ${JSON.stringify(rows)}\n`);
      return true;
    }
    return false;
  };
  try {
    await blocker.connect(); conectado = true;
    eq((await blocker.query('SELECT current_database() AS db, current_schema() AS schema')).rows,
      [{ db: 'cupcake_d56', schema: 'public' }], 'Banco dedicado');
    const migrations = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    for (const migration of readdirSync(resolve(__dirname, '../prisma/migrations')).filter((v) => /^\d+_/.test(v))) {
      eq(migrations.some((m) => m.migration_name === migration), true, migration);
    }
    // Instrumentação exclusiva do harness: conta as transições reais feitas pelo PostgreSQL.
    await blocker.query(`CREATE TABLE "${audit}" (id uuid NOT NULL)`);
    auditoria = true;
    await blocker.query(`CREATE FUNCTION "${fn}"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN INSERT INTO "${audit}" VALUES (NEW.id); RETURN NEW; END $$`);
    await blocker.query(`CREATE TRIGGER "${trigger}" AFTER UPDATE ON "Pagamento"
      FOR EACH ROW EXECUTE FUNCTION "${fn}"()`);
    for (let i = 0; i < 2; i++) {
      const id = randomUUID(); usuarios.push(id);
      await prisma.usuario.create({ data: { id, nome: `${marker}-${i}`, email: `${marker}-${i}@example.test`,
        telefone: '00000000000', credencialSenha: 'fixture', perfil: 'CLIENTE' } });
    }
    await prisma.categoria.create({ data: { id: categoriaId, nome: marker } });
    await prisma.produto.create({ data: { id: produtoId, categoriaId, nome: marker, precoAtual: '12.34' } });
    await prisma.estoque.create({ data: { produtoId, quantidadeFisica: 100, quantidadeReservada: 30 } });
    const jwt = new JwtService();
    const token = async (id: string) => `Bearer ${await jwt.signAsync({ sub: id, perfil: 'CLIENTE', type: 'access' }, {
      secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m',
    })}`;
    const auth = await token(usuarios[0]), outroAuth = await token(usuarios[1]);
    let { app, simulador } = await novaApp();
    const post = (pedido: string, id: string, authorization = auth) => track(request(app.getHttpServer())
      .post(`/pedidos/${pedido}/pagamentos/pix`).set('Authorization', authorization).send({ tentativaId: id }).then((r) => r));
    const get = (pedido: string, id: string, authorization = auth) => request(app.getHttpServer())
      .get(`/pedidos/${pedido}/pagamentos/pix/${id}`).set('Authorization', authorization);
    const transicoes = async (id: string) => Number((await blocker.query(
      `SELECT count(*) AS total FROM "${audit}" WHERE id = $1`, [id])).rows[0].total);

    const pedido = await novoPedido(usuarios[0]), id = tentativa();
    const antes = await snapshot(pedido);
    simulador.bloquear(id);
    const criacao = post(pedido, id);
    await aguardar(() => simulador.entradas.get(id) === 1, 'simulação após commit');
    const pendente = await get(pedido, id);
    eq(pendente.status, 200, 'Pendente visível fora da transação');
    eq(pendente.body, { tentativaId: id, pedidoId: pedido, forma: 'PIX', resultado: 'PENDENTE',
      valorAplicavel: '13.57', dataTransacao: null }, 'Pendente e valor autoritativo');
    eq((await post(pedido, tentativa())).status, 409, 'Não permite outra pendente');
    const timeout = await criacao;
    eq(timeout.status, 504, 'Timeout HTTP real');
    eq(timeout.body.tentativaId, id, '504 preserva identidade');
    eq('resultado' in timeout.body, false, '504 não afirma resultado');
    eq((await get(pedido, id)).body, pendente.body, 'GET após 504 é consultivo');
    simulador.liberar(id);
    await aguardar(async () => (await get(pedido, id)).body.resultado === 'APROVADO', 'conclusão posterior ao 504');
    const final = await get(pedido, id);
    eq(typeof final.body.dataTransacao, 'string', 'Final possui data');
    const repeticao = await post(pedido.toUpperCase(), id.toUpperCase());
    eq(repeticao.status, 200, 'Retry final'); eq(repeticao.body, final.body, 'Final imutável e UUID normalizado');
    eq(await transicoes(id), 1, 'Uma transição persistida');
    eq((await post(pedido, tentativa())).status, 409, 'Não permite outra após aprovação');
    eqVenda(antes, await snapshot(pedido), pedido);

    eq((await get(pedido, id, outroAuth)).status, 404, 'GET sem ownership');
    eq((await post(pedido, id, outroAuth)).status, 404, 'POST sem ownership');
    eq((await post(randomUUID(), tentativa())).status, 404, 'Pedido inexistente');
    eq((await get(pedido, randomUUID())).status, 404, 'Tentativa inexistente');
    const outroPedido = await novoPedido(usuarios[0]);
    eq((await post(outroPedido, id)).status, 409, 'UUID vinculado a outro pedido');
    eq((await get(outroPedido, id)).status, 404, 'UUID não dá acesso por outro pedido');
    const pedidoAlheio = await novoPedido(usuarios[1]);
    eq((await post(pedidoAlheio, id, outroAuth)).status, 409, 'Conflito entre clientes não vaza tentativa');
    const cartaoId = tentativa();
    await prisma.pagamento.create({ data: { id: cartaoId, pedidoId: outroPedido, forma: 'CARTAO',
      resultado: 'RECUSADO', dataTransacao: new Date(), valorAplicavel: '13.57' } });
    eq((await post(outroPedido, cartaoId)).status, 409, 'UUID de outro contexto');
    eq((await get(outroPedido, cartaoId)).status, 404, 'Consulta Pix não expõe cartão');

    const recusadoPedido = await novoPedido(usuarios[0]), recusadoId = tentativa(false);
    const antesRecusa = await snapshot(recusadoPedido);
    const recusado = await post(recusadoPedido, recusadoId);
    eq(recusado.status, 201, 'Criação concluída'); eq(recusado.body.resultado, 'RECUSADO', 'Recusa determinística');
    eq(await snapshot(recusadoPedido), antesRecusa, 'Recusa não altera estoque nem pedido');
    eq((await post(recusadoPedido, recusadoId)).body, recusado.body, 'Recusa imutável');
    eq((await post(recusadoPedido, tentativa())).body.resultado, 'APROVADO', 'Novo ID após recusa');
    eqVenda(antesRecusa, await snapshot(recusadoPedido), recusadoPedido);

    // Simula perda do trabalho em memória; nova aplicação não possui barreira nem job anterior.
    const restartPedido = await novoPedido(usuarios[0]), restartId = tentativa(false);
    const antesRestart = await snapshot(restartPedido);
    simulador.bloquear(restartId);
    eq((await post(restartPedido, restartId)).status, 504, 'Timeout antes do restart simulado');
    simulador.descartar(); await delay(20); await app.close();
    ({ app, simulador } = await novaApp());
    eq((await get(restartPedido, restartId)).body.resultado, 'PENDENTE', 'Restart mantém pendente');
    eq(simulador.entradas.size, 0, 'GET não recupera automaticamente');
    const retomada = await post(restartPedido, restartId);
    eq(retomada.status, 200, 'Retry retoma identidade'); eq(retomada.body.resultado, 'RECUSADO', 'Mesmo resultado após restart');
    eq(await prisma.pagamento.count({ where: { pedidoId: restartPedido } }), 1, 'Restart não duplica pagamento');
    eq(await snapshot(restartPedido), antesRestart, 'Retomada sem efeitos comerciais');

    // Duas requisições chegam ao lock de pedido; depois duas conclusões disputam a mesma linha.
    const concorrentePedido = await novoPedido(usuarios[0]), concorrenteId = tentativa();
    const antesConcorrencia = await snapshot(concorrentePedido);
    simulador.bloquear(concorrenteId);
    await blocker.query('BEGIN');
    await blocker.query('SELECT id FROM "Pedido" WHERE id = $1 FOR UPDATE', [concorrentePedido]);
    const c1 = post(concorrentePedido, concorrenteId), c2 = post(concorrentePedido, concorrenteId);
    await aguardar(() => bloqueados('FOR UPDATE', 2), 'dois POSTs bloqueados no pedido');
    await blocker.query('COMMIT');
    await aguardar(() => simulador.entradas.get(concorrenteId) === 2, 'dois trabalhos iniciados');
    eq(await prisma.pagamento.count({ where: { pedidoId: concorrentePedido } }), 1, 'Criação concorrente idempotente');
    await blocker.query('BEGIN');
    await blocker.query('SELECT id FROM "Pedido" WHERE id = $1 FOR UPDATE', [concorrentePedido]);
    simulador.liberar(concorrenteId);
    await aguardar(() => bloqueados('FOR UPDATE', 2), 'duas conclusões realmente bloqueadas no pedido');
    await blocker.query('COMMIT');
    const concorrentes = await Promise.all([c1, c2]);
    eq(concorrentes.map((r) => r.status).sort(), [200, 201], 'Uma criação e uma repetição');
    eq(concorrentes[0].body, concorrentes[1].body, 'Ambos observam o mesmo final/data');
    eq(await transicoes(concorrenteId), 1, 'Somente um UPDATE condicional alterou a linha');
    eqVenda(antesConcorrencia, await snapshot(concorrentePedido), concorrentePedido);

    // A elegibilidade precisa ser relida depois da espera pelo lock, usando relógio do banco.
    for (const alteracao of ['prazo', 'status', 'ownership']) {
      const alvo = await novoPedido(usuarios[0]);
      await blocker.query('BEGIN');
      await blocker.query('SELECT id FROM "Pedido" WHERE id = $1 FOR UPDATE', [alvo]);
      const req = post(alvo, tentativa());
      await aguardar(() => bloqueados('FOR UPDATE', 1), `revalidação ${alteracao}`);
      if (alteracao === 'prazo') await blocker.query(
        'UPDATE "Pedido" SET data = clock_timestamp() - interval \'15 minutes\' WHERE id = $1', [alvo]);
      if (alteracao === 'status') await blocker.query('UPDATE "Pedido" SET "statusAtual" = \'EXPIRADO\' WHERE id = $1', [alvo]);
      if (alteracao === 'ownership') await blocker.query('UPDATE "Pedido" SET "clienteUsuarioId" = $2 WHERE id = $1', [alvo, usuarios[1]]);
      await blocker.query('COMMIT');
      eq((await req).status, alteracao === 'ownership' ? 404 : 409, `Revalida ${alteracao} após lock`);
      eq(await prisma.pagamento.count({ where: { pedidoId: alvo } }), 0, 'Falha não cria pagamento');
    }
    const expiradoPedido = await novoPedido(usuarios[0]), expiradoId = tentativa();
    await prisma.pagamento.create({ data: { id: expiradoId, pedidoId: expiradoPedido, forma: 'PIX',
      resultado: 'PENDENTE', dataTransacao: null, valorAplicavel: '13.57' } });
    await prisma.$executeRaw`UPDATE "Pedido" SET data = clock_timestamp() - interval '15 minutes' WHERE id = ${expiradoPedido}::uuid`;
    eq((await post(expiradoPedido, expiradoId)).status, 409, 'Retry pendente expirado não retoma');
    eq((await get(expiradoPedido, expiradoId)).body.resultado, 'PENDENTE', 'GET expirado continua consultivo');
    eq(simulador.entradas.has(expiradoId), false, 'Retry inelegível não inicia trabalho');
    await prisma.$executeRaw`UPDATE "Pedido" SET "statusAtual" = 'EXPIRADO' WHERE id = ${pedido}::uuid`;
    eq((await post(pedido, id)).body, final.body, 'Retry final independe de elegibilidade atual');

    const limiteDuranteSimulacao = await novoPedido(usuarios[0]), limiteId = tentativa();
    simulador.bloquear(limiteId);
    eq((await post(limiteDuranteSimulacao, limiteId)).status, 504, 'Timeout enquanto simulação aguarda');
    await blocker.query('BEGIN');
    await blocker.query('SELECT id FROM "Pedido" WHERE id = $1 FOR UPDATE', [limiteDuranteSimulacao]);
    simulador.liberar(limiteId);
    await aguardar(() => bloqueados('SELECT id, "statusAtual", data', 1), 'conclusão bloqueada no pedido');
    await blocker.query(
      'UPDATE "Pedido" SET data = clock_timestamp() - interval \'15 minutes\' WHERE id = $1',
      [limiteDuranteSimulacao]);
    await blocker.query('COMMIT');
    await aguardar(async () => {
      const [{ ativos }] = await prisma.$queryRaw<Array<{ ativos: bigint }>>`
        SELECT count(*) AS ativos FROM pg_stat_activity
        WHERE pid <> pg_backend_pid() AND application_name = ${marker} AND state = 'active'
          AND query LIKE '%SELECT id, "statusAtual", data FROM "Pedido"%'`;
      return ativos === 0n;
    }, 'finalização após revalidação do prazo');
    eq(await prisma.pagamento.findUnique({ where: { id: limiteId } }).then((p) => p?.resultado),
      'PENDENTE', 'Prazo vencido durante simulação não aprova pagamento');
    eq(await prisma.pedido.findUnique({ where: { id: limiteDuranteSimulacao } }).then((p) => p?.statusAtual),
      'PENDENTE_PAGAMENTO', 'Prazo vencido não altera status automaticamente');
    eq(await prisma.reservaEstoque.findFirst({ where: { pedidoId: limiteDuranteSimulacao } })
      .then((r) => r?.estado), 'ATIVA', 'Prazo vencido não converte reserva');

    const recuperavel = await novoPedido(usuarios[0]), recuperavelId = tentativa();
    await prisma.estoque.update({ where: { produtoId }, data: { quantidadeFisica: 1, quantidadeReservada: 0 } });
    const antesFalha = await snapshot(recuperavel);
    eq((await post(recuperavel, recuperavelId)).status, 409, 'Saldo reservado inconsistente impede aprovação');
    eq(await get(recuperavel, recuperavelId).then((r) => r.body.resultado), 'PENDENTE',
      'Falha conserva pagamento pendente');
    eq(await snapshot(recuperavel), antesFalha, 'Falha reverte pedido, reserva, estoque e histórico');
    await prisma.estoque.update({ where: { produtoId }, data: { quantidadeFisica: 1, quantidadeReservada: 1 } });
    const saldoRestaurado = { ...antesFalha, estoque: {
      ...antesFalha.estoque, quantidadeFisica: 1, quantidadeReservada: 1,
    } };
    eq((await post(recuperavel, recuperavelId)).body.resultado, 'APROVADO', 'Retry conclui após corrigir saldo');
    eqVenda(saldoRestaurado, await snapshot(recuperavel), recuperavel);

    for (const [resultado, data] of [['PENDENTE', new Date()], ['APROVADO', null], ['RECUSADO', null]]) {
      await assert.rejects(blocker.query(
        'INSERT INTO "Pagamento" (id,"pedidoId",forma,resultado,"dataTransacao","valorAplicavel") VALUES ($1,$2,\'PIX\',$3,$4,13.57)',
        [randomUUID(), outroPedido, resultado, data]),
      (error: unknown) => (error as { code: string; constraint: string }).code === '23514' &&
        (error as { constraint: string }).constraint === 'Pagamento_resultado_data_check');
      checks++;
    }
    eq((await blocker.query('SELECT count(*) AS total FROM "Pagamento" WHERE "pedidoId" = ANY($1::uuid[]) AND "valorAplicavel" <> 13.57', [pedidos])).rows[0].total,
      '0', 'Todos os valores autoritativos');
  } catch (error) {
    originalError = error;
  } finally {
    const cleanup = async (label: string, action: () => Promise<unknown>) => {
      try { await action(); } catch (error) { cleanupErrors.push(new Error(label, { cause: error })); }
    };
    if (conectado) await cleanup('liberar locks', () => blocker.query('ROLLBACK'));
    for (const simulador of simuladores) simulador.descartar();
    await Promise.allSettled(tasks);
    for (const app of apps) await cleanup('fechar app', () => app.close());
    if (auditoria) {
      await cleanup('trigger', () => blocker.query(`DROP TRIGGER IF EXISTS "${trigger}" ON "Pagamento"`));
      await cleanup('function', () => blocker.query(`DROP FUNCTION IF EXISTS "${fn}"()`));
      await cleanup('audit', () => blocker.query(`DROP TABLE "${audit}"`));
      await cleanup('resíduos instrumentação', async () => {
        eq((await blocker.query('SELECT count(*) AS total FROM pg_class WHERE relname = $1', [audit])).rows[0].total, '0', 'Sem tabela audit');
        eq((await blocker.query('SELECT count(*) AS total FROM pg_proc WHERE proname = $1', [fn])).rows[0].total, '0', 'Sem função audit');
        eq((await blocker.query('SELECT count(*) AS total FROM pg_trigger WHERE tgname = $1', [trigger])).rows[0].total, '0', 'Sem trigger audit');
      });
    }
    await cleanup('pagamentos', () => prisma.pagamento.deleteMany({ where: { pedidoId: { in: pedidos } } }));
    await cleanup('movimentações', () => prisma.movimentacaoEstoque.deleteMany({ where: { pedidoId: { in: pedidos } } }));
    await cleanup('históricos', () => prisma.historicoStatusPedido.deleteMany({ where: { pedidoId: { in: pedidos } } }));
    await cleanup('reservas', () => prisma.reservaEstoque.deleteMany({ where: { pedidoId: { in: pedidos } } }));
    await cleanup('pedidos', () => prisma.pedido.deleteMany({ where: { id: { in: pedidos } } }));
    await cleanup('estoque', () => prisma.estoque.deleteMany({ where: { produtoId } }));
    await cleanup('produto', () => prisma.produto.deleteMany({ where: { id: produtoId } }));
    await cleanup('categoria', () => prisma.categoria.deleteMany({ where: { id: categoriaId } }));
    await cleanup('usuarios', () => prisma.usuario.deleteMany({ where: { id: { in: usuarios } } }));
    await cleanup('resíduos fixtures', async () => {
      eq(await prisma.pagamento.count({ where: { pedidoId: { in: pedidos } } }), 0, 'Sem pagamentos residuais');
      eq(await prisma.reservaEstoque.count({ where: { pedidoId: { in: pedidos } } }), 0, 'Sem reservas residuais');
      eq(await prisma.movimentacaoEstoque.count({ where: { pedidoId: { in: pedidos } } }), 0, 'Sem movimentações residuais');
      eq(await prisma.historicoStatusPedido.count({ where: { pedidoId: { in: pedidos } } }), 0, 'Sem históricos residuais');
      eq(await prisma.pedido.count({ where: { id: { in: pedidos } } }), 0, 'Sem pedidos residuais');
      eq(await prisma.estoque.count({ where: { produtoId } }), 0, 'Sem estoque residual');
      eq(await prisma.produto.count({ where: { id: produtoId } }), 0, 'Sem produto residual');
      eq(await prisma.categoria.count({ where: { id: categoriaId } }), 0, 'Sem categoria residual');
      eq(await prisma.usuario.count({ where: { id: { in: usuarios } } }), 0, 'Sem usuário residual');
    });
    if (conectado) await cleanup('fechar blocker', () => blocker.end());
    await cleanup('fechar prisma', () => prisma.$disconnect());
  }
  if (originalError || cleanupErrors.length) throw new AggregateError(
    [...(originalError ? [originalError] : []), ...cleanupErrors], 'D56 falhou');
  process.stdout.write(`D56 PostgreSQL PASS: ${checks} verificações, locks reais, fixtures e instrumentação removidas.\n`);
}

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
