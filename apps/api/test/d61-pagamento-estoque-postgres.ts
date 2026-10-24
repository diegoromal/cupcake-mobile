import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import request from 'supertest';
import { PrismaClient } from '../src/generated/prisma/client';
import { PagamentosModule } from '../src/pagamentos/pagamentos.module';

const raw = process.env.D61_TEST_DATABASE_URL;
if (!raw) throw new Error('Defina D61_TEST_DATABASE_URL.');
const url = new URL(raw);
if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    (url.port && url.port !== '5432') || url.pathname !== '/cupcake_d61' || url.hash ||
    [...url.searchParams].some(([key, value]) => key !== 'schema' || value !== 'public')) {
  throw new Error('D61 exige PostgreSQL local dedicado cupcake_d61, schema public.');
}
const marker = `d61_${randomUUID().replaceAll('-', '')}`;
url.searchParams.set('application_name', marker);
process.env.DATABASE_URL = url.toString();
process.env.JWT_ACCESS_SECRET = `d61-access-${randomUUID()}`;
process.env.JWT_REFRESH_SECRET = `d61-refresh-${randomUUID()}`;

type Forma = 'pix' | 'cartao';
type Fixture = { pedidoId: string; produtos: string[] };

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  const pg = new Client({ connectionString: url.toString() });
  const usuarioId = randomUUID(), categoriaId = randomUUID();
  const pedidos: string[] = [], produtos: string[] = [];
  const sequencia = `${marker}_seq`, funcao = `${marker}_fn`, trigger = `${marker}_trigger`;
  let app: INestApplication | undefined, pgConnected = false, sequenceCreated = false;
  let functionCreated = false, triggerCreated = false, originalError: unknown, checks = 0;
  const cleanupErrors: unknown[] = [];
  const eq = (actual: unknown, expected: unknown, label: string) => {
    assert.deepEqual(actual, expected, label); checks++;
  };
  const snapshot = async ({ pedidoId, produtos: ids }: Fixture) => ({
    pedido: await prisma.pedido.findUniqueOrThrow({ where: { id: pedidoId } }),
    reservas: await prisma.reservaEstoque.findMany({ where: { pedidoId }, orderBy: { id: 'asc' } }),
    estoques: await prisma.estoque.findMany({ where: { produtoId: { in: ids } }, orderBy: { produtoId: 'asc' } }),
    movimentos: await prisma.movimentacaoEstoque.findMany({ where: { pedidoId }, orderBy: { id: 'asc' } }),
    historicos: await prisma.historicoStatusPedido.findMany({ where: { pedidoId }, orderBy: { id: 'asc' } }),
  });
  const tentativa = (aprovada = true) => randomUUID().slice(0, -1) + (aprovada ? '0' : '1');
  const fixture = async (): Promise<Fixture> => {
    const pedidoId = randomUUID(), ids = [randomUUID(), randomUUID()];
    pedidos.push(pedidoId); produtos.push(...ids);
    for (let i = 0; i < ids.length; i++) {
      await prisma.produto.create({ data: { id: ids[i], categoriaId, nome: `${marker}-${pedidoId}-${i}`,
        precoAtual: '12.34' } });
      await prisma.estoque.create({ data: { produtoId: ids[i], quantidadeFisica: 8 + i,
        quantidadeReservada: 3 } });
    }
    await prisma.pedido.create({ data: { id: pedidoId, identificadorNegocio: `${marker}-${pedidoId}`,
      clienteUsuarioId: usuarioId, modalidade: 'RETIRADA', valorItens: '12.34',
      freteAplicado: '0.00', total: '12.34' } });
    for (const [produtoId, quantidade] of [[ids[0], 2], [ids[0], 1], [ids[1], 3]] as const) {
      await prisma.reservaEstoque.create({ data: { pedidoId, produtoId, quantidade,
        estado: 'ATIVA', momentoExpiracaoValidade: new Date(Date.now() + 900_000) } });
    }
    return { pedidoId, produtos: ids };
  };
  const venda = async (alvo: Fixture) => {
    const estado = await snapshot(alvo);
    eq(estado.pedido.statusAtual, 'PAGO', 'Pedido pago');
    eq(estado.pedido.confirmacaoPagamento instanceof Date, true, 'Confirmação persistida');
    eq(estado.reservas.map((r) => r.estado),
      ['CONVERTIDA_EM_VENDA', 'CONVERTIDA_EM_VENDA', 'CONVERTIDA_EM_VENDA'], 'Três reservas convertidas');
    eq(estado.estoques.map((e) => [e.produtoId, e.quantidadeFisica, e.quantidadeReservada]),
      alvo.produtos.map((id, i) => [id, 5 + i, 0]).sort(([a], [b]) => String(a).localeCompare(String(b))),
      'Baixa física e reservada por produto');
    eq(estado.movimentos.map((m) => [m.produtoId, m.quantidade, m.motivoOrigem]).sort(),
      [[alvo.produtos[0], -2, 'VENDA_PEDIDO'], [alvo.produtos[0], -1, 'VENDA_PEDIDO'],
        [alvo.produtos[1], -3, 'VENDA_PEDIDO']].sort(), 'Uma movimentação por reserva');
    eq(estado.historicos.map((h) => h.statusRegistrado), ['PAGO'], 'Um histórico PAGO');
    eq(estado.estoques.every((e) => e.quantidadeFisica >= e.quantidadeReservada &&
      e.quantidadeReservada >= 0), true, 'Saldos não negativos e coerentes');
    return estado;
  };
  const removeInjection = async () => {
    if (triggerCreated) {
      await pg.query(`DROP TRIGGER "${trigger}" ON "HistoricoStatusPedido"`);
      triggerCreated = false;
    }
    if (functionCreated) {
      await pg.query(`DROP FUNCTION "${funcao}"()`);
      functionCreated = false;
    }
  };

  try {
    await pg.connect(); pgConnected = true;
    eq((await pg.query('SELECT current_database() AS db, current_schema() AS schema')).rows,
      [{ db: 'cupcake_d61', schema: 'public' }], 'Banco dedicado confirmado no servidor');
    const migrations = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    for (const migration of readdirSync(resolve(__dirname, '../prisma/migrations')).filter((v) => /^\d+_/.test(v))) {
      eq(migrations.some((m) => m.migration_name === migration), true, `Migration ${migration}`);
    }
    await pg.query(`CREATE SEQUENCE "${sequencia}"`); sequenceCreated = true;
    await prisma.usuario.create({ data: { id: usuarioId, nome: marker, email: `${marker}@example.test`,
      telefone: '00000000000', credencialSenha: 'fixture', perfil: 'CLIENTE' } });
    await prisma.categoria.create({ data: { id: categoriaId, nome: marker } });
    const module = await Test.createTestingModule({ imports: [PagamentosModule] }).compile();
    app = module.createNestApplication(); app.useLogger(false); await app.init();
    const jwt = new JwtService();
    const auth = `Bearer ${await jwt.signAsync({ sub: usuarioId, perfil: 'CLIENTE', type: 'access' }, {
      secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m',
    })}`;
    const post = (alvo: Fixture, forma: Forma, id: string) => request(app!.getHttpServer())
      .post(`/pedidos/${alvo.pedidoId}/pagamentos/${forma}`).set('Authorization', auth)
      .send({ tentativaId: id });
    const get = (alvo: Fixture, forma: Forma, id: string) => request(app!.getHttpServer())
      .get(`/pedidos/${alvo.pedidoId}/pagamentos/${forma}/${id}`).set('Authorization', auth);

    for (const forma of ['pix', 'cartao'] as const) {
      const aprovado = await fixture(), aprovadoId = tentativa();
      const resposta = await post(aprovado, forma, aprovadoId).expect(201);
      eq(resposta.body.resultado, 'APROVADO', `${forma}: aprovação`);
      eq(resposta.body.valorAplicavel, '12.34', `${forma}: valor autoritativo`);
      const aposVenda = await venda(aprovado);
      eq((await post(aprovado, forma, aprovadoId).expect(200)).body, resposta.body,
        `${forma}: retry conserva pagamento`);
      await post(aprovado, forma, tentativa()).expect(409);
      eq(await snapshot(aprovado), aposVenda, `${forma}: repetições não duplicam conversão`);
      eq(await prisma.pagamento.count({ where: { pedidoId: aprovado.pedidoId } }), 1,
        `${forma}: uma tentativa`);

      const recusado = await fixture(), recusadoId = tentativa(false);
      const antesRecusa = await snapshot(recusado);
      const recusa = await post(recusado, forma, recusadoId).expect(201);
      eq(recusa.body.resultado, 'RECUSADO', `${forma}: recusa`);
      eq(await snapshot(recusado), antesRecusa, `${forma}: recusa sem baixa`);
      eq((await post(recusado, forma, recusadoId).expect(200)).body, recusa.body,
        `${forma}: retry da recusa imutável`);
      eq(await snapshot(recusado), antesRecusa, `${forma}: retry da recusa sem baixa`);
      const outraForma: Forma = forma === 'pix' ? 'cartao' : 'pix';
      eq((await post(recusado, outraForma, tentativa()).expect(201)).body.resultado,
        'APROVADO', `${forma}: nova tentativa por ${outraForma}`);
      await venda(recusado);
      eq(await prisma.pagamento.count({ where: { pedidoId: recusado.pedidoId } }), 2,
        `${forma}: duas tentativas distintas`);

      const reservaVencida = await fixture(), vencidaId = tentativa();
      await prisma.reservaEstoque.updateMany({ where: { pedidoId: reservaVencida.pedidoId,
        produtoId: reservaVencida.produtos[1] },
      data: { momentoExpiracaoValidade: new Date(Date.now() - 60_000) } });
      const antesVencida = await snapshot(reservaVencida);
      await post(reservaVencida, forma, vencidaId).expect(409);
      eq((await get(reservaVencida, forma, vencidaId).expect(200)).body.resultado,
        'PENDENTE', `${forma}: reserva vencida não aprova`);
      eq(await snapshot(reservaVencida), antesVencida, `${forma}: reserva vencida não converte nada`);
      await post(reservaVencida, forma, vencidaId).expect(409);
      eq(await prisma.pagamento.count({ where: { pedidoId: reservaVencida.pedidoId } }), 1,
        `${forma}: retry vencido não duplica pagamento`);
      eq(await snapshot(reservaVencida), antesVencida, `${forma}: retry vencido não baixa`);

      const rollback = await fixture(), rollbackId = tentativa();
      const antesRollback = await snapshot(rollback);
      await pg.query(`CREATE FUNCTION "${funcao}"() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW."pedidoId" = '${rollback.pedidoId}'::uuid THEN
          PERFORM nextval('"${sequencia}"');
          RAISE EXCEPTION 'D61 falha injetada após conversão';
        END IF; RETURN NEW; END $$`); functionCreated = true;
      await pg.query(`CREATE TRIGGER "${trigger}" BEFORE INSERT ON "HistoricoStatusPedido"
        FOR EACH ROW EXECUTE FUNCTION "${funcao}"()`); triggerCreated = true;
      await post(rollback, forma, rollbackId).expect(500);
      eq((await pg.query(`SELECT last_value, is_called FROM "${sequencia}"`)).rows[0],
        { last_value: '1', is_called: true },
        `${forma}: trigger atingiu o histórico após conversão`);
      eq((await get(rollback, forma, rollbackId).expect(200)).body.resultado,
        'PENDENTE', `${forma}: pagamento revertido`);
      eq(await snapshot(rollback), antesRollback,
        `${forma}: pedido, reservas, saldos, movimentos e histórico revertidos`);
      await removeInjection();
      eq((await post(rollback, forma, rollbackId).expect(200)).body.resultado,
        'APROVADO', `${forma}: retry da tentativa recupera venda`);
      const aposRetry = await venda(rollback);
      eq((await post(rollback, forma, rollbackId).expect(200)).body.resultado,
        'APROVADO', `${forma}: novo retry idempotente`);
      eq(await snapshot(rollback), aposRetry, `${forma}: retry não duplica efeitos`);
      eq(await prisma.pagamento.count({ where: { pedidoId: rollback.pedidoId } }), 1,
        `${forma}: uma tentativa após rollback`);
      await pg.query(`ALTER SEQUENCE "${sequencia}" RESTART WITH 1`);
    }

    for (const status of ['PENDENTE_PAGAMENTO', 'EXPIRADO'] as const) {
      const expirado = await fixture();
      await prisma.pedido.update({ where: { id: expirado.pedidoId }, data: {
        ...(status === 'PENDENTE_PAGAMENTO' ? { data: new Date(Date.now() - 16 * 60_000) } : {}),
        statusAtual: status,
      } });
      const antes = await snapshot(expirado);
      await post(expirado, 'cartao', tentativa()).expect(409);
      eq(await snapshot(expirado), antes, `${status}: pedido vencido não converte`);
      eq(await prisma.pagamento.count({ where: { pedidoId: expirado.pedidoId } }), 0,
        `${status}: pedido inelegível não cria pagamento`);
    }
  } catch (error) {
    originalError = error;
  } finally {
    const cleanup = async (label: string, action: () => Promise<unknown>) => {
      try { await action(); } catch (error) { cleanupErrors.push(new Error(label, { cause: error })); }
    };
    if (app) await cleanup('fechar app', () => app!.close());
    if (pgConnected) await cleanup('remover injeção', removeInjection);
    if (sequenceCreated) await cleanup('remover sequência', () => pg.query(`DROP SEQUENCE "${sequencia}"`));
    await cleanup('pagamentos', () => prisma.pagamento.deleteMany({ where: { pedidoId: { in: pedidos } } }));
    await cleanup('movimentações', () => prisma.movimentacaoEstoque.deleteMany({ where: { pedidoId: { in: pedidos } } }));
    await cleanup('históricos', () => prisma.historicoStatusPedido.deleteMany({ where: { pedidoId: { in: pedidos } } }));
    await cleanup('reservas', () => prisma.reservaEstoque.deleteMany({ where: { pedidoId: { in: pedidos } } }));
    await cleanup('pedidos', () => prisma.pedido.deleteMany({ where: { id: { in: pedidos } } }));
    await cleanup('estoques', () => prisma.estoque.deleteMany({ where: { produtoId: { in: produtos } } }));
    await cleanup('produtos', () => prisma.produto.deleteMany({ where: { id: { in: produtos } } }));
    await cleanup('categoria', () => prisma.categoria.deleteMany({ where: { id: categoriaId } }));
    await cleanup('usuário', () => prisma.usuario.deleteMany({ where: { id: usuarioId } }));
    await cleanup('resíduos fixtures', async () => {
      for (const [label, count] of [
        ['pagamentos', prisma.pagamento.count({ where: { pedidoId: { in: pedidos } } })],
        ['movimentações', prisma.movimentacaoEstoque.count({ where: { pedidoId: { in: pedidos } } })],
        ['históricos', prisma.historicoStatusPedido.count({ where: { pedidoId: { in: pedidos } } })],
        ['reservas', prisma.reservaEstoque.count({ where: { pedidoId: { in: pedidos } } })],
        ['pedidos', prisma.pedido.count({ where: { id: { in: pedidos } } })],
        ['estoques', prisma.estoque.count({ where: { produtoId: { in: produtos } } })],
        ['produtos', prisma.produto.count({ where: { id: { in: produtos } } })],
        ['categoria', prisma.categoria.count({ where: { id: categoriaId } })],
        ['usuário', prisma.usuario.count({ where: { id: usuarioId } })],
      ] as const) eq(await count, 0, `Sem resíduo ${label}`);
    });
    if (pgConnected) await cleanup('resíduos instrumentação', async () => {
      const rows = (await pg.query(`SELECT count(*) AS total FROM pg_class WHERE relname = $1
        UNION ALL SELECT count(*) FROM pg_proc WHERE proname = $2
        UNION ALL SELECT count(*) FROM pg_trigger WHERE tgname = $3`,
      [sequencia, funcao, trigger])).rows;
      eq(rows.map((row) => row.total), ['0', '0', '0'], 'Sem instrumentação residual');
    });
    if (pgConnected) await cleanup('fechar pg', () => pg.end());
    await cleanup('fechar prisma', () => prisma.$disconnect());
  }
  if (originalError || cleanupErrors.length) throw new AggregateError(
    [...(originalError ? [originalError] : []), ...cleanupErrors], 'D61 falhou');
  process.stdout.write(`D61 PostgreSQL PASS: ${checks} verificações; banco dedicado, rollback e cleanup confirmados.\n`);
}

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
