import { ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProdutoDto } from './dto/create-produto.dto';
import { UpdateProdutoDto } from './dto/update-produto.dto';
import { ProdutoImagensService } from './produto-imagens.service';

const produtoSelect = {
  id: true, categoriaId: true, nome: true, descricao: true,
  precoAtual: true, imagem: true, ativo: true,
} as const;
type ProdutoSelecionado = Prisma.ProdutoGetPayload<{ select: typeof produtoSelect }>;

@Injectable()
export class ProdutosService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly imagens?: ProdutoImagensService) {}

  async create(input: CreateProdutoDto) {
    await this.ensureCategoria(input.categoriaId);
    try {
      const produto = await this.prisma.$transaction(async (tx) => {
        const created = await tx.produto.create({
          data: {
            categoriaId: input.categoriaId,
            nome: input.nome,
            descricao: input.descricao,
            precoAtual: new Prisma.Decimal(input.precoAtual),
            ativo: input.ativo,
          },
          select: produtoSelect,
        });
        await tx.estoque.create({
          data: { produtoId: created.id, quantidadeFisica: 0, quantidadeReservada: 0 },
        });
        return created;
      });
      return this.output(produto);
    } catch (error) {
      if (this.isPrismaError(error, 'P2003')) {
        throw new NotFoundException('Categoria não encontrada.');
      }
      throw error;
    }
  }

  async list() {
    const produtos = await this.prisma.produto.findMany({
      orderBy: [{ nome: 'asc' }, { id: 'asc' }], select: produtoSelect,
    });
    return produtos.map((produto) => this.output(produto));
  }

  async findById(id: string) {
    const produto = await this.prisma.produto.findUnique({ where: { id }, select: produtoSelect });
    if (!produto) throw new NotFoundException('Produto não encontrado.');
    return this.output(produto);
  }

  async update(id: string, input: UpdateProdutoDto) {
    if (input.categoriaId !== undefined) await this.ensureCategoria(input.categoriaId);
    try {
      const produto = await this.prisma.produto.update({
        where: { id },
        data: {
          categoriaId: input.categoriaId,
          nome: input.nome,
          descricao: input.descricao,
          precoAtual: input.precoAtual === undefined ? undefined : new Prisma.Decimal(input.precoAtual),
          ativo: input.ativo,
        },
        select: produtoSelect,
      });
      return this.output(produto);
    } catch (error) {
      if (this.isPrismaError(error, 'P2025')) throw new NotFoundException('Produto não encontrado.');
      if (this.isPrismaError(error, 'P2003')) throw new NotFoundException('Categoria não encontrada.');
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const previousImage = await this.prisma.$transaction(async (tx) => {
        const produto = await tx.produto.findUnique({ where: { id }, select: { id: true, imagem: true } });
        if (!produto) throw new NotFoundException('Produto não encontrado.');
        const deleted = await tx.estoque.deleteMany({
          where: { produtoId: id, quantidadeFisica: 0, quantidadeReservada: 0 },
        });
        if (deleted.count !== 1) throw new ConflictException('Estoque impede exclusão do produto.');
        await tx.produto.delete({ where: { id }, select: { id: true } });
        return produto.imagem;
      });
      await this.imagens?.cleanup(id, previousImage, 'exclusao-produto');
    } catch (error) {
      if (this.isPrismaError(error, 'P2025')) throw new NotFoundException('Produto não encontrado.');
      if (this.isPrismaError(error, 'P2003')) throw new ConflictException('Produto possui vínculos.');
      throw error;
    }
  }

  private async ensureCategoria(id: string): Promise<void> {
    const categoria = await this.prisma.categoria.findUnique({ where: { id }, select: { id: true } });
    if (!categoria) throw new NotFoundException('Categoria não encontrada.');
  }

  private output(produto: ProdutoSelecionado) {
    return { ...produto, precoAtual: produto.precoAtual.toFixed(2) };
  }

  private isPrismaError(error: unknown, code: string): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
  }
}
