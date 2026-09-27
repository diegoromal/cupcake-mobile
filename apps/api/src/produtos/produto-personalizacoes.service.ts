import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const personalizacaoSelect = {
  id: true, nome: true, descricao: true, disponibilidade: true, ajusteValor: true,
} as const;
type PersonalizacaoRow = Prisma.PersonalizacaoGetPayload<{ select: typeof personalizacaoSelect }>;

@Injectable()
export class ProdutoPersonalizacoesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(produtoId: string) {
    await this.ensureProduto(produtoId);
    const rows = await this.prisma.personalizacao.findMany({
      where: { produtos: { some: { produtoId } } },
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
      select: personalizacaoSelect,
    });
    return rows.map((row) => this.output(row));
  }

  async create(produtoId: string, personalizacaoId: string) {
    await this.ensureProduto(produtoId);
    await this.ensurePersonalizacao(personalizacaoId);
    const where = { produtoId_personalizacaoId: { produtoId, personalizacaoId } };
    if (await this.prisma.produtoPersonalizacao.findUnique({ where, select: { produtoId: true } })) {
      throw new ConflictException('Personalização já vinculada ao produto.');
    }
    try {
      await this.prisma.produtoPersonalizacao.create({
        data: { produtoId, personalizacaoId }, select: { produtoId: true },
      });
    } catch (error) {
      if (this.isPrismaError(error, 'P2002')) {
        throw new ConflictException('Personalização já vinculada ao produto.');
      }
      if (this.isPrismaError(error, 'P2003')) {
        await this.ensureProduto(produtoId);
        await this.ensurePersonalizacao(personalizacaoId);
        throw new ConflictException('Não foi possível vincular a personalização.');
      }
      throw error;
    }
    return { produtoId, personalizacaoId };
  }

  async remove(produtoId: string, personalizacaoId: string): Promise<void> {
    await this.ensureProduto(produtoId);
    try {
      await this.prisma.produtoPersonalizacao.delete({
        where: { produtoId_personalizacaoId: { produtoId, personalizacaoId } },
        select: { produtoId: true },
      });
    } catch (error) {
      if (this.isPrismaError(error, 'P2025')) {
        throw new NotFoundException('Vínculo não encontrado.');
      }
      throw error;
    }
  }

  private async ensureProduto(id: string): Promise<void> {
    if (!await this.prisma.produto.findUnique({ where: { id }, select: { id: true } })) {
      throw new NotFoundException('Produto não encontrado.');
    }
  }

  private async ensurePersonalizacao(id: string): Promise<void> {
    if (!await this.prisma.personalizacao.findUnique({ where: { id }, select: { id: true } })) {
      throw new NotFoundException('Personalização não encontrada.');
    }
  }

  private output(row: PersonalizacaoRow) {
    return { ...row, ajusteValor: row.ajusteValor?.toFixed(2) ?? null };
  }

  private isPrismaError(error: unknown, code: string): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
  }
}
