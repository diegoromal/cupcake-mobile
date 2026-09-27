import { strict as assert } from 'node:assert';
import { PrismaPg } from '@prisma/adapter-pg';
import { ConflictException } from '@nestjs/common';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { CategoriasService } from '../src/categorias/categorias.service';

async function main() {
  const url = process.env.D17_TEST_DATABASE_URL;
  if (!url) throw new Error('D17_TEST_DATABASE_URL é obrigatória.');
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname) ||
      parsed.pathname !== '/cupcake_d17') {
    throw new Error('O teste D17 só pode usar o banco local cupcake_d17.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const service = new CategoriasService(prisma as unknown as PrismaService);
  let categoriaId: string | undefined;
  let livreId: string | undefined;
  let produtoId: string | undefined;
  try {
    const categoria = await service.create({ nome: 'Categoria D17', descricao: null });
    categoriaId = categoria.id;
    const livre = await service.create({ nome: 'Categoria livre D17' });
    livreId = livre.id;
    const produto = await prisma.produto.create({
      data: { categoriaId, nome: 'Produto D17', precoAtual: '1.00' },
    });
    produtoId = produto.id;

    await assert.rejects(
      prisma.categoria.delete({ where: { id: categoriaId } }),
      (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003',
    );
    await assert.rejects(service.remove(categoriaId), ConflictException);
    assert.equal((await prisma.produto.findUnique({ where: { id: produtoId } }))?.categoriaId,
      categoriaId);
    assert(await prisma.categoria.findUnique({ where: { id: categoriaId } }));

    await service.remove(livreId);
    livreId = undefined;
    assert.equal(await prisma.categoria.findUnique({ where: { id: livre.id } }), null);
    process.stdout.write('PASS RESTRICT real, 409 pelo service, produto preservado e exclusão livre (4 verificações)\n');
  } finally {
    if (produtoId) await prisma.produto.deleteMany({ where: { id: produtoId } });
    if (categoriaId) await prisma.categoria.deleteMany({ where: { id: categoriaId } });
    if (livreId) await prisma.categoria.deleteMany({ where: { id: livreId } });
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Falha no teste PostgreSQL D17: ${String(error)}\n`);
  process.exitCode = 1;
});
