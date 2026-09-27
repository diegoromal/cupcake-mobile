import { strict as assert } from 'node:assert';
import { ConflictException } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';
import { PerfilUsuario } from '../src/generated/prisma/enums';
import { PersonalizacoesService } from '../src/personalizacoes/personalizacoes.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const url = process.env.D18_TEST_DATABASE_URL;
  if (!url) throw new Error('D18_TEST_DATABASE_URL é obrigatória.');
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname) ||
      parsed.pathname !== '/cupcake_d18') {
    throw new Error('O teste D18 só pode usar o banco local cupcake_d18.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const service = new PersonalizacoesService(prisma as unknown as PrismaService);
  const ids: { livre?: string; produto?: string; carrinho?: string;
    categoria?: string; product?: string; usuario?: string; cart?: string; item?: string } = {};
  let checks = 0;
  try {
    const livre = await service.create({ nome: 'D18 livre', ajusteValor: '1234567890.12' });
    ids.livre = livre.id;
    assert.equal(livre.ajusteValor, '1234567890.12'); checks++;
    assert.equal((await service.findById(livre.id)).ajusteValor, '1234567890.12'); checks++;
    assert.equal((await service.list()).find((item) => item.id === livre.id)?.ajusteValor,
      '1234567890.12'); checks++;
    assert.equal((await prisma.personalizacao.findUnique({ where: { id: livre.id } }))
      ?.ajusteValor?.toFixed(2), '1234567890.12'); checks++;
    assert.equal((await service.update(livre.id, { ajusteValor: '-0.05' })).ajusteValor,
      '-0.05'); checks++;
    assert.equal((await prisma.personalizacao.findUnique({ where: { id: livre.id } }))
      ?.ajusteValor?.toFixed(2), '-0.05'); checks++;
    assert.equal((await service.update(livre.id, { ajusteValor: null })).ajusteValor,
      null); checks++;
    await service.remove(livre.id);
    assert.equal(await prisma.personalizacao.findUnique({ where: { id: livre.id } }), null);
    ids.livre = undefined; checks++;

    ids.produto = (await service.create({ nome: 'D18 vínculo produto' })).id;
    ids.carrinho = (await service.create({ nome: 'D18 vínculo carrinho' })).id;
    ids.categoria = (await prisma.categoria.create({ data: { nome: 'D18 fixture' } })).id;
    ids.product = (await prisma.produto.create({
      data: { categoriaId: ids.categoria, nome: 'D18 fixture', precoAtual: '1.00' },
    })).id;
    await prisma.produtoPersonalizacao.create({
      data: { produtoId: ids.product, personalizacaoId: ids.produto },
    });
    ids.usuario = (await prisma.usuario.create({ data: {
      nome: 'D18 fixture', email: `d18-${Date.now()}@example.test`,
      telefone: '00000000000', credencialSenha: 'fixture', perfil: PerfilUsuario.CLIENTE,
    } })).id;
    ids.cart = (await prisma.carrinho.create({ data: { usuarioId: ids.usuario } })).id;
    ids.item = (await prisma.itemCarrinho.create({ data: {
      carrinhoId: ids.cart, produtoId: ids.product, quantidade: 1,
    } })).id;
    await prisma.itemCarrinhoPersonalizacao.create({
      data: { itemCarrinhoId: ids.item, personalizacaoId: ids.carrinho },
    });

    for (const [personalizacaoId, relation] of [
      [ids.produto, 'produto'], [ids.carrinho, 'carrinho'],
    ] as const) {
      await assert.rejects(prisma.personalizacao.delete({ where: { id: personalizacaoId } }),
        (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2003'); checks++;
      await assert.rejects(service.remove(personalizacaoId), ConflictException); checks++;
      assert(await prisma.personalizacao.findUnique({ where: { id: personalizacaoId } }));
      checks++;
      if (relation === 'produto') {
        assert(await prisma.produtoPersonalizacao.findUnique({ where: {
          produtoId_personalizacaoId: { produtoId: ids.product, personalizacaoId },
        } }));
      } else {
        assert(await prisma.itemCarrinhoPersonalizacao.findUnique({ where: {
          itemCarrinhoId_personalizacaoId: { itemCarrinhoId: ids.item, personalizacaoId },
        } }));
      }
      checks++;
    }
    process.stdout.write(`PASS PostgreSQL real D18: ${checks} verificações\n`);
  } finally {
    if (ids.item && ids.carrinho) await prisma.itemCarrinhoPersonalizacao.deleteMany({
      where: { itemCarrinhoId: ids.item, personalizacaoId: ids.carrinho },
    });
    if (ids.produto && ids.product) await prisma.produtoPersonalizacao.deleteMany({
      where: { produtoId: ids.product, personalizacaoId: ids.produto },
    });
    if (ids.item) await prisma.itemCarrinho.deleteMany({ where: { id: ids.item } });
    if (ids.cart) await prisma.carrinho.deleteMany({ where: { id: ids.cart } });
    if (ids.product) await prisma.produto.deleteMany({ where: { id: ids.product } });
    if (ids.categoria) await prisma.categoria.deleteMany({ where: { id: ids.categoria } });
    if (ids.usuario) await prisma.usuario.deleteMany({ where: { id: ids.usuario } });
    for (const id of [ids.livre, ids.produto, ids.carrinho]) {
      if (id) await prisma.personalizacao.deleteMany({ where: { id } });
    }
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Falha no teste PostgreSQL D18: ${String(error)}\n`);
  process.exitCode = 1;
});
