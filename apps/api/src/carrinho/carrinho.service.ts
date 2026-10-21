import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isManagedProductImage } from '../produtos/produto-imagens.service';
import { AdicionarItemCarrinhoDto } from './dto/adicionar-item.dto';

type CarrinhoItemLeitura = {
  id: string;
  produtoId: string;
  nome: string;
  imagemDisponivel: boolean;
  quantidade: number;
  personalizacoes: Array<{ id: string; nome: string }>;
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

  async obter(usuarioId: string): Promise<{ id: string | null; itens: CarrinhoItemLeitura[] }> {
    const carrinho = await this.prisma.carrinho.findUnique({
      where: { usuarioId },
      select: {
        id: true,
        itens: {
          orderBy: { id: 'asc' },
          select: {
            id: true,
            produtoId: true,
            quantidade: true,
            produto: { select: { nome: true, imagem: true } },
            personalizacoes: {
              orderBy: [
                { personalizacao: { nome: 'asc' } },
                { personalizacaoId: 'asc' },
              ],
              select: { personalizacao: { select: { id: true, nome: true } } },
            },
          },
        },
      },
    });
    if (!carrinho) return { id: null, itens: [] };
    return {
      id: carrinho.id,
      itens: carrinho.itens.map((item) => ({
        id: item.id,
        produtoId: item.produtoId,
        nome: item.produto.nome,
        imagemDisponivel: isManagedProductImage(item.produto.imagem, item.produtoId),
        quantidade: item.quantidade,
        personalizacoes: item.personalizacoes
          .map((row) => ({ id: row.personalizacao.id, nome: row.personalizacao.nome }))
          .sort(compareNomeThenId),
      })).sort((a, b) => compareId(a.id, b.id)),
    };
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
