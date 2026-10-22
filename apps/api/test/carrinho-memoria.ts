import { Prisma } from '../src/generated/prisma/client';

export const memoriaIds = {
  userA: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  userB: '99999999-9999-4999-8999-999999999999',
  admin: '88888888-8888-4888-8888-888888888888',
  courier: '77777777-7777-4777-8777-777777777777',
  product: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  zero: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc',
  negative: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbd',
  optionAdjust: '11111111-1111-4111-8111-111111111111',
  optionNull: '22222222-2222-4222-8222-222222222222',
  optionNegative: '33333333-3333-4333-8333-333333333333',
} as const;

type Perfil = 'CLIENTE' | 'ADMIN' | 'ENTREGADOR';

type EstoqueMemoria = { quantidadeFisica: number; quantidadeReservada: number };

type ProdutoMemoria = {
  id: string;
  nome: string;
  preco: string;
  ativo: boolean;
  estoque: EstoqueMemoria | null;
  opcoes: string[];
};

type OpcaoMemoria = {
  id: string;
  nome: string;
  disponibilidade: boolean;
  ajuste: string | null;
};

type LinhaMemoria = {
  id: string;
  carrinhoId: string;
  produtoId: string;
  quantidade: number;
  personalizacaoIds: string[];
};

type CartMemoria = { id: string; usuarioId: string; linhas: LinhaMemoria[] };

type LeituraItem = {
  orderBy?: { id?: string };
  select?: { personalizacoes?: { orderBy?: unknown } };
};

export type MemoriaCarrinho = {
  produtos: Map<string, ProdutoMemoria>;
  opcoes: Map<string, OpcaoMemoria>;
  usuarios: Map<string, { id: string; perfil: Perfil }>;
  carts: Map<string, CartMemoria>;
  writes: {
    estoque: number;
    reserva: number;
    personalizacaoItem: number;
    carrinho: number;
    itemUpdate: number;
    itemFindMany: number;
  };
  alteracoes: Array<{ quantidade: number }>;
  ultimaLeitura: LeituraItem | null;
  linha(id: string): LinhaMemoria | undefined;
  definirPreco(produtoId: string, preco: string): void;
  definirEstoque(produtoId: string, estoque: EstoqueMemoria | null): void;
};

export function novaMemoria(): MemoriaCarrinho {
  const produtos = new Map<string, ProdutoMemoria>([
    [memoriaIds.product, {
      id: memoriaIds.product, nome: 'Cupcake de festa', preco: '10.00', ativo: true,
      estoque: { quantidadeFisica: 5, quantidadeReservada: 2 },
      opcoes: [memoriaIds.optionAdjust, memoriaIds.optionNull],
    }],
    [memoriaIds.zero, {
      id: memoriaIds.zero, nome: 'Cupcake zero', preco: '0.00', ativo: true,
      estoque: { quantidadeFisica: 10, quantidadeReservada: 0 }, opcoes: [],
    }],
    [memoriaIds.negative, {
      id: memoriaIds.negative, nome: 'Cupcake negativo', preco: '1.00', ativo: true,
      estoque: { quantidadeFisica: 10, quantidadeReservada: 0 },
      opcoes: [memoriaIds.optionNegative],
    }],
  ]);
  const opcoes = new Map<string, OpcaoMemoria>([
    [memoriaIds.optionAdjust, {
      id: memoriaIds.optionAdjust, nome: 'Ajuste', disponibilidade: true, ajuste: '0.10',
    }],
    [memoriaIds.optionNull, {
      id: memoriaIds.optionNull, nome: 'Nulo', disponibilidade: true, ajuste: null,
    }],
    [memoriaIds.optionNegative, {
      id: memoriaIds.optionNegative, nome: 'Menos', disponibilidade: true, ajuste: '-2.00',
    }],
  ]);
  const usuarios = new Map<string, { id: string; perfil: Perfil }>([
    [memoriaIds.userA, { id: memoriaIds.userA, perfil: 'CLIENTE' }],
    [memoriaIds.userB, { id: memoriaIds.userB, perfil: 'CLIENTE' }],
    [memoriaIds.admin, { id: memoriaIds.admin, perfil: 'ADMIN' }],
    [memoriaIds.courier, { id: memoriaIds.courier, perfil: 'ENTREGADOR' }],
  ]);
  const carts = new Map<string, CartMemoria>();
  const memoria: MemoriaCarrinho = {
    produtos,
    opcoes,
    usuarios,
    carts,
    writes: {
      estoque: 0, reserva: 0, personalizacaoItem: 0, carrinho: 0, itemUpdate: 0, itemFindMany: 0,
    },
    alteracoes: [],
    ultimaLeitura: null,
    linha(id: string) {
      for (const cart of carts.values()) {
        const linha = cart.linhas.find((item) => item.id === id);
        if (linha) return linha;
      }
      return undefined;
    },
    definirPreco(produtoId: string, preco: string) {
      const produto = produtos.get(produtoId);
      if (!produto) throw new Error('produto ausente na memória');
      produto.preco = preco;
    },
    definirEstoque(produtoId: string, estoque: EstoqueMemoria | null) {
      const produto = produtos.get(produtoId);
      if (!produto) throw new Error('produto ausente na memória');
      produto.estoque = estoque;
    },
  };
  return memoria;
}

function nextId(prefix: string, seq: number): string {
  return `${prefix}${seq.toString(16).padStart(12, '0')}`;
}

export function prismaDaMemoria(atual: () => MemoriaCarrinho) {
  let itemSeq = 0;
  let cartSeq = 0;
  const montar = (linha: LinhaMemoria) => {
    const estado = atual();
    const produto = estado.produtos.get(linha.produtoId);
    if (!produto) throw new Error('produto ausente na memória');
    const personalizacoes = linha.personalizacaoIds.map((id) => {
      const opcao = estado.opcoes.get(id);
      if (!opcao) throw new Error('personalização ausente na memória');
      return {
        personalizacao: {
          id,
          nome: opcao.nome,
          disponibilidade: opcao.disponibilidade,
          ajusteValor: opcao.ajuste == null ? null : new Prisma.Decimal(opcao.ajuste),
        },
      };
    });
    return {
      id: linha.id,
      produtoId: linha.produtoId,
      quantidade: linha.quantidade,
      produto: {
        nome: produto.nome,
        imagem: null,
        ativo: produto.ativo,
        precoAtual: new Prisma.Decimal(produto.preco),
        estoque: produto.estoque,
        personalizacoes: produto.opcoes.map((personalizacaoId) => ({ personalizacaoId })),
      },
      personalizacoes: personalizacoes.slice().reverse(),
    };
  };
  return {
    usuario: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const user = atual().usuarios.get(where.id);
        return user ? { id: user.id, perfil: user.perfil } : null;
      },
    },
    produto: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        atual().produtos.has(where.id) ? { id: where.id } : null,
    },
    estoque: {
      findUnique: async ({ where }: { where: { produtoId: string } }) =>
        atual().produtos.get(where.produtoId)?.estoque ?? null,
      update: async () => {
        atual().writes.estoque += 1;
        return {};
      },
    },
    personalizacao: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in
          .filter((id) => atual().opcoes.has(id))
          .map((id) => ({ id })),
    },
    produtoPersonalizacao: {
      findMany: async ({ where }: {
        where: { produtoId: string; personalizacaoId: { in: string[] } };
      }) => {
        const produto = atual().produtos.get(where.produtoId);
        if (!produto) return [];
        return where.personalizacaoId.in
          .filter((id) => produto.opcoes.includes(id))
          .map((personalizacaoId) => ({ personalizacaoId }));
      },
    },
    carrinho: {
      findUnique: async ({ where, select }: {
        where: { usuarioId: string };
        select?: { itens?: LeituraItem };
      }) => {
        const cart = atual().carts.get(where.usuarioId);
        if (!cart) return null;
        if (select?.itens) {
          atual().ultimaLeitura = select.itens;
          return { id: cart.id, itens: [...cart.linhas].reverse().map(montar) };
        }
        return { id: cart.id };
      },
      create: async ({ data }: { data: { usuarioId: string } }) => {
        cartSeq += 1;
        const cart: CartMemoria = {
          id: nextId('cccccccc-cccc-4ccc-8ccc-', cartSeq),
          usuarioId: data.usuarioId,
          linhas: [],
        };
        atual().carts.set(data.usuarioId, cart);
        return { id: cart.id };
      },
      delete: async () => {
        atual().writes.carrinho += 1;
        return {};
      },
    },
    itemCarrinho: {
      create: async ({ data }: {
        data: {
          carrinhoId: string;
          produtoId: string;
          quantidade: number;
          personalizacoes: { create: Array<{ personalizacaoId: string }> };
        };
      }) => {
        const cart = [...atual().carts.values()].find((item) => item.id === data.carrinhoId);
        if (!cart) throw new Error('carrinho ausente na memória');
        itemSeq += 1;
        const personalizacaoIds = data.personalizacoes.create.map((row) => row.personalizacaoId);
        const linha: LinhaMemoria = {
          id: nextId('dddddddd-dddd-4ddd-8ddd-', itemSeq),
          carrinhoId: cart.id,
          produtoId: data.produtoId,
          quantidade: data.quantidade,
          personalizacaoIds,
        };
        cart.linhas.push(linha);
        return {
          id: linha.id,
          carrinhoId: linha.carrinhoId,
          produtoId: linha.produtoId,
          quantidade: linha.quantidade,
          personalizacoes: personalizacaoIds.map((personalizacaoId) => ({ personalizacaoId })),
        };
      },
      findFirst: async ({ where }: {
        where: { id: string; carrinho: { usuarioId: string } };
      }) => {
        const linha = atual().carts.get(where.carrinho.usuarioId)?.linhas
          .find((item) => item.id === where.id);
        return linha
          ? { id: linha.id, produtoId: linha.produtoId, quantidade: linha.quantidade }
          : null;
      },
      updateMany: async ({ where, data }: {
        where: { id: string; carrinho: { usuarioId: string } };
        data: { quantidade: number };
      }) => {
        const linha = atual().carts.get(where.carrinho.usuarioId)?.linhas
          .find((item) => item.id === where.id);
        if (!linha) return { count: 0 };
        linha.quantidade = data.quantidade;
        atual().alteracoes.push({ quantidade: data.quantidade });
        return { count: 1 };
      },
      deleteMany: async ({ where }: {
        where: { id: string; carrinho: { usuarioId: string } };
      }) => {
        const cart = atual().carts.get(where.carrinho.usuarioId);
        if (!cart) return { count: 0 };
        const before = cart.linhas.length;
        cart.linhas = cart.linhas.filter((item) => item.id !== where.id);
        return { count: before - cart.linhas.length };
      },
      update: async () => {
        atual().writes.itemUpdate += 1;
        return {};
      },
      findMany: async () => {
        atual().writes.itemFindMany += 1;
        return [];
      },
    },
    itemCarrinhoPersonalizacao: {
      delete: async () => {
        atual().writes.personalizacaoItem += 1;
        return {};
      },
    },
    reservaEstoque: {
      create: async () => {
        atual().writes.reserva += 1;
        return {};
      },
      update: async () => {
        atual().writes.reserva += 1;
        return {};
      },
    },
  };
}
