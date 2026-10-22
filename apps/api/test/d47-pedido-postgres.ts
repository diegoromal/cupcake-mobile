import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';
import { ModalidadeRecebimento, PerfilUsuario, StatusPedido } from '../src/generated/prisma/enums';

function dedicatedDatabaseUrl(): string {
  const value = process.env.D47_TEST_DATABASE_URL;
  if (!value) throw new Error('Defina D47_TEST_DATABASE_URL.');
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      (url.port && url.port !== '5432') || url.pathname !== '/cupcake_d47' || url.hash ||
      [...url.searchParams].some(([key, content]) => key !== 'schema' || content !== 'public')) {
    throw new Error('D47 exige PostgreSQL local dedicado cupcake_d47, schema public.');
  }
  return value;
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: dedicatedDatabaseUrl() }) });
  const marker = randomUUID();
  const userId = randomUUID();
  const categoryId = randomUUID();
  const productIds = [randomUUID(), randomUUID()];
  const personalizationId = randomUUID();
  const addressId = randomUUID();
  const orderId = randomUUID();
  const secondOrderId = randomUUID();
  const itemIds = [randomUUID(), randomUUID(), randomUUID()];
  const snapshotId = randomUUID();
  let checks = 0;
  let groupStart = 0;
  const groups: string[] = [];
  try {
    const [database] = await prisma.$queryRaw<Array<{ name: string; schema: string }>>`
      SELECT current_database() AS name, current_schema() AS schema`;
    assert.deepEqual(database, { name: 'cupcake_d47', schema: 'public' }); checks++;
    const expectedMigrations = readdirSync(resolve(__dirname, '../prisma/migrations'))
      .filter((name) => /^\d+_/.test(name));
    const migrations = await prisma.$queryRaw<Array<{
      migration_name: string; finished_at: Date | null; rolled_back_at: Date | null;
    }>>`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`;
    for (const name of expectedMigrations) {
      assert(migrations.some((row) => row.migration_name === name &&
        row.finished_at !== null && row.rolled_back_at === null), `Migration pendente: ${name}`);
      checks++;
    }
    const moneyColumns = await prisma.$queryRaw<Array<{
      table_name: string; column_name: string; numeric_precision: number; numeric_scale: number;
    }>>`
      SELECT table_name, column_name, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_schema = 'public' AND
        ((table_name = 'Pedido' AND column_name IN ('valorItens', 'freteAplicado', 'total')) OR
         (table_name = 'ItemPedido' AND column_name IN ('precoAplicado', 'subtotalAplicado')))`;
    assert.equal(moneyColumns.length, 5);
    assert(moneyColumns.every((column) => column.numeric_precision === 12 && column.numeric_scale === 2));
    checks++;
    const constraints = await prisma.$queryRaw<Array<{ name: string; type: string }>>`
      SELECT conname AS name, contype::text AS type
      FROM pg_constraint
      WHERE conrelid IN ('"Pedido"'::regclass, '"ItemPedido"'::regclass,
        '"EnderecoEntregaSnapshot"'::regclass,
        '"ItemPedidoPersonalizacaoSnapshot"'::regclass)`;
    for (const [name, type] of [
      ['Pedido_pkey', 'p'],
      ['Pedido_clienteUsuarioId_fkey', 'f'], ['Pedido_entregadorUsuarioId_fkey', 'f'],
      ['Pedido_valores_nonnegative', 'c'], ['Pedido_total_consistente', 'c'],
      ['Pedido_retirada_sem_frete', 'c'], ['ItemPedido_pkey', 'p'],
      ['ItemPedido_pedidoId_fkey', 'f'], ['ItemPedido_produtoId_fkey', 'f'],
      ['ItemPedido_quantidade_positive', 'c'], ['ItemPedido_valores_nonnegative', 'c'],
      ['EnderecoEntregaSnapshot_pkey', 'p'],
      ['EnderecoEntregaSnapshot_pedidoId_fkey', 'f'],
      ['ItemPedidoPersonalizacaoSnapshot_pkey', 'p'],
      ['ItemPedidoPersonalizacaoSnapshot_itemPedidoId_fkey', 'f'],
    ]) {
      assert(constraints.some((constraint) => constraint.name === name && constraint.type === type),
        `Restrição ausente: ${name}`);
      checks++;
    }
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND
        tablename IN ('Pedido', 'ItemPedido', 'EnderecoEntregaSnapshot',
          'ItemPedidoPersonalizacaoSnapshot')`;
    for (const name of [
      'Pedido_identificadorNegocio_key', 'Pedido_clienteUsuarioId_data_idx',
      'Pedido_entregadorUsuarioId_idx', 'Pedido_statusAtual_data_idx',
      'EnderecoEntregaSnapshot_pedidoId_key', 'ItemPedido_pedidoId_idx',
      'ItemPedido_produtoId_idx', 'ItemPedidoPersonalizacaoSnapshot_itemPedidoId_idx',
    ]) {
      assert(indexes.some((index) => index.indexname === name), `Índice ausente: ${name}`);
      checks++;
    }
    groups.push(`estrutura e migrations: ${checks - groupStart}`); groupStart = checks;

    await prisma.usuario.create({ data: {
      id: userId, nome: 'D47 cliente', email: `d47-${marker}@example.test`,
      telefone: '00000000000', credencialSenha: 'fixture', perfil: PerfilUsuario.CLIENTE,
    } });
    await prisma.categoria.create({ data: { id: categoryId, nome: `D47 ${marker}` } });
    await prisma.produto.createMany({ data: [
      { id: productIds[0], categoriaId: categoryId, nome: 'D47 A', precoAtual: '12.34' },
      { id: productIds[1], categoriaId: categoryId, nome: 'D47 B', precoAtual: '1.11' },
    ] });
    await prisma.personalizacao.create({ data: {
      id: personalizationId, nome: 'D47 cobertura original', ajusteValor: '0.10',
    } });
    await prisma.endereco.create({ data: {
      id: addressId, usuarioId: userId, rua: 'Rua original', numero: '7',
      bairro: 'Centro', cidade: 'Curitiba', cep: '80000000', complemento: 'Casa', referencia: 'Praça',
    } });
    await prisma.pedido.create({ data: {
      id: orderId, identificadorNegocio: `D47-${marker}`, clienteUsuarioId: userId,
      modalidade: ModalidadeRecebimento.ENTREGA, valorItens: '25.79',
      freteAplicado: '5.21', total: '31.00',
      enderecoEntregaSnapshot: { create: {
        rua: 'Rua original', numero: '7', bairro: 'Centro', cidade: 'Curitiba',
        cep: '80000000', complemento: 'Casa', referencia: 'Praça',
      } },
      itens: { create: [
        { id: itemIds[0], produtoId: productIds[0], quantidade: 2,
          precoAplicado: '12.34', subtotalAplicado: '24.68',
          personalizacoes: { create: [{ id: snapshotId,
            identificacaoPersonalizacaoAplicada: personalizationId,
            nomeAplicado: 'D47 cobertura original', ajusteValorAplicado: '0.10',
          }] },
        },
        { id: itemIds[1], produtoId: productIds[1], quantidade: 1,
          precoAplicado: '1.11', subtotalAplicado: '1.11' },
      ] },
    } });
    const order = await prisma.pedido.findUniqueOrThrow({ where: { id: orderId }, include: {
      itens: { include: { personalizacoes: true } }, enderecoEntregaSnapshot: true,
    } });
    assert.equal(order.statusAtual, StatusPedido.PENDENTE_PAGAMENTO); checks++;
    assert.equal(order.clienteUsuarioId, userId); checks++;
    assert.equal(order.itens.length, 2); checks++;
    assert(order.data instanceof Date && order.confirmacaoPagamento === null); checks++;
    assert.deepEqual([order.valorItens, order.freteAplicado, order.total]
      .map((amount) => amount.toFixed(2)), ['25.79', '5.21', '31.00']); checks++;
    assert.deepEqual(order.itens.map((item) => item.subtotalAplicado.toFixed(2)).sort(),
      ['1.11', '24.68']); checks++;
    assert.deepEqual(order.itens.map((item) => item.precoAplicado.toFixed(2)).sort(),
      ['1.11', '12.34']); checks++;
    assert.equal(order.enderecoEntregaSnapshot?.rua, 'Rua original'); checks++;
    assert.equal(order.itens.find((item) => item.id === itemIds[0])?.personalizacoes[0]
      .ajusteValorAplicado?.toFixed(2), '0.10'); checks++;
    groups.push(`pedido de entrega e snapshots: ${checks - groupStart}`); groupStart = checks;

    await assert.rejects(prisma.pedido.create({ data: {
      id: secondOrderId, identificadorNegocio: order.identificadorNegocio,
      clienteUsuarioId: userId, modalidade: ModalidadeRecebimento.RETIRADA,
      valorItens: '1.00', freteAplicado: '0.00', total: '1.00',
    } }), (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'); checks++;
    assert.equal(await prisma.pedido.findUnique({ where: { id: secondOrderId } }), null); checks++;
    await prisma.pedido.create({ data: {
      id: secondOrderId, identificadorNegocio: `D47-retirada-${marker}`,
      clienteUsuarioId: userId, modalidade: ModalidadeRecebimento.RETIRADA,
      valorItens: '1.11', freteAplicado: '0.00', total: '1.11',
      itens: { create: [{ id: itemIds[2], produtoId: productIds[1],
        quantidade: 1, precoAplicado: '1.11', subtotalAplicado: '1.11' }] },
    } });
    const pickup = await prisma.pedido.findUniqueOrThrow({ where: { id: secondOrderId },
      include: { enderecoEntregaSnapshot: true, itens: true } });
    assert.equal(pickup.enderecoEntregaSnapshot, null);
    assert.equal(pickup.itens.length, 1);
    assert.equal(pickup.freteAplicado.toFixed(2), '0.00'); checks++;
    await assert.rejects(prisma.enderecoEntregaSnapshot.create({ data: {
      pedidoId: orderId, rua: 'Outra', numero: '1', bairro: 'Centro', cidade: 'Curitiba',
      cep: '80000000',
    } }), (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'); checks++;
    await assert.rejects(prisma.pedido.delete({ where: { id: orderId } })); checks++;
    await assert.rejects(prisma.produto.delete({ where: { id: productIds[0] } })); checks++;
    await assert.rejects(prisma.itemPedido.create({ data: {
      pedidoId: randomUUID(), produtoId: productIds[0], quantidade: 1,
      precoAplicado: '1.00', subtotalAplicado: '1.00',
    } })); checks++;
    await assert.rejects(prisma.itemPedido.create({ data: {
      pedidoId: orderId, produtoId: randomUUID(), quantidade: 1,
      precoAplicado: '1.00', subtotalAplicado: '1.00',
    } })); checks++;
    await assert.rejects(prisma.pedido.create({ data: {
      clienteUsuarioId: randomUUID(), identificadorNegocio: `D47-orfa-${marker}`,
      modalidade: ModalidadeRecebimento.RETIRADA, valorItens: '1.00',
      freteAplicado: '0.00', total: '1.00',
    } })); checks++;
    await assert.rejects(prisma.itemPedido.create({ data: {
      pedidoId: orderId, produtoId: productIds[0], quantidade: 0,
      precoAplicado: '1.00', subtotalAplicado: '1.00',
    } })); checks++;
    await assert.rejects(prisma.itemPedido.create({ data: {
      pedidoId: orderId, produtoId: productIds[0], quantidade: 1,
      precoAplicado: '-1.00', subtotalAplicado: '1.00',
    } })); checks++;
    await assert.rejects(prisma.pedido.update({ where: { id: orderId },
      data: { valorItens: '-1.00', total: '4.21' } })); checks++;
    await assert.rejects(prisma.pedido.update({ where: { id: orderId },
      data: { total: '30.99' } })); checks++;
    await assert.rejects(prisma.pedido.update({ where: { id: secondOrderId },
      data: { freteAplicado: '1.00', total: '2.11' } })); checks++;
    await assert.rejects(prisma.itemPedidoPersonalizacaoSnapshot.create({ data: {
      itemPedidoId: randomUUID(), identificacaoPersonalizacaoAplicada: randomUUID(),
      nomeAplicado: 'Órfã',
    } })); checks++;
    groups.push(`unicidade, FKs e CHECKs: ${checks - groupStart}`); groupStart = checks;

    await prisma.endereco.update({ where: { id: addressId }, data: { rua: 'Rua alterada' } });
    await prisma.personalizacao.update({ where: { id: personalizationId }, data: {
      nome: 'Outra cobertura', ajusteValor: '9.99',
    } });
    await prisma.produto.update({ where: { id: productIds[0] }, data: { precoAtual: '99.99' } });
    await prisma.endereco.delete({ where: { id: addressId } });
    await prisma.personalizacao.delete({ where: { id: personalizationId } });
    const historical = await prisma.pedido.findUniqueOrThrow({ where: { id: orderId }, include: {
      enderecoEntregaSnapshot: true,
      itens: { include: { personalizacoes: true } },
    } });
    assert.equal(historical.enderecoEntregaSnapshot?.rua, 'Rua original'); checks++;
    assert.equal(historical.itens.find((item) => item.id === itemIds[0])?.personalizacoes[0]
      .nomeAplicado, 'D47 cobertura original'); checks++;
    assert.equal(historical.itens.find((item) => item.id === itemIds[0])?.personalizacoes[0]
      .ajusteValorAplicado?.toFixed(2), '0.10'); checks++;
    assert.equal(historical.itens.find((item) => item.id === itemIds[0])
      ?.precoAplicado.toFixed(2), '12.34'); checks++;
    assert.equal(await prisma.reservaEstoque.count({ where: { pedidoId: orderId } }), 0); checks++;
    assert.equal(await prisma.pagamento.count({ where: { pedidoId: orderId } }), 0); checks++;
    groups.push(`imutabilidade histórica e ausência de efeitos posteriores: ${checks - groupStart}`);
    console.log(`D47 PostgreSQL: ${checks} verificações aprovadas (${groups.join('; ')}).`);
  } finally {
    await prisma.itemPedidoPersonalizacaoSnapshot.deleteMany({ where: { id: snapshotId } });
    await prisma.itemPedido.deleteMany({ where: { id: { in: itemIds } } });
    await prisma.enderecoEntregaSnapshot.deleteMany({ where: { pedidoId: orderId } });
    await prisma.pedido.deleteMany({ where: { id: { in: [orderId, secondOrderId] } } });
    await prisma.endereco.deleteMany({ where: { id: addressId } });
    await prisma.personalizacao.deleteMany({ where: { id: personalizationId } });
    await prisma.produto.deleteMany({ where: { id: { in: productIds } } });
    await prisma.categoria.deleteMany({ where: { id: categoryId } });
    await prisma.usuario.deleteMany({ where: { id: userId } });
    assert.equal(await prisma.pedido.count({ where: { id: { in: [orderId, secondOrderId] } } }), 0);
    assert.equal(await prisma.itemPedido.count({ where: { id: { in: itemIds } } }), 0);
    assert.equal(await prisma.enderecoEntregaSnapshot.count({ where: { pedidoId: orderId } }), 0);
    assert.equal(await prisma.itemPedidoPersonalizacaoSnapshot.count({ where: { id: snapshotId } }), 0);
    assert.equal(await prisma.produto.count({ where: { id: { in: productIds } } }), 0);
    assert.equal(await prisma.usuario.count({ where: { id: userId } }), 0);
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
