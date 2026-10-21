import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CarrinhoService } from './carrinho.service';

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const produtoId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const cartId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const itemId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const secondItemId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const optionA = '11111111-1111-4111-8111-111111111111';
const optionB = '22222222-2222-4222-8222-222222222222';
const p2002 = new Prisma.PrismaClientKnownRequestError('P2002', {
  code: 'P2002', clientVersion: '7.10.0',
});

describe('CarrinhoService', () => {
  const produtoFind = jest.fn();
  const estoqueFind = jest.fn();
  const estoqueUpdate = jest.fn();
  const personalizacaoFindMany = jest.fn();
  const linkFindMany = jest.fn();
  const carrinhoFind = jest.fn();
  const carrinhoCreate = jest.fn();
  const itemCreate = jest.fn();
  const itemUpdate = jest.fn();
  const itemFindMany = jest.fn();
  const itemFindFirst = jest.fn();
  const itemUpdateMany = jest.fn();
  const itemDeleteMany = jest.fn();
  const itemOptionDelete = jest.fn();
  const carrinhoDelete = jest.fn();
  const reservaCreate = jest.fn();
  const reservaUpdate = jest.fn();
  const service = new CarrinhoService({
    produto: { findUnique: produtoFind },
    estoque: { findUnique: estoqueFind, update: estoqueUpdate },
    personalizacao: { findMany: personalizacaoFindMany },
    produtoPersonalizacao: { findMany: linkFindMany },
    carrinho: { findUnique: carrinhoFind, create: carrinhoCreate, delete: carrinhoDelete },
    itemCarrinho: {
      create: itemCreate, update: itemUpdate, findMany: itemFindMany,
      findFirst: itemFindFirst, updateMany: itemUpdateMany, deleteMany: itemDeleteMany,
    },
    itemCarrinhoPersonalizacao: { delete: itemOptionDelete },
    reservaEstoque: { create: reservaCreate, update: reservaUpdate },
  } as unknown as PrismaService);
  let itemIds: string[];

  beforeEach(() => {
    for (const fn of [produtoFind, estoqueFind, estoqueUpdate, personalizacaoFindMany, linkFindMany,
      carrinhoFind, carrinhoCreate, carrinhoDelete, itemCreate, itemUpdate, itemFindMany,
      itemFindFirst, itemUpdateMany, itemDeleteMany, itemOptionDelete, reservaCreate, reservaUpdate]) {
      fn.mockReset();
    }
    itemIds = [itemId, secondItemId];
    produtoFind.mockResolvedValue({ id: produtoId });
    estoqueFind.mockResolvedValue({ quantidadeFisica: 10, quantidadeReservada: 0 });
    personalizacaoFindMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) =>
      where.id.in.map((id) => ({ id })));
    linkFindMany.mockImplementation(async ({ where }: { where: { personalizacaoId: { in: string[] } } }) =>
      where.personalizacaoId.in.map((personalizacaoId) => ({ personalizacaoId })));
    carrinhoFind.mockResolvedValue(null);
    carrinhoCreate.mockResolvedValue({ id: cartId });
    itemFindFirst.mockResolvedValue(null);
    itemUpdateMany.mockResolvedValue({ count: 0 });
    itemDeleteMany.mockResolvedValue({ count: 0 });
    itemCreate.mockImplementation(async ({ data }: {
      data: {
        carrinhoId: string;
        produtoId: string;
        quantidade: number;
        personalizacoes: { create: Array<{ personalizacaoId: string }> };
      };
    }) => ({
      id: itemIds.shift() ?? itemId,
      carrinhoId: data.carrinhoId,
      produtoId: data.produtoId,
      quantidade: data.quantidade,
      personalizacoes: data.personalizacoes.create.map((row) => ({
        personalizacaoId: row.personalizacaoId,
      })),
    }));
  });

  it('cria carrinho e item sem personalização, preço ou escrita de estoque', async () => {
    await expect(service.adicionar(userId, {
      produtoId, quantidade: 2, personalizacaoIds: [],
    })).resolves.toEqual({
      id: itemId, carrinhoId: cartId, produtoId, quantidade: 2, personalizacaoIds: [],
    });
    expect(produtoFind).toHaveBeenCalledWith({ where: { id: produtoId }, select: { id: true } });
    expect(carrinhoFind).toHaveBeenCalledWith({ where: { usuarioId: userId }, select: { id: true } });
    expect(carrinhoCreate).toHaveBeenCalledWith({ data: { usuarioId: userId }, select: { id: true } });
    expect(personalizacaoFindMany).not.toHaveBeenCalled();
    expect(linkFindMany).not.toHaveBeenCalled();
    expect(itemFindMany).not.toHaveBeenCalled();
    expect(itemUpdate).not.toHaveBeenCalled();
    expect(estoqueUpdate).not.toHaveBeenCalled();
    expect(reservaCreate).not.toHaveBeenCalled();
    expect(reservaUpdate).not.toHaveBeenCalled();
    expect(itemCreate).toHaveBeenCalledWith({
      data: {
        carrinhoId: cartId, produtoId, quantidade: 2,
        personalizacoes: { create: [] },
      },
      select: {
        id: true, carrinhoId: true, produtoId: true, quantidade: true,
        personalizacoes: { select: { personalizacaoId: true } },
      },
    });
  });

  it('grava uma personalização no item novo', async () => {
    await expect(service.adicionar(userId, {
      produtoId, quantidade: 1, personalizacaoIds: [optionA],
    })).resolves.toMatchObject({ personalizacaoIds: [optionA] });
    expect(personalizacaoFindMany).toHaveBeenCalledWith({
      where: { id: { in: [optionA] } }, select: { id: true },
    });
    expect(itemCreate.mock.calls[0][0].data.personalizacoes).toEqual({
      create: [{ personalizacaoId: optionA }],
    });
  });

  it('grava várias personalizações na ordem do body', async () => {
    personalizacaoFindMany.mockResolvedValueOnce([{ id: optionB }, { id: optionA }]);
    await expect(service.adicionar(userId, {
      produtoId, quantidade: 1, personalizacaoIds: [optionA, optionB],
    })).resolves.toMatchObject({ personalizacaoIds: [optionA, optionB] });
    expect(linkFindMany).toHaveBeenCalledWith({
      where: { produtoId, personalizacaoId: { in: [optionA, optionB] } },
      select: { personalizacaoId: true },
    });
    expect(itemCreate.mock.calls[0][0].data.personalizacoes.create).toEqual([
      { personalizacaoId: optionA }, { personalizacaoId: optionB },
    ]);
  });

  it('reutiliza o carrinho do usuário', async () => {
    carrinhoFind.mockResolvedValue({ id: cartId });
    await service.adicionar(userId, { produtoId, quantidade: 1, personalizacaoIds: [] });
    expect(carrinhoCreate).not.toHaveBeenCalled();
    expect(itemCreate.mock.calls[0][0].data.carrinhoId).toBe(cartId);
  });

  it('retorna 404 quando o produto não existe e não cria carrinho', async () => {
    produtoFind.mockResolvedValue(null);
    await expect(service.adicionar(userId, {
      produtoId, quantidade: 1, personalizacaoIds: [],
    })).rejects.toThrow('Produto não encontrado.');
    expect(estoqueFind).not.toHaveBeenCalled();
    expect(carrinhoCreate).not.toHaveBeenCalled();
    expect(itemCreate).not.toHaveBeenCalled();
  });

  it('retorna 404 quando falta personalização', async () => {
    personalizacaoFindMany.mockResolvedValue([{ id: optionA }]);
    await expect(service.adicionar(userId, {
      produtoId, quantidade: 1, personalizacaoIds: [optionA, optionB],
    })).rejects.toThrow('Personalização não encontrada.');
    expect(linkFindMany).not.toHaveBeenCalled();
    expect(carrinhoCreate).not.toHaveBeenCalled();
    expect(itemCreate).not.toHaveBeenCalled();
  });

  it('retorna 409 quando a personalização não está vinculada ao produto', async () => {
    linkFindMany.mockResolvedValueOnce([]);
    await expect(service.adicionar(userId, {
      produtoId, quantidade: 1, personalizacaoIds: [optionA],
    })).rejects.toThrow('Personalização incompatível com o produto.');
    expect(carrinhoCreate).not.toHaveBeenCalled();
    expect(itemCreate).not.toHaveBeenCalled();
  });

  it('rejeita ids de personalização repetidos antes da leitura', async () => {
    await expect(service.adicionar(userId, {
      produtoId, quantidade: 1, personalizacaoIds: [optionA, optionA],
    })).rejects.toThrow('Seleção de personalizações inválida.');
    expect(personalizacaoFindMany).not.toHaveBeenCalled();
    expect(itemCreate).not.toHaveBeenCalled();
  });

  it('devolve o uuid canônico quando a personalização chega em maiúsculas', async () => {
    await expect(service.adicionar(userId, {
      produtoId, quantidade: 1, personalizacaoIds: [optionA.toUpperCase()],
    })).resolves.toMatchObject({ personalizacaoIds: [optionA] });
    expect(personalizacaoFindMany).toHaveBeenCalledWith({
      where: { id: { in: [optionA] } }, select: { id: true },
    });
    expect(linkFindMany).toHaveBeenCalledWith({
      where: { produtoId, personalizacaoId: { in: [optionA] } },
      select: { personalizacaoId: true },
    });
    expect(itemCreate.mock.calls[0][0].data.personalizacoes).toEqual({
      create: [{ personalizacaoId: optionA }],
    });
  });

  it('grava personalizações distintas enviadas em maiúsculas', async () => {
    await expect(service.adicionar(userId, {
      produtoId, quantidade: 1,
      personalizacaoIds: [optionA.toUpperCase(), optionB.toUpperCase()],
    })).resolves.toMatchObject({ personalizacaoIds: [optionA, optionB] });
    expect(itemCreate.mock.calls[0][0].data.personalizacoes.create).toEqual([
      { personalizacaoId: optionA }, { personalizacaoId: optionB },
    ]);
  });

  it('trata o mesmo uuid em caixas diferentes como duplicata', async () => {
    const error = await service.adicionar(userId, {
      produtoId, quantidade: 1, personalizacaoIds: [optionA, optionA.toUpperCase()],
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getStatus()).toBe(409);
    expect((error as ConflictException).message).toBe('Seleção de personalizações inválida.');
    expect(personalizacaoFindMany).not.toHaveBeenCalled();
    expect(itemCreate).not.toHaveBeenCalled();
  });

  it('compara só a quantidade do body com físico menos reservado', async () => {
    estoqueFind.mockResolvedValue({ quantidadeFisica: 4, quantidadeReservada: 1 });
    await expect(service.adicionar(userId, {
      produtoId, quantidade: 4, personalizacaoIds: [],
    })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.adicionar(userId, {
      produtoId, quantidade: 4, personalizacaoIds: [],
    })).rejects.toThrow('Quantidade superior à disponibilidade.');
    expect(itemFindMany).not.toHaveBeenCalled();
    expect(carrinhoCreate).not.toHaveBeenCalled();
    await expect(service.adicionar(userId, {
      produtoId, quantidade: 3, personalizacaoIds: [],
    })).resolves.toMatchObject({ quantidade: 3 });
  });

  it('rejeita saldo zero e produto sem linha de estoque', async () => {
    estoqueFind.mockResolvedValueOnce({ quantidadeFisica: 0, quantidadeReservada: 0 });
    await expect(service.adicionar(userId, {
      produtoId, quantidade: 1, personalizacaoIds: [],
    })).rejects.toThrow('Quantidade superior à disponibilidade.');
    estoqueFind.mockResolvedValueOnce(null);
    await expect(service.adicionar(userId, {
      produtoId, quantidade: 1, personalizacaoIds: [],
    })).rejects.toThrow('Quantidade superior à disponibilidade.');
    expect(itemCreate).not.toHaveBeenCalled();
  });

  it('cria outra linha no segundo POST sem somar quantidade nem atualizar a primeira', async () => {
    carrinhoFind.mockResolvedValue({ id: cartId });
    estoqueFind.mockResolvedValue({ quantidadeFisica: 2, quantidadeReservada: 0 });
    const first = await service.adicionar(userId, {
      produtoId, quantidade: 2, personalizacaoIds: [optionA],
    });
    const second = await service.adicionar(userId, {
      produtoId, quantidade: 2, personalizacaoIds: [optionA],
    });
    expect(first.id).not.toBe(second.id);
    expect(second).toMatchObject({ carrinhoId: cartId, produtoId, quantidade: 2 });
    expect(itemCreate).toHaveBeenCalledTimes(2);
    expect(itemCreate.mock.calls.map((call) => call[0].data.quantidade)).toEqual([2, 2]);
    expect(itemUpdate).not.toHaveBeenCalled();
    expect(itemFindMany).not.toHaveBeenCalled();
    expect(estoqueUpdate).not.toHaveBeenCalled();
    expect(reservaCreate).not.toHaveBeenCalled();
  });

  it('cria outra linha quando o segundo POST traz outras personalizações', async () => {
    carrinhoFind.mockResolvedValue({ id: cartId });
    await service.adicionar(userId, { produtoId, quantidade: 1, personalizacaoIds: [optionA] });
    await service.adicionar(userId, { produtoId, quantidade: 4, personalizacaoIds: [optionB] });
    expect(itemCreate.mock.calls[1][0].data).toMatchObject({
      quantidade: 4,
      personalizacoes: { create: [{ personalizacaoId: optionB }] },
    });
    expect(itemUpdate).not.toHaveBeenCalled();
  });

  it('segue no carrinho encontrado quando a criação recebe P2002', async () => {
    carrinhoFind.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: cartId });
    carrinhoCreate.mockReset();
    carrinhoCreate.mockRejectedValueOnce(p2002);
    await expect(service.adicionar(userId, {
      produtoId, quantidade: 1, personalizacaoIds: [],
    })).resolves.toMatchObject({ carrinhoId: cartId });
    expect(carrinhoCreate).toHaveBeenCalledTimes(1);
    expect(carrinhoFind).toHaveBeenLastCalledWith({
      where: { usuarioId: userId }, select: { id: true },
    });
  });

  it('repete a criação do carrinho uma vez se a releitura não achar', async () => {
    carrinhoFind.mockResolvedValue(null);
    carrinhoCreate.mockReset();
    carrinhoCreate.mockRejectedValueOnce(p2002).mockResolvedValueOnce({ id: cartId });
    await expect(service.adicionar(userId, {
      produtoId, quantidade: 1, personalizacaoIds: [],
    })).resolves.toMatchObject({ carrinhoId: cartId });
    expect(carrinhoCreate).toHaveBeenCalledTimes(2);
  });

  it('propaga o segundo P2002 e não trata erro que não é corrida', async () => {
    carrinhoFind.mockResolvedValue(null);
    carrinhoCreate.mockReset();
    carrinhoCreate.mockRejectedValue(p2002);
    await expect(service.adicionar(userId, {
      produtoId, quantidade: 1, personalizacaoIds: [],
    })).rejects.toBe(p2002);
    expect(carrinhoCreate).toHaveBeenCalledTimes(2);
    expect(itemCreate).not.toHaveBeenCalled();

    const failure = new Error('db down');
    carrinhoCreate.mockReset();
    carrinhoCreate.mockRejectedValue(failure);
    await expect(service.adicionar(userId, {
      produtoId, quantidade: 1, personalizacaoIds: [],
    })).rejects.toBe(failure);
    expect(carrinhoCreate).toHaveBeenCalledTimes(1);
  });

  it('usa o usuarioId argumento e não um id vindo do corpo', async () => {
    await service.adicionar(userId, { produtoId, quantidade: 1, personalizacaoIds: [] });
    expect(carrinhoCreate.mock.calls[0][0].data).toEqual({ usuarioId: userId });
    expect(JSON.stringify(itemCreate.mock.calls[0][0])).not.toContain('usuarioId');
  });

  it('devolve linhas distintas do mesmo produto com nome, quantidade e personalizações', async () => {
    const aroma = '33333333-3333-4333-8333-333333333333';
    const managed = `produtos/${produtoId}/11111111-1111-4111-8111-111111111111.webp`;
    carrinhoFind.mockResolvedValue({
      id: cartId,
      itens: [
        {
          id: secondItemId, produtoId, quantidade: 4,
          produto: { nome: 'Cupcake de festa', imagem: 'fora-do-padrao', precoAtual: '8.00', ativo: false },
          personalizacoes: [],
        },
        {
          id: itemId, produtoId, quantidade: 2,
          produto: { nome: 'Cupcake de festa', imagem: managed, precoAtual: '9.90', ativo: false },
          personalizacoes: [
            { personalizacao: { id: optionB, nome: 'Creme' } },
            { personalizacao: { id: optionA, nome: 'Creme' } },
            { personalizacao: { id: aroma, nome: 'Aroma' } },
          ],
        },
      ],
    });
    const result = await service.obter(userId);
    expect(result).toEqual({
      id: cartId,
      itens: [
        {
          id: itemId, produtoId, nome: 'Cupcake de festa', imagemDisponivel: true, quantidade: 2,
          personalizacoes: [
            { id: aroma, nome: 'Aroma' },
            { id: optionA, nome: 'Creme' },
            { id: optionB, nome: 'Creme' },
          ],
        },
        {
          id: secondItemId, produtoId, nome: 'Cupcake de festa', imagemDisponivel: false, quantidade: 4,
          personalizacoes: [],
        },
      ],
    });
    expect(result.itens[0].id).not.toBe(result.itens[1].id);
    expect(JSON.stringify(result)).not.toMatch(/preco|subtotal|frete|desconto|estoque|modalidade/i);
    const query = carrinhoFind.mock.calls[0][0];
    expect(query.where).toEqual({ usuarioId: userId });
    expect(query.select.itens.orderBy).toEqual({ id: 'asc' });
    expect(query.select.itens.select.personalizacoes.orderBy).toEqual([
      { personalizacao: { nome: 'asc' } },
      { personalizacaoId: 'asc' },
    ]);
    expect(query.select.itens.select.produto.select).toEqual({ nome: true, imagem: true });
    expect(JSON.stringify(query)).not.toMatch(/preco|estoque|reserva/i);
    expect(carrinhoCreate).not.toHaveBeenCalled();
    expect(itemCreate).not.toHaveBeenCalled();
    expect(itemUpdate).not.toHaveBeenCalled();
    expect(itemFindMany).not.toHaveBeenCalled();
    expect(estoqueFind).not.toHaveBeenCalled();
    expect(estoqueUpdate).not.toHaveBeenCalled();
    expect(reservaCreate).not.toHaveBeenCalled();
    expect(reservaUpdate).not.toHaveBeenCalled();
  });

  it('devolve carrinho inexistente e carrinho sem itens sem criar registro', async () => {
    await expect(service.obter(userId)).resolves.toEqual({ id: null, itens: [] });
    carrinhoFind.mockResolvedValue({ id: cartId, itens: [] });
    await expect(service.obter(userId)).resolves.toEqual({ id: cartId, itens: [] });
    expect(carrinhoCreate).not.toHaveBeenCalled();
    expect(itemCreate).not.toHaveBeenCalled();
    expect(estoqueUpdate).not.toHaveBeenCalled();
    expect(reservaCreate).not.toHaveBeenCalled();
  });

  it('lê somente o usuarioId argumento', async () => {
    const otherId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    await service.obter(otherId);
    expect(carrinhoFind).toHaveBeenCalledWith(expect.objectContaining({
      where: { usuarioId: otherId },
    }));
    expect(carrinhoCreate).not.toHaveBeenCalled();
  });

  const otherId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const ownedItem = { id: itemId, produtoId, quantidade: 2 };
  const cartRead = {
    id: cartId,
    itens: [{
      id: itemId, produtoId, quantidade: 2,
      produto: { nome: 'Cupcake de festa', imagem: null, precoAtual: '9.90' },
      personalizacoes: [{ personalizacao: { id: optionA, nome: 'Aroma' } }],
    }],
  };

  it('altera só a quantidade do item do usuário e devolve a leitura do GET', async () => {
    itemFindFirst.mockResolvedValue(ownedItem);
    itemUpdateMany.mockResolvedValue({ count: 1 });
    carrinhoFind.mockResolvedValue(cartRead);
    const result = await service.alterarQuantidade(userId, itemId, 2);
    expect(result).toMatchObject({
      id: cartId,
      itens: [{ id: itemId, quantidade: 2, personalizacoes: [{ id: optionA, nome: 'Aroma' }] }],
    });
    expect(JSON.stringify(result)).not.toMatch(/preco|subtotal|frete|desconto/i);
    expect(itemFindFirst).toHaveBeenCalledWith({
      where: { id: itemId, carrinho: { usuarioId: userId } },
      select: { id: true, produtoId: true, quantidade: true },
    });
    expect(itemUpdateMany).toHaveBeenCalledWith({
      where: { id: itemId, carrinho: { usuarioId: userId } },
      data: { quantidade: 2 },
    });
    expect(JSON.stringify(itemUpdateMany.mock.calls)).not.toMatch(/personalizac|quantidadeReservada|preco/i);
    expect(estoqueUpdate).not.toHaveBeenCalled();
    expect(reservaCreate).not.toHaveBeenCalled();
    expect(itemUpdate).not.toHaveBeenCalled();
  });

  it('aceita quantidade 1 e quantidade igual ao saldo sem somar a quantidade antiga', async () => {
    itemFindFirst.mockResolvedValue({ id: itemId, produtoId, quantidade: 2 });
    itemUpdateMany.mockResolvedValue({ count: 1 });
    carrinhoFind.mockResolvedValue({ id: cartId, itens: [] });
    estoqueFind.mockResolvedValue({ quantidadeFisica: 2, quantidadeReservada: 0 });
    await expect(service.alterarQuantidade(userId, itemId, 2)).resolves.toMatchObject({ id: cartId });
    estoqueFind.mockResolvedValue({ quantidadeFisica: 4, quantidadeReservada: 1 });
    await expect(service.alterarQuantidade(userId, itemId, 1)).resolves.toMatchObject({ id: cartId });
    await expect(service.alterarQuantidade(userId, itemId, 3)).resolves.toMatchObject({ id: cartId });
    expect(itemUpdateMany.mock.calls.map((call) => call[0].data)).toEqual([
      { quantidade: 2 }, { quantidade: 1 }, { quantidade: 3 },
    ]);
    expect(itemFindMany).not.toHaveBeenCalled();
  });

  it('rejeita saldo insuficiente, saldo zero e estoque ausente sem gravar', async () => {
    itemFindFirst.mockResolvedValue(ownedItem);
    estoqueFind.mockResolvedValueOnce({ quantidadeFisica: 4, quantidadeReservada: 1 });
    await expect(service.alterarQuantidade(userId, itemId, 4)).rejects.toBeInstanceOf(ConflictException);
    estoqueFind.mockResolvedValueOnce({ quantidadeFisica: 0, quantidadeReservada: 0 });
    await expect(service.alterarQuantidade(userId, itemId, 1))
      .rejects.toThrow('Quantidade superior à disponibilidade.');
    estoqueFind.mockResolvedValueOnce(null);
    const error = await service.alterarQuantidade(userId, itemId, 1).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getStatus()).toBe(409);
    expect(itemUpdateMany).not.toHaveBeenCalled();
    expect(estoqueUpdate).not.toHaveBeenCalled();
    expect(reservaCreate).not.toHaveBeenCalled();
  });

  it('responde 404 para item ausente, item de outro usuário e update que não grava uma linha', async () => {
    await expect(service.alterarQuantidade(otherId, itemId, 1)).rejects.toBeInstanceOf(NotFoundException);
    expect(itemFindFirst).toHaveBeenCalledWith({
      where: { id: itemId, carrinho: { usuarioId: otherId } },
      select: { id: true, produtoId: true, quantidade: true },
    });
    expect(estoqueFind).not.toHaveBeenCalled();
    expect(itemUpdateMany).not.toHaveBeenCalled();
    itemFindFirst.mockResolvedValue(ownedItem);
    itemUpdateMany.mockResolvedValue({ count: 0 });
    await expect(service.alterarQuantidade(userId, itemId, 1)).rejects.toThrow('Item não encontrado.');
    expect(carrinhoFind).not.toHaveBeenCalled();
    expect(estoqueUpdate).not.toHaveBeenCalled();
  });

  it('remove só o item do usuário e não apaga carrinho, personalização nem estoque', async () => {
    itemDeleteMany.mockResolvedValue({ count: 1 });
    await expect(service.removerItem(userId, itemId)).resolves.toBeUndefined();
    expect(itemDeleteMany).toHaveBeenCalledWith({
      where: { id: itemId, carrinho: { usuarioId: userId } },
    });
    expect(itemOptionDelete).not.toHaveBeenCalled();
    expect(carrinhoDelete).not.toHaveBeenCalled();
    expect(estoqueFind).not.toHaveBeenCalled();
    expect(estoqueUpdate).not.toHaveBeenCalled();
    expect(reservaCreate).not.toHaveBeenCalled();
    expect(itemFindFirst).not.toHaveBeenCalled();
  });

  it('responde 404 ao remover item ausente ou de outro usuário', async () => {
    await expect(service.removerItem(otherId, itemId)).rejects.toThrow('Item não encontrado.');
    expect(itemDeleteMany).toHaveBeenCalledWith({
      where: { id: itemId, carrinho: { usuarioId: otherId } },
    });
    expect(carrinhoDelete).not.toHaveBeenCalled();
    expect(itemOptionDelete).not.toHaveBeenCalled();
    expect(estoqueFind).not.toHaveBeenCalled();
  });

  it('POST e GET continuam sem findFirst, updateMany ou deleteMany', async () => {
    await service.adicionar(userId, { produtoId, quantidade: 1, personalizacaoIds: [] });
    await service.obter(userId);
    expect(itemFindFirst).not.toHaveBeenCalled();
    expect(itemUpdateMany).not.toHaveBeenCalled();
    expect(itemDeleteMany).not.toHaveBeenCalled();
    expect(carrinhoDelete).not.toHaveBeenCalled();
  });
});
