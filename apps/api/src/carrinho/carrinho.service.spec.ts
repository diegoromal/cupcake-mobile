import { ConflictException, NotFoundException } from '@nestjs/common';
import { memoriaIds, novaMemoria, prismaDaMemoria } from '../../test/carrinho-memoria';
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

function linhaLida(input: {
  id?: string;
  quantidade?: number;
  ativo?: boolean;
  preco?: string;
  imagem?: string | null;
  estoque?: { quantidadeFisica: number; quantidadeReservada: number } | null;
  opcoes?: Array<{
    id: string;
    nome: string;
    ajuste?: string | null;
    disponivel?: boolean;
    vinculado?: boolean;
  }>;
} = {}) {
  const opcoes = input.opcoes ?? [];
  const estoque = input.estoque === undefined
    ? { quantidadeFisica: 10, quantidadeReservada: 0 }
    : input.estoque;
  return {
    id: input.id ?? itemId,
    produtoId,
    quantidade: input.quantidade ?? 1,
    produto: {
      nome: 'Cupcake de festa',
      imagem: input.imagem ?? null,
      ativo: input.ativo ?? true,
      precoAtual: new Prisma.Decimal(input.preco ?? '10.00'),
      estoque,
      personalizacoes: opcoes
        .filter((opcao) => opcao.vinculado !== false)
        .map((opcao) => ({ personalizacaoId: opcao.id })),
    },
    personalizacoes: opcoes.map((opcao) => ({
      personalizacao: {
        id: opcao.id,
        nome: opcao.nome,
        disponibilidade: opcao.disponivel ?? true,
        ajusteValor: opcao.ajuste == null ? null : new Prisma.Decimal(opcao.ajuste),
      },
    })),
  };
}

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
        linhaLida({
          id: secondItemId, quantidade: 4, preco: '8.00', imagem: 'fora-do-padrao',
        }),
        linhaLida({
          id: itemId, quantidade: 2, preco: '9.90', imagem: managed,
          opcoes: [
            { id: optionB, nome: 'Creme' },
            { id: optionA, nome: 'Creme' },
            { id: aroma, nome: 'Aroma' },
          ],
        }),
      ],
    });
    const result = await service.obter(userId);
    expect(result).toEqual({
      id: cartId,
      subtotal: '51.80',
      total: '51.80',
      itens: [
        {
          id: itemId, produtoId, nome: 'Cupcake de festa', imagemDisponivel: true, quantidade: 2,
          precoUnitario: '9.90', subtotal: '19.80', disponivel: true, motivo: null,
          personalizacoes: [
            { id: aroma, nome: 'Aroma' },
            { id: optionA, nome: 'Creme' },
            { id: optionB, nome: 'Creme' },
          ],
        },
        {
          id: secondItemId, produtoId, nome: 'Cupcake de festa', imagemDisponivel: false, quantidade: 4,
          precoUnitario: '8.00', subtotal: '32.00', disponivel: true, motivo: null,
          personalizacoes: [],
        },
      ],
    });
    expect(result.itens[0].id).not.toBe(result.itens[1].id);
    expect(JSON.stringify(result)).not.toMatch(
      /precoAtual|ajusteValor|quantidadeFisica|quantidadeReservada|frete|desconto|modalidade/i,
    );
    const query = carrinhoFind.mock.calls[0][0];
    expect(query.where).toEqual({ usuarioId: userId });
    expect(carrinhoFind).toHaveBeenCalledTimes(1);
    expect(query.select.itens.orderBy).toEqual({ id: 'asc' });
    expect(query.select.itens.select.personalizacoes.orderBy).toEqual([
      { personalizacao: { nome: 'asc' } },
      { personalizacaoId: 'asc' },
    ]);
    expect(query.select.itens.select.personalizacoes.select.personalizacao.select).toEqual({
      id: true, nome: true, disponibilidade: true, ajusteValor: true,
    });
    expect(query.select.itens.select.produto.select).toEqual({
      nome: true,
      imagem: true,
      ativo: true,
      precoAtual: true,
      estoque: { select: { quantidadeFisica: true, quantidadeReservada: true } },
      personalizacoes: { select: { personalizacaoId: true } },
    });
    expect(carrinhoCreate).not.toHaveBeenCalled();
    expect(itemCreate).not.toHaveBeenCalled();
    expect(itemUpdate).not.toHaveBeenCalled();
    expect(itemUpdateMany).not.toHaveBeenCalled();
    expect(itemFindMany).not.toHaveBeenCalled();
    expect(estoqueFind).not.toHaveBeenCalled();
    expect(estoqueUpdate).not.toHaveBeenCalled();
    expect(reservaCreate).not.toHaveBeenCalled();
    expect(reservaUpdate).not.toHaveBeenCalled();
  });

  it('preserva a leitura D37 quando preço ou subtotal supera o limite monetário do pedido', async () => {
    carrinhoFind.mockResolvedValue({ id: cartId, itens: [
      linhaLida({ id: itemId, preco: '9999999999.99',
        opcoes: [{ id: optionA, nome: 'Extra', ajuste: '0.01' }] }),
      linhaLida({ id: secondItemId, quantidade: 2, preco: '9999999999.99' }),
    ] });
    const result = await service.obter(userId);
    expect(result.itens).toEqual([
      expect.objectContaining({ id: itemId, precoUnitario: '10000000000.00',
        subtotal: '10000000000.00', disponivel: true, motivo: null }),
      expect.objectContaining({ id: secondItemId, precoUnitario: '9999999999.99',
        subtotal: '19999999999.98', disponivel: true, motivo: null }),
    ]);
    expect(result).toMatchObject({ subtotal: '29999999999.98', total: '29999999999.98' });
  });

  it('soma ajustes vigentes, trata nulo como zero e mantém duas casas', async () => {
    carrinhoFind.mockResolvedValue({
      id: cartId,
      itens: [linhaLida({
        quantidade: 2,
        preco: '10.00',
        opcoes: [
          { id: optionB, nome: 'B', ajuste: '-0.20' },
          { id: optionA, nome: 'A', ajuste: '0.10' },
          { id: '33333333-3333-4333-8333-333333333333', nome: 'C', ajuste: null },
        ],
      })],
    });
    await expect(service.obter(userId)).resolves.toMatchObject({
      subtotal: '19.80',
      total: '19.80',
      itens: [{ precoUnitario: '9.90', subtotal: '19.80', disponivel: true, motivo: null }],
    });
  });

  it('aceita preço unitário zero', async () => {
    carrinhoFind.mockResolvedValue({
      id: cartId,
      itens: [linhaLida({
        preco: '10.00',
        opcoes: [{ id: optionA, nome: 'A', ajuste: '-10.00' }],
      })],
    });
    await expect(service.obter(userId)).resolves.toMatchObject({
      subtotal: '0.00',
      total: '0.00',
      itens: [{ precoUnitario: '0.00', subtotal: '0.00', disponivel: true, motivo: null }],
    });
  });

  it('anula o preço quando o unitário fica negativo e deixa a linha fora do total', async () => {
    carrinhoFind.mockResolvedValue({
      id: cartId,
      itens: [
        linhaLida({
          preco: '10.00',
          opcoes: [{ id: optionA, nome: 'A', ajuste: '-10.01' }],
        }),
        linhaLida({ id: secondItemId, preco: '1.50', quantidade: 2 }),
      ],
    });
    const result = await service.obter(userId);
    expect(result.itens[0]).toMatchObject({
      precoUnitario: null, subtotal: null, disponivel: false,
      motivo: 'Preço unitário negativo para a seleção.',
    });
    expect(result.subtotal).toBe('3.00');
    expect(result.total).toBe('3.00');
  });

  it('classifica produto inativo, opção indisponível e vínculo removido sem apagar a linha', async () => {
    carrinhoFind.mockResolvedValue({
      id: cartId,
      itens: [
        linhaLida({ id: itemId, ativo: false, quantidade: 2 }),
        linhaLida({
          id: secondItemId,
          opcoes: [{ id: optionA, nome: 'A', ajuste: '-99.00', disponivel: false }],
        }),
        linhaLida({
          id: '33333333-3333-4333-8333-333333333333',
          opcoes: [{ id: optionB, nome: 'B', vinculado: false }],
        }),
      ],
    });
    const result = await service.obter(userId);
    const motivo = Object.fromEntries(result.itens.map((item) => [item.id, item.motivo]));
    expect(motivo).toEqual({
      [itemId]: 'Produto indisponível.',
      [secondItemId]: 'Personalização indisponível.',
      '33333333-3333-4333-8333-333333333333': 'Personalização indisponível.',
    });
    expect(result.itens.every((item) => item.precoUnitario === null && item.subtotal === null)).toBe(true);
    expect(result.itens.every((item) => item.disponivel === false)).toBe(true);
    expect(result.subtotal).toBe('0.00');
    expect(result.total).toBe('0.00');
    expect(itemDeleteMany).not.toHaveBeenCalled();
  });

  it('compara cada linha com o saldo e não soma quantidades do mesmo produto', async () => {
    const saldo = { quantidadeFisica: 5, quantidadeReservada: 1 };
    carrinhoFind.mockResolvedValue({
      id: cartId,
      itens: [
        linhaLida({ id: itemId, quantidade: 4, estoque: saldo }),
        linhaLida({ id: secondItemId, quantidade: 4, estoque: saldo }),
      ],
    });
    const igual = await service.obter(userId);
    expect(igual.itens.every((item) => item.disponivel && item.motivo === null)).toBe(true);
    expect(igual.subtotal).toBe('80.00');
    carrinhoFind.mockResolvedValue({
      id: cartId,
      itens: [
        linhaLida({ id: itemId, quantidade: 5, estoque: saldo }),
        linhaLida({ id: secondItemId, quantidade: 1, estoque: saldo, preco: '2.50' }),
      ],
    });
    const acima = await service.obter(userId);
    expect(acima.itens[0]).toMatchObject({
      precoUnitario: '10.00', subtotal: '50.00', disponivel: false,
      motivo: 'Quantidade superior à disponibilidade.',
    });
    expect(acima.itens[1]).toMatchObject({
      precoUnitario: '2.50', subtotal: '2.50', disponivel: true, motivo: null,
    });
    expect(acima.total).toBe('52.50');
    carrinhoFind.mockResolvedValue({
      id: cartId,
      itens: [linhaLida({ quantidade: 1, estoque: null, preco: '4.00' })],
    });
    await expect(service.obter(userId)).resolves.toMatchObject({
      subtotal: '4.00',
      total: '4.00',
      itens: [{
        precoUnitario: '4.00', subtotal: '4.00', disponivel: false,
        motivo: 'Quantidade superior à disponibilidade.',
      }],
    });
    expect(estoqueUpdate).not.toHaveBeenCalled();
    expect(reservaCreate).not.toHaveBeenCalled();
    expect(reservaUpdate).not.toHaveBeenCalled();
    expect(itemUpdate).not.toHaveBeenCalled();
    expect(itemUpdateMany).not.toHaveBeenCalled();
  });

  it('devolve carrinho inexistente e carrinho sem itens sem criar registro', async () => {
    await expect(service.obter(userId)).resolves.toEqual({
      id: null, itens: [], subtotal: '0.00', total: '0.00',
    });
    carrinhoFind.mockResolvedValue({ id: cartId, itens: [] });
    await expect(service.obter(userId)).resolves.toEqual({
      id: cartId, itens: [], subtotal: '0.00', total: '0.00',
    });
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
    itens: [linhaLida({
      quantidade: 2,
      preco: '9.90',
      opcoes: [{ id: optionA, nome: 'Aroma' }],
    })],
  };

  it('altera só a quantidade do item do usuário e devolve a leitura do GET', async () => {
    itemFindFirst.mockResolvedValue(ownedItem);
    itemUpdateMany.mockResolvedValue({ count: 1 });
    carrinhoFind.mockResolvedValue(cartRead);
    const result = await service.alterarQuantidade(userId, itemId, 2);
    expect(result).toEqual({
      id: cartId,
      subtotal: '19.80',
      total: '19.80',
      itens: [{
        id: itemId, produtoId, nome: 'Cupcake de festa', imagemDisponivel: false, quantidade: 2,
        precoUnitario: '9.90', subtotal: '19.80', disponivel: true, motivo: null,
        personalizacoes: [{ id: optionA, nome: 'Aroma' }],
      }],
    });
    expect(JSON.stringify(result)).not.toMatch(/frete|desconto|precoAtual|quantidadeFisica/i);
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

  describe('fluxo consolidado', () => {
    function fluxo() {
      const memoria = novaMemoria();
      const fluxoService = new CarrinhoService(
        prismaDaMemoria(() => memoria) as unknown as PrismaService,
      );
      return { memoria, fluxoService };
    }

    function semEscrita(memoria: ReturnType<typeof novaMemoria>) {
      expect(memoria.writes).toEqual({
        estoque: 0, reserva: 0, personalizacaoItem: 0, carrinho: 0, itemUpdate: 0, itemFindMany: 0,
      });
    }

    it('inclui, lê, altera e relê a mesma linha sem escrever estoque', async () => {
      const { memoria, fluxoService } = fluxo();
      const created = await fluxoService.adicionar(memoriaIds.userA, {
        produtoId: memoriaIds.product, quantidade: 1, personalizacaoIds: [],
      });
      expect(Object.keys(created).sort()).toEqual([
        'carrinhoId', 'id', 'personalizacaoIds', 'produtoId', 'quantidade',
      ]);
      const read = await fluxoService.obter(memoriaIds.userA);
      expect(read.itens).toEqual([expect.objectContaining({
        id: created.id, quantidade: 1, precoUnitario: '10.00', subtotal: '10.00',
        disponivel: true, motivo: null, personalizacoes: [],
      })]);
      expect(read).toMatchObject({ subtotal: '10.00', total: '10.00' });
      expect(read.id).toBe(created.carrinhoId);
      const patched = await fluxoService.alterarQuantidade(memoriaIds.userA, created.id, 2);
      expect(patched.itens).toEqual([expect.objectContaining({
        id: created.id, quantidade: 2, precoUnitario: '10.00', subtotal: '20.00',
      })]);
      expect(patched).toMatchObject({ id: created.carrinhoId, subtotal: '20.00', total: '20.00' });
      const again = await fluxoService.obter(memoriaIds.userA);
      expect(again).toEqual(patched);
      expect(memoria.linha(created.id)?.quantidade).toBe(2);
      expect(memoria.carts.get(memoriaIds.userA)?.id).toBe(created.carrinhoId);
      expect(memoria.ultimaLeitura?.orderBy).toEqual({ id: 'asc' });
      expect(memoria.ultimaLeitura?.select?.personalizacoes?.orderBy).toEqual([
        { personalizacao: { nome: 'asc' } },
        { personalizacaoId: 'asc' },
      ]);
      expect(memoria.alteracoes).toEqual([{ quantidade: 2 }]);
      semEscrita(memoria);
    });

    it('preserva personalizações no PATCH e esvazia só a linha removida', async () => {
      const { memoria, fluxoService } = fluxo();
      const first = await fluxoService.adicionar(memoriaIds.userA, {
        produtoId: memoriaIds.product,
        quantidade: 1,
        personalizacaoIds: [memoriaIds.optionNull, memoriaIds.optionAdjust],
      });
      const second = await fluxoService.adicionar(memoriaIds.userA, {
        produtoId: memoriaIds.product, quantidade: 1, personalizacaoIds: [],
      });
      expect(first.id).not.toBe(second.id);
      const patched = await fluxoService.alterarQuantidade(memoriaIds.userA, first.id, 2);
      expect(patched.itens.map((item) => item.id)).toEqual([first.id, second.id].sort());
      const kept = patched.itens.find((item) => item.id === first.id);
      expect(kept?.quantidade).toBe(2);
      expect(kept?.personalizacoes).toEqual([
        { id: memoriaIds.optionAdjust, nome: 'Ajuste' },
        { id: memoriaIds.optionNull, nome: 'Nulo' },
      ]);
      expect(memoria.linha(first.id)?.personalizacaoIds).toEqual([
        memoriaIds.optionNull, memoriaIds.optionAdjust,
      ]);
      await fluxoService.removerItem(memoriaIds.userA, first.id);
      expect(memoria.linha(first.id)).toBeUndefined();
      const after = await fluxoService.obter(memoriaIds.userA);
      expect(after.id).toBe(first.carrinhoId);
      expect(after.itens.map((item) => item.id)).toEqual([second.id]);
      await fluxoService.removerItem(memoriaIds.userA, second.id);
      expect(await fluxoService.obter(memoriaIds.userA)).toEqual({
        id: first.carrinhoId, itens: [], subtotal: '0.00', total: '0.00',
      });
      expect(memoria.carts.has(memoriaIds.userA)).toBe(true);
      semEscrita(memoria);
    });

    it('isola carrinhos e responde 404 igual para item ausente ou alheio', async () => {
      const { memoria, fluxoService } = fluxo();
      const created = await fluxoService.adicionar(memoriaIds.userA, {
        produtoId: memoriaIds.product, quantidade: 2, personalizacaoIds: [],
      });
      expect(await fluxoService.obter(memoriaIds.userB)).toEqual({
        id: null, itens: [], subtotal: '0.00', total: '0.00',
      });
      const foreignPatch = await fluxoService.alterarQuantidade(memoriaIds.userB, created.id, 1)
        .catch((error: unknown) => error);
      const missingPatch = await fluxoService.alterarQuantidade(memoriaIds.userA, memoriaIds.optionAdjust, 1)
        .catch((error: unknown) => error);
      const foreignDelete = await fluxoService.removerItem(memoriaIds.userB, created.id)
        .catch((error: unknown) => error);
      const missingDelete = await fluxoService.removerItem(memoriaIds.userA, memoriaIds.zero)
        .catch((error: unknown) => error);
      for (const error of [foreignPatch, missingPatch, foreignDelete, missingDelete]) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect((error as NotFoundException).message).toBe('Item não encontrado.');
      }
      expect(memoria.linha(created.id)?.quantidade).toBe(2);
      expect(memoria.carts.has(memoriaIds.userB)).toBe(false);
      const owned = await fluxoService.obter(memoriaIds.userA);
      expect(owned.itens).toEqual([expect.objectContaining({ id: created.id, quantidade: 2 })]);
      semEscrita(memoria);
    });

    it('valida cada linha contra o saldo sem somar a quantidade antiga nem linhas irmãs', async () => {
      const { memoria, fluxoService } = fluxo();
      const first = await fluxoService.adicionar(memoriaIds.userA, {
        produtoId: memoriaIds.product, quantidade: 2, personalizacaoIds: [],
      });
      const second = await fluxoService.adicionar(memoriaIds.userA, {
        produtoId: memoriaIds.product, quantidade: 2, personalizacaoIds: [],
      });
      const both = await fluxoService.obter(memoriaIds.userA);
      expect(both.itens).toEqual([
        expect.objectContaining({ id: first.id, quantidade: 2, disponivel: true, motivo: null }),
        expect.objectContaining({ id: second.id, quantidade: 2, disponivel: true, motivo: null }),
      ]);
      const atBalance = await fluxoService.alterarQuantidade(memoriaIds.userA, first.id, 3);
      expect(atBalance.itens).toEqual([
        expect.objectContaining({
          id: first.id, quantidade: 3, disponivel: true, precoUnitario: '10.00', subtotal: '30.00',
        }),
        expect.objectContaining({ id: second.id, quantidade: 2, disponivel: true, subtotal: '20.00' }),
      ]);
      expect(atBalance).toMatchObject({ subtotal: '50.00', total: '50.00' });
      await expect(fluxoService.alterarQuantidade(memoriaIds.userA, first.id, 4))
        .rejects.toThrow('Quantidade superior à disponibilidade.');
      expect(memoria.linha(first.id)?.quantidade).toBe(3);
      expect(memoria.linha(second.id)?.quantidade).toBe(2);
      memoria.definirEstoque(memoriaIds.product, null);
      const missingStock = await fluxoService.obter(memoriaIds.userA);
      expect(missingStock.itens).toEqual([
        expect.objectContaining({
          id: first.id, precoUnitario: '10.00', subtotal: '30.00', disponivel: false,
          motivo: 'Quantidade superior à disponibilidade.',
        }),
        expect.objectContaining({
          id: second.id, precoUnitario: '10.00', subtotal: '20.00', disponivel: false,
          motivo: 'Quantidade superior à disponibilidade.',
        }),
      ]);
      expect(missingStock).toMatchObject({ subtotal: '50.00', total: '50.00' });
      await expect(fluxoService.alterarQuantidade(memoriaIds.userA, second.id, 1))
        .rejects.toBeInstanceOf(ConflictException);
      expect(memoria.linha(second.id)?.quantidade).toBe(2);
      expect(memoria.alteracoes).toEqual([{ quantidade: 3 }]);
      semEscrita(memoria);
    });

    it('recalcula preço vigente, ajuste nulo, zero e negativo sem gravar o valor', async () => {
      const { memoria, fluxoService } = fluxo();
      const priced = await fluxoService.adicionar(memoriaIds.userA, {
        produtoId: memoriaIds.product,
        quantidade: 2,
        personalizacaoIds: [memoriaIds.optionAdjust, memoriaIds.optionNull],
      });
      const zero = await fluxoService.adicionar(memoriaIds.userA, {
        produtoId: memoriaIds.zero, quantidade: 1, personalizacaoIds: [],
      });
      const negative = await fluxoService.adicionar(memoriaIds.userA, {
        produtoId: memoriaIds.negative, quantidade: 1, personalizacaoIds: [memoriaIds.optionNegative],
      });
      const read = await fluxoService.obter(memoriaIds.userA);
      expect(read.itens).toEqual([
        expect.objectContaining({
          id: priced.id, quantidade: 2, precoUnitario: '10.10', subtotal: '20.20', disponivel: true,
          personalizacoes: [
            { id: memoriaIds.optionAdjust, nome: 'Ajuste' },
            { id: memoriaIds.optionNull, nome: 'Nulo' },
          ],
        }),
        expect.objectContaining({
          id: zero.id, precoUnitario: '0.00', subtotal: '0.00', disponivel: true, motivo: null,
        }),
        expect.objectContaining({
          id: negative.id, precoUnitario: null, subtotal: null, disponivel: false,
          motivo: 'Preço unitário negativo para a seleção.',
        }),
      ]);
      expect(read).toMatchObject({ subtotal: '20.20', total: '20.20' });
      memoria.definirPreco(memoriaIds.product, '11.00');
      const reread = await fluxoService.obter(memoriaIds.userA);
      expect(reread.itens.find((item) => item.id === priced.id)).toEqual(expect.objectContaining({
        precoUnitario: '11.10', subtotal: '22.20',
      }));
      expect(reread).toMatchObject({ subtotal: '22.20', total: '22.20' });
      const patched = await fluxoService.alterarQuantidade(memoriaIds.userA, priced.id, 1);
      expect(patched.itens.find((item) => item.id === priced.id)).toEqual(expect.objectContaining({
        quantidade: 1, precoUnitario: '11.10', subtotal: '11.10',
        personalizacoes: [
          { id: memoriaIds.optionAdjust, nome: 'Ajuste' },
          { id: memoriaIds.optionNull, nome: 'Nulo' },
        ],
      }));
      expect(patched.itens.find((item) => item.id === negative.id)?.precoUnitario).toBeNull();
      expect(patched).toMatchObject({ subtotal: '11.10', total: '11.10' });
      expect(JSON.stringify(patched)).not.toMatch(/precoAtual|quantidadeFisica|quantidadeReservada/);
      semEscrita(memoria);
    });
  });
});
