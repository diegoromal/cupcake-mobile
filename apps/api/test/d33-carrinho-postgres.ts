import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';
import { PerfilUsuario } from '../src/generated/prisma/enums';

function isCode(code: string) {
  return (error: unknown) =>
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function errorText(error: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const record = current as { message?: unknown; code?: unknown; meta?: unknown; cause?: unknown };
    if (typeof record.message === 'string') parts.push(record.message);
    if (record.code !== undefined) parts.push(String(record.code));
    if (record.meta !== undefined) parts.push(JSON.stringify(record.meta));
    current = record.cause;
  }
  return parts.join('\n');
}

function isPositiveQuantityCheck(error: unknown) {
  return errorText(error).includes('ItemCarrinho_quantidade_positive');
}

async function main() {
  const url = process.env.D33_TEST_DATABASE_URL;
  if (!url) throw new Error('Defina D33_TEST_DATABASE_URL.');
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname) ||
      parsed.pathname !== '/cupcake_d33' ||
      [...parsed.searchParams].some(([key, value]) => key !== 'schema' || value !== 'public')) {
    throw new Error('D33 exige banco local cupcake_d33, schema public.');
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const userA = randomUUID();
  const userB = randomUUID();
  const categoryId = randomUUID();
  const productId = randomUUID();
  const personalizacaoId = randomUUID();
  const missingId = randomUUID();
  const userIds = [userA, userB];
  try {
    await prisma.usuario.createMany({ data: userIds.map((id, index) => ({
      id, nome: `D33 ${index}`, email: `d33-${id}@example.test`, telefone: '00000000000',
      credencialSenha: 'fixture', perfil: PerfilUsuario.CLIENTE,
    })) });
    await prisma.categoria.create({ data: { id: categoryId, nome: 'D33' } });
    await prisma.produto.create({ data: {
      id: productId, categoriaId: categoryId, nome: 'D33', precoAtual: '10.00',
    } });
    await prisma.estoque.create({ data: {
      produtoId: productId, quantidadeFisica: 5, quantidadeReservada: 2,
    } });
    await prisma.personalizacao.create({ data: { id: personalizacaoId, nome: 'D33' } });
    assert.equal(await prisma.produtoPersonalizacao.count({
      where: { produtoId: productId, personalizacaoId },
    }), 0);

    const cartA = await prisma.carrinho.create({ data: { usuarioId: userA } });
    await assert.rejects(
      () => prisma.carrinho.create({ data: { usuarioId: userA } }),
      isCode('P2002'),
    );
    assert.equal(await prisma.carrinho.count({ where: { usuarioId: userA } }), 1);
    const cartB = await prisma.carrinho.create({ data: { usuarioId: userB } });
    assert.notEqual(cartA.id, cartB.id);
    assert.equal(cartA.usuarioId, userA);
    assert.equal(cartB.usuarioId, userB);
    assert.equal(await prisma.carrinho.count({ where: { id: cartA.id, usuarioId: userB } }), 0);

    await assert.rejects(
      () => prisma.itemCarrinho.create({ data: {
        carrinhoId: cartA.id, produtoId: missingId, quantidade: 1,
      } }),
      isCode('P2003'),
    );
    const item = await prisma.itemCarrinho.create({ data: {
      carrinhoId: cartA.id, produtoId: productId, quantidade: 1,
    } });
    assert.equal(item.quantidade, 1);
    assert.equal(item.produtoId, productId);
    assert.equal(item.carrinhoId, cartA.id);
    for (const quantidade of [0, -1]) {
      await assert.rejects(
        () => prisma.itemCarrinho.create({ data: {
          carrinhoId: cartA.id, produtoId: productId, quantidade,
        } }),
        isPositiveQuantityCheck,
      );
    }
    assert.equal(await prisma.itemCarrinho.count({ where: { carrinhoId: cartA.id } }), 1);

    await assert.rejects(
      () => prisma.itemCarrinhoPersonalizacao.create({ data: {
        itemCarrinhoId: item.id, personalizacaoId: missingId,
      } }),
      isCode('P2003'),
    );
    await prisma.itemCarrinhoPersonalizacao.create({ data: {
      itemCarrinhoId: item.id, personalizacaoId,
    } });
    await assert.rejects(
      () => prisma.itemCarrinhoPersonalizacao.create({ data: {
        itemCarrinhoId: item.id, personalizacaoId,
      } }),
      isCode('P2002'),
    );
    assert.equal(await prisma.itemCarrinhoPersonalizacao.count({
      where: { itemCarrinhoId: item.id, personalizacaoId },
    }), 1);

    await assert.rejects(() => prisma.produto.delete({ where: { id: productId } }), isCode('P2003'));
    await assert.rejects(
      () => prisma.personalizacao.delete({ where: { id: personalizacaoId } }),
      isCode('P2003'),
    );
    assert.equal((await prisma.estoque.findUniqueOrThrow({ where: { produtoId: productId } }))
      .quantidadeReservada, 2);
    assert.equal(await prisma.reservaEstoque.count({ where: { produtoId: productId } }), 0);
    assert.equal(await prisma.produto.count({ where: { id: productId } }), 1);
    assert.equal(await prisma.personalizacao.count({ where: { id: personalizacaoId } }), 1);

    await prisma.itemCarrinho.delete({ where: { id: item.id } });
    assert.equal(await prisma.itemCarrinho.count({ where: { id: item.id } }), 0);
    assert.equal(await prisma.itemCarrinhoPersonalizacao.count({
      where: { itemCarrinhoId: item.id },
    }), 0);
    assert.equal(await prisma.carrinho.count({ where: { id: cartA.id } }), 1);

    const item2 = await prisma.itemCarrinho.create({ data: {
      carrinhoId: cartA.id, produtoId: productId, quantidade: 1,
    } });
    await prisma.itemCarrinhoPersonalizacao.create({ data: {
      itemCarrinhoId: item2.id, personalizacaoId,
    } });
    await prisma.carrinho.delete({ where: { id: cartA.id } });
    assert.equal(await prisma.carrinho.count({ where: { id: cartA.id } }), 0);
    assert.equal(await prisma.itemCarrinho.count({ where: { id: item2.id } }), 0);
    assert.equal(await prisma.itemCarrinhoPersonalizacao.count({
      where: { itemCarrinhoId: item2.id },
    }), 0);
    assert.equal(await prisma.carrinho.count({ where: { id: cartB.id } }), 1);
    assert.equal((await prisma.estoque.findUniqueOrThrow({ where: { produtoId: productId } }))
      .quantidadeReservada, 2);
    assert.equal(await prisma.reservaEstoque.count({ where: { produtoId: productId } }), 0);
    process.stdout.write('PASS D33 PostgreSQL\n');
  } finally {
    await prisma.carrinho.deleteMany({ where: { usuarioId: { in: userIds } } });
    await prisma.estoque.deleteMany({ where: { produtoId: productId } });
    await prisma.produto.deleteMany({ where: { id: productId } });
    await prisma.personalizacao.deleteMany({ where: { id: personalizacaoId } });
    await prisma.categoria.deleteMany({ where: { id: categoryId } });
    await prisma.usuario.deleteMany({ where: { id: { in: userIds } } });
    assert.equal(await prisma.carrinho.count({ where: { usuarioId: { in: userIds } } }), 0);
    assert.equal(await prisma.produto.count({ where: { id: productId } }), 0);
    assert.equal(await prisma.personalizacao.count({ where: { id: personalizacaoId } }), 0);
    assert.equal(await prisma.categoria.count({ where: { id: categoryId } }), 0);
    assert.equal(await prisma.usuario.count({ where: { id: { in: userIds } } }), 0);
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Falha D33 PostgreSQL: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
