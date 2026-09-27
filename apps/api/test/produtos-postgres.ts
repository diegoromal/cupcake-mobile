import { strict as assert } from 'node:assert';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';
import { EstadoReserva, ModalidadeRecebimento, PerfilUsuario } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProdutosService } from '../src/produtos/produtos.service';

async function main() {
  const url = process.env.D19_TEST_DATABASE_URL;
  if (!url) throw new Error('D19_TEST_DATABASE_URL é obrigatória.');
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname) ||
      parsed.pathname !== '/cupcake_d19') {
    throw new Error('O teste D19 só pode usar o banco local cupcake_d19.');
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const service = new ProdutosService(prisma as unknown as PrismaService);
  const ids: string[] = [];
  let categoryA: string | undefined;
  let categoryB: string | undefined;
  let personalizacaoId: string | undefined;
  let usuarioId: string | undefined;
  let carrinhoId: string | undefined;
  let pedidoId: string | undefined;
  let checks = 0;
  const create = async (name: string) => {
    const product = await service.create({ categoriaId: categoryA!, nome: name, precoAtual: '1.00' });
    ids.push(product.id);
    return product.id;
  };
  const blocked = async (id: string, relation: () => Promise<unknown>) => {
    await assert.rejects(service.remove(id), ConflictException); checks++;
    assert(await prisma.produto.findUnique({ where: { id } })); checks++;
    assert(await prisma.estoque.findUnique({ where: { produtoId: id } })); checks++;
    assert(await relation()); checks++;
    assert.equal((await service.update(id, { ativo: false })).ativo, false); checks++;
  };
  try {
    categoryA = (await prisma.categoria.create({ data: { nome: 'D19 A' } })).id;
    categoryB = (await prisma.categoria.create({ data: { nome: 'D19 B' } })).id;
    const exact = await service.create({ categoriaId: categoryA, nome: 'D19 exact',
      precoAtual: '1234567890.12' });
    ids.push(exact.id);
    assert.equal(exact.precoAtual, '1234567890.12'); checks++;
    const persisted = await prisma.produto.findUnique({ where: { id: exact.id } });
    assert.equal(persisted?.precoAtual.toFixed(2), '1234567890.12'); checks++;
    const stock = await prisma.estoque.findUnique({ where: { produtoId: exact.id } });
    assert.equal(stock?.quantidadeFisica, 0); checks++;
    assert.equal(stock?.quantidadeReservada, 0); checks++;
    assert.equal(persisted?.ativo, true); checks++;

    let rolledBackId: string | undefined;
    await assert.rejects(prisma.$transaction(async (tx) => {
      const product = await tx.produto.create({ data: {
        categoriaId: categoryA!, nome: 'D19 rollback', precoAtual: '1.00',
      } });
      rolledBackId = product.id;
      await tx.estoque.create({ data: { produtoId: product.id } });
      await tx.estoque.create({ data: { produtoId: product.id } });
    }), (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'); checks++;
    assert.equal(await prisma.produto.findUnique({ where: { id: rolledBackId } }), null); checks++;
    assert.equal(await prisma.estoque.findUnique({ where: { produtoId: rolledBackId } }), null); checks++;

    const countBefore = await prisma.produto.count();
    await assert.rejects(service.create({ categoriaId: '99999999-9999-4999-8999-999999999999',
      nome: 'D19 orphan', precoAtual: '1.00' }), NotFoundException); checks++;
    assert.equal(await prisma.produto.count(), countBefore); checks++;
    assert.equal(await prisma.estoque.count(), countBefore); checks++;
    await assert.rejects(prisma.produto.create({ data: {
      categoriaId: categoryA, nome: 'D19 negative', precoAtual: '-0.01',
    } }), (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError &&
      String(error).includes('Produto_precoAtual_nonnegative')); checks++;

    assert.equal((await service.update(exact.id, { categoriaId: categoryB })).categoriaId,
      categoryB); checks++;
    await assert.rejects(service.update(exact.id, {
      categoriaId: '99999999-9999-4999-8999-999999999999',
    }), NotFoundException); checks++;
    assert.equal((await prisma.produto.findUnique({ where: { id: exact.id } }))?.categoriaId,
      categoryB); checks++;
    await service.remove(exact.id);
    assert.equal(await prisma.produto.findUnique({ where: { id: exact.id } }), null); checks++;
    assert.equal(await prisma.estoque.findUnique({ where: { produtoId: exact.id } }), null); checks++;
    ids.splice(ids.indexOf(exact.id), 1);

    personalizacaoId = (await prisma.personalizacao.create({ data: { nome: 'D19 fixture' } })).id;
    usuarioId = (await prisma.usuario.create({ data: {
      nome: 'D19 fixture', email: `d19-${Date.now()}@example.test`, telefone: '00000000000',
      credencialSenha: 'fixture', perfil: PerfilUsuario.CLIENTE,
    } })).id;
    carrinhoId = (await prisma.carrinho.create({ data: { usuarioId } })).id;
    pedidoId = (await prisma.pedido.create({ data: {
      identificadorNegocio: `d19-${Date.now()}`, clienteUsuarioId: usuarioId,
      modalidade: ModalidadeRecebimento.RETIRADA, valorItens: '1.00',
      freteAplicado: '0.00', total: '1.00',
    } })).id;

    const stockId = await create('D19 stock');
    await prisma.estoque.update({ where: { produtoId: stockId }, data: { quantidadeFisica: 1 } });
    await blocked(stockId, () => prisma.estoque.findUnique({ where: { produtoId: stockId } }));

    const personalizationId = await create('D19 personalization');
    await prisma.produtoPersonalizacao.create({ data: {
      produtoId: personalizationId, personalizacaoId,
    } });
    await blocked(personalizationId, () => prisma.produtoPersonalizacao.findUnique({ where: {
      produtoId_personalizacaoId: { produtoId: personalizationId, personalizacaoId: personalizacaoId! },
    } }));

    const cartId = await create('D19 cart');
    const itemCartId = (await prisma.itemCarrinho.create({ data: {
      carrinhoId, produtoId: cartId, quantidade: 1,
    } })).id;
    await blocked(cartId, () => prisma.itemCarrinho.findUnique({ where: { id: itemCartId } }));

    const orderId = await create('D19 order');
    const itemOrderId = (await prisma.itemPedido.create({ data: {
      pedidoId, produtoId: orderId, quantidade: 1, precoAplicado: '1.00',
      subtotalAplicado: '1.00',
    } })).id;
    await blocked(orderId, () => prisma.itemPedido.findUnique({ where: { id: itemOrderId } }));

    const reserveId = await create('D19 reserve');
    const reservationId = (await prisma.reservaEstoque.create({ data: {
      pedidoId, produtoId: reserveId, quantidade: 1, estado: EstadoReserva.ATIVA,
      momentoExpiracaoValidade: new Date(Date.now() + 3600000),
    } })).id;
    await blocked(reserveId, () => prisma.reservaEstoque.findUnique({ where: { id: reservationId } }));

    const movementId = await create('D19 movement');
    const movementRowId = (await prisma.movimentacaoEstoque.create({ data: {
      produtoId: movementId, quantidade: 1, motivoOrigem: 'fixture D19', data: new Date(),
    } })).id;
    await blocked(movementId, () => prisma.movimentacaoEstoque.findUnique({ where: { id: movementRowId } }));
    process.stdout.write(`PASS PostgreSQL real D19: ${checks} verificações\n`);
  } finally {
    await prisma.produtoPersonalizacao.deleteMany({ where: { produtoId: { in: ids } } });
    await prisma.itemCarrinho.deleteMany({ where: { produtoId: { in: ids } } });
    await prisma.itemPedido.deleteMany({ where: { produtoId: { in: ids } } });
    await prisma.reservaEstoque.deleteMany({ where: { produtoId: { in: ids } } });
    await prisma.movimentacaoEstoque.deleteMany({ where: { produtoId: { in: ids } } });
    await prisma.estoque.deleteMany({ where: { produtoId: { in: ids } } });
    await prisma.produto.deleteMany({ where: { id: { in: ids } } });
    if (pedidoId) await prisma.pedido.deleteMany({ where: { id: pedidoId } });
    if (carrinhoId) await prisma.carrinho.deleteMany({ where: { id: carrinhoId } });
    if (usuarioId) await prisma.usuario.deleteMany({ where: { id: usuarioId } });
    if (personalizacaoId) await prisma.personalizacao.deleteMany({ where: { id: personalizacaoId } });
    if (categoryA) await prisma.categoria.deleteMany({ where: { id: categoryA } });
    if (categoryB) await prisma.categoria.deleteMany({ where: { id: categoryB } });
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Falha no teste PostgreSQL D19: ${String(error)}\n`);
  process.exitCode = 1;
});
