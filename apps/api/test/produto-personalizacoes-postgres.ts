import { strict as assert } from 'node:assert';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProdutoPersonalizacoesService } from '../src/produtos/produto-personalizacoes.service';

async function main() {
  const url = process.env.D20_TEST_DATABASE_URL;
  if (!url) throw new Error('D20_TEST_DATABASE_URL é obrigatória.');
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname) ||
      parsed.pathname !== '/cupcake_d20') {
    throw new Error('O teste D20 só pode usar o banco local cupcake_d20.');
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const service = new ProdutoPersonalizacoesService(prisma as unknown as PrismaService);
  const ids: { categoria?: string; produto?: string; outras?: string[] } = {};
  let checks = 0;
  const missing = '99999999-9999-4999-8999-999999999999';
  const isError = (code: string) => (error: unknown) =>
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
  try {
    ids.categoria = (await prisma.categoria.create({ data: { nome: 'D20 fixture' } })).id;
    ids.produto = (await prisma.produto.create({ data: {
      categoriaId: ids.categoria, nome: 'D20 fixture', precoAtual: '1.00',
    } })).id;
    const first = await prisma.personalizacao.create({ data: {
      nome: 'Z D20', ajusteValor: '1234567890.12',
    } });
    const second = await prisma.personalizacao.create({ data: {
      nome: 'A D20', ajusteValor: null, disponibilidade: false,
    } });
    const unlinked = await prisma.personalizacao.create({ data: { nome: 'B D20' } });
    ids.outras = [first.id, second.id, unlinked.id];

    assert.deepEqual(await service.list(ids.produto), []); checks++;
    assert.deepEqual(await service.create(ids.produto, first.id), {
      produtoId: ids.produto, personalizacaoId: first.id,
    }); checks++;
    assert(await prisma.produtoPersonalizacao.findUnique({ where: {
      produtoId_personalizacaoId: { produtoId: ids.produto, personalizacaoId: first.id },
    } })); checks++;
    await assert.rejects(prisma.produtoPersonalizacao.create({ data: {
      produtoId: ids.produto, personalizacaoId: first.id,
    } }), isError('P2002')); checks++;
    await assert.rejects(service.create(ids.produto, first.id), ConflictException); checks++;
    assert.equal(await prisma.produtoPersonalizacao.count({ where: {
      produtoId: ids.produto, personalizacaoId: first.id,
    } }), 1); checks++;
    await assert.rejects(prisma.produto.delete({ where: { id: ids.produto } }),
      isError('P2003')); checks++;
    await assert.rejects(prisma.personalizacao.delete({ where: { id: first.id } }),
      isError('P2003')); checks++;

    await service.create(ids.produto, second.id);
    assert(await prisma.produtoPersonalizacao.findUnique({ where: {
      produtoId_personalizacaoId: { produtoId: ids.produto, personalizacaoId: second.id },
    } })); checks++;
    const listed = await service.list(ids.produto);
    assert.deepEqual(listed.map((item) => item.id), [second.id, first.id]); checks++;
    assert.equal(listed[0].disponibilidade, false); checks++;
    assert.equal(listed[0].ajusteValor, null); checks++;
    assert.equal(listed[1].ajusteValor, '1234567890.12'); checks++;
    assert.deepEqual(Object.keys(listed[1]),
      ['id', 'nome', 'descricao', 'disponibilidade', 'ajusteValor']); checks++;
    assert(!listed.some((item) => item.id === unlinked.id)); checks++;

    await assert.rejects(service.create(missing, first.id), NotFoundException); checks++;
    await assert.rejects(service.create(ids.produto, missing), NotFoundException); checks++;
    await assert.rejects(prisma.produtoPersonalizacao.create({ data: {
      produtoId: missing, personalizacaoId: first.id,
    } }), isError('P2003')); checks++;
    await assert.rejects(prisma.produtoPersonalizacao.create({ data: {
      produtoId: ids.produto, personalizacaoId: missing,
    } }), isError('P2003')); checks++;
    assert.equal(await prisma.produtoPersonalizacao.count({ where: {
      OR: [{ produtoId: missing }, { personalizacaoId: missing }],
    } }), 0); checks++;

    await service.remove(ids.produto, second.id);
    assert.equal(await prisma.produtoPersonalizacao.findUnique({ where: {
      produtoId_personalizacaoId: { produtoId: ids.produto, personalizacaoId: second.id },
    } }), null); checks++;
    assert(await prisma.produto.findUnique({ where: { id: ids.produto } })); checks++;
    assert(await prisma.personalizacao.findUnique({ where: { id: second.id } })); checks++;
    await assert.rejects(service.remove(ids.produto, second.id), NotFoundException); checks++;

    const concurrent = await Promise.allSettled([
      service.create(ids.produto, second.id), service.create(ids.produto, second.id),
    ]);
    assert.equal(concurrent.filter((item) => item.status === 'fulfilled').length, 1); checks++;
    assert.equal(concurrent.filter((item) => item.status === 'rejected' &&
      item.reason instanceof ConflictException).length, 1); checks++;
    assert.equal(await prisma.produtoPersonalizacao.count({ where: {
      produtoId: ids.produto, personalizacaoId: second.id,
    } }), 1); checks++;
    process.stdout.write(`PASS PostgreSQL real D20: ${checks} verificações\n`);
  } finally {
    if (ids.produto) await prisma.produtoPersonalizacao.deleteMany({ where: { produtoId: ids.produto } });
    if (ids.produto) await prisma.produto.deleteMany({ where: { id: ids.produto } });
    if (ids.outras) await prisma.personalizacao.deleteMany({ where: { id: { in: ids.outras } } });
    if (ids.categoria) await prisma.categoria.deleteMany({ where: { id: ids.categoria } });
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Falha no teste PostgreSQL D20: ${String(error)}\n`);
  process.exitCode = 1;
});
