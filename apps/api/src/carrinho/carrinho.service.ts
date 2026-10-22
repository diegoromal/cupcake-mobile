import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { somarPrecoUnitario } from '../catalogo/preco-unitario';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isManagedProductImage } from '../produtos/produto-imagens.service';
import { AdicionarItemCarrinhoDto } from './dto/adicionar-item.dto';

const motivoProduto = 'Produto indisponível.';
const motivoPersonalizacao = 'Personalização indisponível.';
const motivoPreco = 'Preço unitário negativo para a seleção.';
const motivoEstoque = 'Quantidade superior à disponibilidade.';

type CarrinhoItemLeitura = {
  id: string;
  produtoId: string;
  nome: string;
  imagemDisponivel: boolean;
  quantidade: number;
  personalizacoes: Array<{ id: string; nome: string }>;
  precoUnitario: string | null;
  subtotal: string | null;
  disponivel: boolean;
  motivo: string | null;
};

type CarrinhoLeitura = {
  id: string | null;
  itens: CarrinhoItemLeitura[];
  subtotal: string;
  total: string;
};

export type ItemPersistido = {
  id: string;
  produtoId: string;
  quantidade: number;
  produto: {
    nome: string;
    imagem: string | null;
    ativo: boolean;
    precoAtual: Prisma.Decimal;
    estoque: { quantidadeFisica: number; quantidadeReservada: number } | null;
    personalizacoes: Array<{ personalizacaoId: string }>;
  };
  personalizacoes: Array<{
    personalizacao: {
      id: string;
      nome: string;
      disponibilidade: boolean;
      ajusteValor: Prisma.Decimal | null;
    };
  }>;
};

export const leituraDoCarrinho = {
  id: true,
  itens: {
    orderBy: { id: 'asc' as const },
    select: {
      id: true,
      produtoId: true,
      quantidade: true,
      produto: {
        select: {
          nome: true,
          imagem: true,
          ativo: true,
          precoAtual: true,
          estoque: { select: { quantidadeFisica: true, quantidadeReservada: true } },
          personalizacoes: { select: { personalizacaoId: true } },
        },
      },
      personalizacoes: {
        orderBy: [
          { personalizacao: { nome: 'asc' as const } },
          { personalizacaoId: 'asc' as const },
        ],
        select: {
          personalizacao: {
            select: { id: true, nome: true, disponibilidade: true, ajusteValor: true },
          },
        },
      },
    },
  },
};

const itemSelect = {
  id: true,
  carrinhoId: true,
  produtoId: true,
  quantidade: true,
  personalizacoes: { select: { personalizacaoId: true } },
} as const;

@Injectable()
export class CarrinhoService {
  constructor(private readonly prisma: PrismaService) {}

  async obter(usuarioId: string): Promise<CarrinhoLeitura> {
    const carrinho = await this.prisma.carrinho.findUnique({
      where: { usuarioId },
      select: leituraDoCarrinho,
    });
    if (!carrinho) return carrinhoVazio(null);
    return apresentar(carrinho.id, carrinho.itens);
  }

  async adicionar(usuarioId: string, input: AdicionarItemCarrinhoDto) {
    const personalizacaoIds = input.personalizacaoIds.map((id) => id.toLowerCase());
    await this.ensureProduto(input.produtoId);
    await this.ensureDisponivel(input.produtoId, input.quantidade);
    this.ensureSelecao(personalizacaoIds);
    await this.ensurePersonalizacoes(input.produtoId, personalizacaoIds);
    const carrinho = await this.ensureCarrinho(usuarioId);
    return this.criarItem(carrinho.id, input.produtoId, input.quantidade, personalizacaoIds);
  }

  async alterarQuantidade(usuarioId: string, itemId: string, quantidade: number) {
    const item = await this.prisma.itemCarrinho.findFirst({
      where: { id: itemId, carrinho: { usuarioId } },
      select: { id: true, produtoId: true, quantidade: true },
    });
    if (!item) throw new NotFoundException('Item não encontrado.');
    await this.ensureDisponivel(item.produtoId, quantidade);
    const updated = await this.prisma.itemCarrinho.updateMany({
      where: { id: itemId, carrinho: { usuarioId } },
      data: { quantidade },
    });
    if (updated.count !== 1) throw new NotFoundException('Item não encontrado.');
    return this.obter(usuarioId);
  }

  async removerItem(usuarioId: string, itemId: string): Promise<void> {
    const removed = await this.prisma.itemCarrinho.deleteMany({
      where: { id: itemId, carrinho: { usuarioId } },
    });
    if (removed.count === 0) throw new NotFoundException('Item não encontrado.');
  }

  private async ensureProduto(id: string): Promise<void> {
    const produto = await this.prisma.produto.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!produto) throw new NotFoundException('Produto não encontrado.');
  }

  private async ensureDisponivel(produtoId: string, quantidade: number): Promise<void> {
    const estoque = await this.prisma.estoque.findUnique({
      where: { produtoId },
      select: { quantidadeFisica: true, quantidadeReservada: true },
    });
    const disponivel = estoque
      ? estoque.quantidadeFisica - estoque.quantidadeReservada
      : null;
    if (disponivel === null || quantidade > disponivel) {
      throw new ConflictException('Quantidade superior à disponibilidade.');
    }
  }

  private ensureSelecao(ids: string[]): void {
    if (new Set(ids).size !== ids.length) {
      throw new ConflictException('Seleção de personalizações inválida.');
    }
  }

  private async ensurePersonalizacoes(produtoId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const found = await this.prisma.personalizacao.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      throw new NotFoundException('Personalização não encontrada.');
    }
    const links = await this.prisma.produtoPersonalizacao.findMany({
      where: { produtoId, personalizacaoId: { in: ids } },
      select: { personalizacaoId: true },
    });
    if (links.length !== ids.length) {
      throw new ConflictException('Personalização incompatível com o produto.');
    }
  }

  private async ensureCarrinho(usuarioId: string): Promise<{ id: string }> {
    const existing = await this.findCarrinho(usuarioId);
    if (existing) return existing;
    try {
      return await this.createCarrinho(usuarioId);
    } catch (error) {
      if (!this.isPrismaError(error, 'P2002')) throw error;
    }
    // usuarioId é único. P2002 nesta criação é corrida; a request segue no carrinho já gravado.
    return await this.findCarrinho(usuarioId) ?? this.createCarrinho(usuarioId);
  }

  private findCarrinho(usuarioId: string) {
    return this.prisma.carrinho.findUnique({
      where: { usuarioId },
      select: { id: true },
    });
  }

  private createCarrinho(usuarioId: string) {
    return this.prisma.carrinho.create({
      data: { usuarioId },
      select: { id: true },
    });
  }

  private async criarItem(
    carrinhoId: string,
    produtoId: string,
    quantidade: number,
    personalizacaoIds: string[],
  ) {
    const item = await this.prisma.itemCarrinho.create({
      data: {
        carrinhoId,
        produtoId,
        quantidade,
        personalizacoes: {
          create: personalizacaoIds.map((personalizacaoId) => ({ personalizacaoId })),
        },
      },
      select: itemSelect,
    });
    return {
      id: item.id,
      carrinhoId: item.carrinhoId,
      produtoId: item.produtoId,
      quantidade: item.quantidade,
      personalizacaoIds: item.personalizacoes.map((row) => row.personalizacaoId),
    };
  }

  private isPrismaError(error: unknown, code: string): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
  }
}

function carrinhoVazio(id: string | null): CarrinhoLeitura {
  return { id, itens: [], subtotal: '0.00', total: '0.00' };
}

function apresentar(id: string, itens: ItemPersistido[]): CarrinhoLeitura {
  const linhas = itens.map(classificar);
  const subtotal = linhas.reduce(
    (soma, linha) => linha.valor === null ? soma : soma.plus(linha.valor),
    new Prisma.Decimal(0),
  );
  const texto = subtotal.toFixed(2);
  return {
    id,
    itens: linhas.map((linha) => linha.item).sort((a, b) => compareId(a.id, b.id)),
    subtotal: texto,
    total: texto,
  };
}

export function classificar(item: ItemPersistido): { item: CarrinhoItemLeitura; valor: Prisma.Decimal | null } {
  const personalizacoes = item.personalizacoes
    .map((row) => ({ id: row.personalizacao.id, nome: row.personalizacao.nome }))
    .sort(compareNomeThenId);
  const base = {
    id: item.id,
    produtoId: item.produtoId,
    nome: item.produto.nome,
    imagemDisponivel: isManagedProductImage(item.produto.imagem, item.produtoId),
    quantidade: item.quantidade,
    personalizacoes,
  };
  const semPreco = (motivo: string) => ({
    item: { ...base, precoUnitario: null, subtotal: null, disponivel: false, motivo },
    valor: null,
  });
  if (!item.produto.ativo) return semPreco(motivoProduto);
  const vinculos = new Set(item.produto.personalizacoes.map((row) => row.personalizacaoId));
  const personalizacaoInvalida = item.personalizacoes.some((row) =>
    !row.personalizacao.disponibilidade || !vinculos.has(row.personalizacao.id));
  if (personalizacaoInvalida) return semPreco(motivoPersonalizacao);
  const unitario = somarPrecoUnitario(
    item.produto.precoAtual,
    item.personalizacoes.map((row) => row.personalizacao.ajusteValor),
  );
  if (unitario.isNegative()) return semPreco(motivoPreco);
  const valor = unitario.times(item.quantidade);
  const estoque = item.produto.estoque;
  const saldo = estoque === null
    ? null
    : estoque.quantidadeFisica - estoque.quantidadeReservada;
  const semSaldo = saldo === null || item.quantidade > saldo;
  return {
    item: {
      ...base,
      precoUnitario: unitario.toFixed(2),
      subtotal: valor.toFixed(2),
      disponivel: !semSaldo,
      motivo: semSaldo ? motivoEstoque : null,
    },
    valor,
  };
}

function compareId(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function compareNomeThenId(
  a: { nome: string; id: string },
  b: { nome: string; id: string },
): number {
  if (a.nome < b.nome) return -1;
  if (a.nome > b.nome) return 1;
  return compareId(a.id, b.id);
}
