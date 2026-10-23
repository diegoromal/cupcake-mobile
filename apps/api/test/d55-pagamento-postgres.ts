import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';

function isPaymentForeignKeyViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2003' && error.message.includes('`Pagamento_pedidoId_fkey`');
}

function isPaymentNonnegativeViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2039' && error.message.includes('Code: `23514`') &&
    error.message.includes('constraint "Pagamento_valor_nonnegative"');
}

function dedicatedDatabaseUrl(): string {
  const value = process.env.D55_TEST_DATABASE_URL;
  if (!value) throw new Error('Defina D55_TEST_DATABASE_URL.');
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      (url.port && url.port !== '5432') || url.pathname !== '/cupcake_d55' || url.hash ||
      [...url.searchParams].some(([key, content]) => key !== 'schema' || content !== 'public')) {
    throw new Error('D55 exige PostgreSQL local dedicado cupcake_d55, schema public.');
  }
  return value;
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({
    connectionString: dedicatedDatabaseUrl(),
  }) });
  const marker = randomUUID();
  const userId = randomUUID();
  const orderId = randomUUID();
  const paymentIds = [randomUUID(), randomUUID()];
  let checks = 0;
  let originalError: unknown;
  const cleanupErrors: unknown[] = [];
  const equal = (actual: unknown, expected: unknown) => { assert.deepEqual(actual, expected); checks++; };

  try {
    const [database] = await prisma.$queryRaw<Array<{ name: string; schema: string }>>`
      SELECT current_database() AS name, current_schema() AS schema`;
    equal(database, { name: 'cupcake_d55', schema: 'public' });

    const migrations = await prisma.$queryRaw<Array<{
      migration_name: string; finished_at: Date | null; rolled_back_at: Date | null;
    }>>`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`;
    for (const name of readdirSync(resolve(__dirname, '../prisma/migrations'))
      .filter((entry) => /^\d+_/.test(entry))) {
      assert(migrations.some((row) => row.migration_name === name &&
        row.finished_at !== null && row.rolled_back_at === null), `Migration pendente: ${name}`);
      checks++;
    }

    const columns = await prisma.$queryRaw<Array<{
      column_name: string; is_nullable: string; data_type: string;
      numeric_precision: number | null; numeric_scale: number | null;
    }>>`
      SELECT column_name, is_nullable, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Pagamento'`;
    equal(columns.length, 6);
    for (const column of ['id', 'pedidoId', 'forma', 'resultado', 'dataTransacao', 'valorAplicavel']) {
      equal(columns.find((row) => row.column_name === column)?.is_nullable, 'NO');
    }
    equal(columns.find((row) => row.column_name === 'id')?.data_type, 'uuid');
    equal(columns.find((row) => row.column_name === 'pedidoId')?.data_type, 'uuid');
    equal(columns.find((row) => row.column_name === 'dataTransacao')?.data_type,
      'timestamp with time zone');
    equal(columns.find((row) => row.column_name === 'valorAplicavel')?.data_type, 'numeric');
    equal(columns.find((row) => row.column_name === 'valorAplicavel')?.numeric_precision, 12);
    equal(columns.find((row) => row.column_name === 'valorAplicavel')?.numeric_scale, 2);

    const enums = await prisma.$queryRaw<Array<{ type: string; label: string }>>`
      SELECT t.typname AS type, e.enumlabel AS label FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname IN ('FormaPagamento', 'ResultadoPagamento')
      ORDER BY t.typname, e.enumsortorder`;
    equal(enums, [
      { type: 'FormaPagamento', label: 'PIX' },
      { type: 'FormaPagamento', label: 'CARTAO' },
      { type: 'ResultadoPagamento', label: 'APROVADO' },
      { type: 'ResultadoPagamento', label: 'RECUSADO' },
    ]);
    const constraints = await prisma.$queryRaw<Array<{ name: string; definition: string }>>`
      SELECT conname AS name, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE conrelid = '"Pagamento"'::regclass`;
    for (const name of ['Pagamento_pkey', 'Pagamento_pedidoId_fkey',
      'Pagamento_valor_nonnegative']) {
      assert(constraints.some((row) => row.name === name), `Restrição ausente: ${name}`);
      checks++;
    }
    assert(constraints.find((row) => row.name === 'Pagamento_pedidoId_fkey')
      ?.definition.includes('ON DELETE RESTRICT'));
    checks++;
    const indexes = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'Pagamento'`;
    assert(indexes.some((row) => row.indexname === 'Pagamento_pedidoId_dataTransacao_idx' &&
      row.indexdef.includes('("pedidoId", "dataTransacao")')));
    checks++;

    await prisma.usuario.create({ data: {
      id: userId, nome: 'D55 cliente', email: `d55-${marker}@example.test`,
      telefone: '00000000000', credencialSenha: 'fixture', perfil: 'CLIENTE',
    } });
    await prisma.pedido.create({ data: {
      id: orderId, identificadorNegocio: `D55-${marker}`,
      clienteUsuarioId: userId, modalidade: 'RETIRADA',
      valorItens: '12.34', freteAplicado: '0.00', total: '12.34',
    } });
    equal(await prisma.pagamento.count({ where: { pedidoId: orderId } }), 0);

    const firstDate = new Date('2026-10-23T12:00:00.000Z');
    const secondDate = new Date('2026-10-23T12:01:00.000Z');
    await prisma.pagamento.createMany({ data: [
      { id: paymentIds[0], pedidoId: orderId, forma: 'PIX', resultado: 'RECUSADO',
        dataTransacao: firstDate, valorAplicavel: '12.34' },
      { id: paymentIds[1], pedidoId: orderId, forma: 'CARTAO', resultado: 'APROVADO',
        dataTransacao: secondDate, valorAplicavel: '12.34' },
    ] });
    const order = await prisma.pedido.findUniqueOrThrow({ where: { id: orderId },
      include: { pagamentos: { orderBy: { dataTransacao: 'asc' } } } });
    equal(order.pagamentos.map((row) => [row.id, row.pedidoId, row.forma, row.resultado,
      row.dataTransacao.toISOString(), row.valorAplicavel.toFixed(2)]), [
      [paymentIds[0], orderId, 'PIX', 'RECUSADO', firstDate.toISOString(), '12.34'],
      [paymentIds[1], orderId, 'CARTAO', 'APROVADO', secondDate.toISOString(), '12.34'],
    ]);
    equal(order.statusAtual, 'PENDENTE_PAGAMENTO');
    equal(order.confirmacaoPagamento, null);

    await assert.rejects(prisma.pagamento.create({ data: {
      pedidoId: randomUUID(), forma: 'PIX', resultado: 'RECUSADO',
      dataTransacao: firstDate, valorAplicavel: '12.34',
    } }), isPaymentForeignKeyViolation); checks++;
    await assert.rejects(prisma.pagamento.create({ data: {
      pedidoId: orderId, forma: 'PIX', resultado: 'RECUSADO',
      dataTransacao: firstDate, valorAplicavel: '-0.01',
    } }), isPaymentNonnegativeViolation); checks++;
    equal(await prisma.pagamento.count({ where: { pedidoId: orderId } }), 2);
    await assert.rejects(prisma.pedido.delete({ where: { id: orderId } }),
      isPaymentForeignKeyViolation); checks++;
  } catch (error) {
    originalError = error;
  } finally {
    const cleanup = async (label: string, action: () => Promise<unknown>) => {
      try { await action(); } catch (error) { cleanupErrors.push(new Error(label, { cause: error })); }
    };
    await cleanup('pagamentos', () => prisma.pagamento.deleteMany({ where: { id: { in: paymentIds } } }));
    await cleanup('pedido', () => prisma.pedido.deleteMany({ where: { id: orderId } }));
    await cleanup('usuário', () => prisma.usuario.deleteMany({ where: { id: userId } }));
    await cleanup('resíduos', async () => {
      equal(await prisma.pagamento.count({ where: { id: { in: paymentIds } } }), 0);
      equal(await prisma.pedido.count({ where: { id: orderId } }), 0);
      equal(await prisma.usuario.count({ where: { id: userId } }), 0);
    });
    await cleanup('desconexão', () => prisma.$disconnect());
  }
  if (originalError || cleanupErrors.length) {
    throw new AggregateError([...(originalError ? [originalError] : []), ...cleanupErrors],
      'Falha D55 PostgreSQL');
  }
  process.stdout.write(`PASS D55 PostgreSQL (${checks} verificações; fixtures limpas)\n`);
}

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
