import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { ExpiracaoPedidosService } from '../src/pedidos/expiracao-pedidos.service';

async function main() {
  const url = process.env.D51_TEST_DATABASE_URL;
  if (!url || new URL(url).hostname !== 'localhost' || new URL(url).pathname !== '/cupcake_d51') {
    throw new Error('D51 exige D51_TEST_DATABASE_URL para localhost/cupcake_d51.');
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const service = new ExpiracaoPedidosService(prisma as never);
  const user = randomUUID(), category = randomUUID(), product = randomUUID();
  const ids: string[] = [];
  const [{ now }] = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
  let checks = 0;
  try {
    const [database] = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    assert.equal(database.name, 'cupcake_d51'); checks++;
    const migrations = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
      SELECT migration_name, finished_at FROM "_prisma_migrations"`;
    for (const name of readdirSync(resolve(__dirname, '../prisma/migrations')).filter((v) => /^\d+_/.test(v))) {
      assert(migrations.some((row) => row.migration_name === name && row.finished_at)); checks++;
    }
    await prisma.usuario.create({ data: { id: user, nome: 'D51', email: `d51-${user}@example.test`,
      telefone: '00000000000', credencialSenha: 'fixture', perfil: 'CLIENTE' } });
    await prisma.categoria.create({ data: { id: category, nome: `D51 ${category}` } });
    await prisma.produto.create({ data: { id: product, categoriaId: category, nome: 'D51 produto', precoAtual: '1.00' } });
    await prisma.estoque.create({ data: { produtoId: product, quantidadeFisica: 100, quantidadeReservada: 5 } });
    async function order(minutesAgo: number, status: 'PENDENTE_PAGAMENTO' | 'PAGO' | 'EM_PREPARO', modalidade: 'RETIRADA' | 'ENTREGA') {
      const id = randomUUID(); ids.push(id);
      const data = new Date(now.getTime() - minutesAgo * 60_000);
      await prisma.pedido.create({ data: { id, identificadorNegocio: `D51-${id}`, clienteUsuarioId: user,
        data, statusAtual: status, modalidade, valorItens: '1.00', freteAplicado: '0.00', total: '1.00' } });
      await prisma.reservaEstoque.create({ data: { pedidoId: id, produtoId: product, quantidade: 1,
        estado: 'ATIVA', momentoExpiracaoValidade: new Date(data.getTime() + 900_000) } });
      return id;
    }
    const valid = await order(14, 'PENDENTE_PAGAMENTO', 'RETIRADA');
    const boundary = await order(15, 'PENDENTE_PAGAMENTO', 'ENTREGA');
    const expired = await order(16, 'PENDENTE_PAGAMENTO', 'RETIRADA');
    const paid = await order(30, 'PAGO', 'ENTREGA');
    const later = await order(30, 'EM_PREPARO', 'RETIRADA');
    const secondRunner = new ExpiracaoPedidosService(prisma as never);
    const result = await Promise.all([service.executar(), secondRunner.executar()]);
    assert.equal(result.reduce((a, b) => a + b), 2); checks++;
    assert.equal(await service.executar(), 0); checks++;
    const statuses = await prisma.pedido.findMany({ where: { id: { in: ids } }, select: { id: true, statusAtual: true } });
    const status = (id: string) => statuses.find((row) => row.id === id)?.statusAtual;
    assert.equal(status(valid), 'PENDENTE_PAGAMENTO'); checks++;
    assert.equal(status(boundary), 'EXPIRADO'); checks++;
    assert.equal(status(expired), 'EXPIRADO'); checks++;
    assert.equal(status(paid), 'PAGO'); checks++;
    assert.equal(status(later), 'EM_PREPARO'); checks++;
    assert.equal(await prisma.reservaEstoque.count({ where: { pedidoId: { in: ids }, estado: 'ATIVA' } }), 5); checks++;
    assert.equal((await prisma.estoque.findUniqueOrThrow({ where: { produtoId: product } })).quantidadeReservada, 5); checks++;
    assert.equal(await prisma.movimentacaoEstoque.count({ where: { produtoId: product } }), 0); checks++;
    const failureId = randomUUID();
    ids.push(failureId);
    await prisma.pedido.create({ data: { id: failureId, identificadorNegocio: `D51-${failureId}`,
      clienteUsuarioId: user, data: new Date(now.getTime() - 20 * 60_000),
      statusAtual: 'PENDENTE_PAGAMENTO', modalidade: 'RETIRADA',
      valorItens: '1.00', freteAplicado: '0.00', total: '1.00' } });
    const failing = new ExpiracaoPedidosService({ pedido: prisma.pedido, $queryRaw: prisma.$queryRaw.bind(prisma),
      $transaction: () => prisma.$transaction(async () => { throw new Error('falha injetada'); }),
    } as never);
    await assert.rejects(failing.executar(), /falha injetada/); checks++;
    assert.equal((await prisma.pedido.findUniqueOrThrow({ where: { id: failureId } })).statusAtual,
      'PENDENTE_PAGAMENTO'); checks++;
    assert.equal(await service.executar(), 1); checks++;
    const batchIds = Array.from({ length: 51 }, () => randomUUID());
    ids.push(...batchIds);
    await prisma.pedido.createMany({ data: batchIds.map((id) => ({
      id, identificadorNegocio: `D51-${id}`, clienteUsuarioId: user,
      data: new Date(now.getTime() - 30 * 60_000), statusAtual: 'PENDENTE_PAGAMENTO',
      modalidade: 'RETIRADA', valorItens: '1.00', freteAplicado: '0.00', total: '1.00',
    })) });
    assert.equal(await service.executar(), 50); checks++;
    assert.equal(await prisma.pedido.count({ where: { id: { in: batchIds }, statusAtual: 'PENDENTE_PAGAMENTO' } }), 1); checks++;
    assert.equal(await service.executar(), 1); checks++;
    assert.equal(await service.executar(), 0); checks++;
  } finally {
    await prisma.reservaEstoque.deleteMany({ where: { pedidoId: { in: ids } } });
    await prisma.pedido.deleteMany({ where: { id: { in: ids } } });
    await prisma.estoque.deleteMany({ where: { produtoId: product } });
    await prisma.produto.deleteMany({ where: { id: product } });
    await prisma.categoria.deleteMany({ where: { id: category } });
    await prisma.usuario.deleteMany({ where: { id: user } });
    assert.equal(await prisma.pedido.count({ where: { id: { in: ids } } }), 0); checks++;
    await prisma.$disconnect();
  }
  process.stdout.write(`PASS D51 PostgreSQL (${checks} verificações; fixtures limpas)\n`);
}
main().catch((error: unknown) => { process.stderr.write(`${String(error)}\n`); process.exitCode = 1; });
