import { strict as assert } from 'node:assert';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { EstoqueService } from '../src/produtos/estoque.service';

async function main() {
  const url = process.env.D24_TEST_DATABASE_URL;
  if (!url) throw new Error('D24_TEST_DATABASE_URL é obrigatória.');
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || parsed.pathname !== '/cupcake_d24') {
    throw new Error('O teste D24 só pode usar o banco local cupcake_d24.');
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const service = new EstoqueService(prisma as unknown as PrismaService);
  let categoriaId: string | undefined;
  let produtoId: string | undefined;
  try {
    categoriaId = (await prisma.categoria.create({ data: { nome: 'D24 teste' } })).id;
    produtoId = (await prisma.produto.create({ data: {
      categoriaId, nome: 'D24 teste', precoAtual: '1.00',
    } })).id;
    await prisma.estoque.create({ data: { produtoId, quantidadeFisica: 8, quantidadeReservada: 3 } });

    const [primeiro, segundo] = await Promise.all([
      service.ajustar(produtoId, 2), service.ajustar(produtoId, 4),
    ]);
    assert.equal(primeiro.quantidadeReservada, 3);
    assert.equal(segundo.quantidadeReservada, 3);
    assert.deepEqual([primeiro.quantidadeDisponivel, segundo.quantidadeDisponivel].sort(), [2, 4]);
    const atual = await service.consultar(produtoId);
    assert([2, 4].includes(atual.quantidadeDisponivel));
    assert.equal(atual.quantidadeFisica, atual.quantidadeReservada + atual.quantidadeDisponivel);
    const movimentos = await service.historico(produtoId);
    assert.equal(movimentos.length, 2);
    const diferencasEsperadas = atual.quantidadeDisponivel === 4 ? [-3, 2] : [-2, -1];
    assert.deepEqual(movimentos.map(row => row.quantidade).sort((a, b) => a - b), diferencasEsperadas);
    assert(movimentos.every(row => row.produtoId === produtoId && row.pedidoId === null &&
      row.motivoOrigem === 'AJUSTE_ADMINISTRATIVO'));
    assert.equal(movimentos.reduce((total, row) => total + row.quantidade, 0), atual.quantidadeFisica - 8);
    assert.deepEqual(movimentos, [...movimentos].sort((a, b) =>
      b.data.getTime() - a.data.getTime() || b.id.localeCompare(a.id)));

    const count = await prisma.movimentacaoEstoque.count({ where: { produtoId } });
    await service.ajustar(produtoId, atual.quantidadeDisponivel);
    assert.equal(await prisma.movimentacaoEstoque.count({ where: { produtoId } }), count);

    await prisma.estoque.update({ where: { produtoId }, data: { quantidadeFisica: 6, quantidadeReservada: 6 } });
    await service.ajustar(produtoId, 0);
    assert.deepEqual(await service.consultar(produtoId), {
      produtoId, quantidadeFisica: 6, quantidadeReservada: 6, quantidadeDisponivel: 0,
    });

    const before = await service.consultar(produtoId);
    const movementCount = await prisma.movimentacaoEstoque.count({ where: { produtoId } });
    await assert.rejects(service.ajustar(produtoId, 2147483647));
    assert.deepEqual(await service.consultar(produtoId), before);
    assert.equal(await prisma.movimentacaoEstoque.count({ where: { produtoId } }), movementCount);
    await prisma.$executeRawUnsafe(`CREATE FUNCTION public.d24_reject_movement() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'falha de histórico D24'; END $$`);
    try {
      await prisma.$executeRawUnsafe(`CREATE TRIGGER d24_reject_movement BEFORE INSERT ON "MovimentacaoEstoque"
        FOR EACH ROW EXECUTE FUNCTION public.d24_reject_movement()`);
      await assert.rejects(service.ajustar(produtoId, 1), /falha de histórico D24/);
      assert.deepEqual(await service.consultar(produtoId), before);
      assert.equal(await prisma.movimentacaoEstoque.count({ where: { produtoId } }), movementCount);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS d24_reject_movement ON "MovimentacaoEstoque"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS public.d24_reject_movement()`);
    }
    process.stdout.write('PASS PostgreSQL real D24: concorrência, no-op, reserva, ordem e rollback\n');
  } finally {
    if (produtoId) {
      await prisma.movimentacaoEstoque.deleteMany({ where: { produtoId } });
      await prisma.estoque.deleteMany({ where: { produtoId } });
      await prisma.produto.deleteMany({ where: { id: produtoId } });
    }
    if (categoriaId) await prisma.categoria.deleteMany({ where: { id: categoriaId } });
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Falha no teste PostgreSQL D24: ${String(error)}\n`);
  process.exitCode = 1;
});
