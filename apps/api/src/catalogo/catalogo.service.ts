import { ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { S3StorageService } from '../storage/s3-storage.service';
import { isManagedProductImage } from '../produtos/produto-imagens.service';
import { somarPrecoUnitario } from './preco-unitario';

type CatalogProductRow = {
  id: string;
  nome: string;
  precoAtual: Prisma.Decimal;
  categoriaId: string;
  categoriaNome: string;
  imagem: string | null;
};
type CatalogDetailRow = CatalogProductRow & { descricao: string | null };
type PublicOptionRow = {
  id: string; nome: string; descricao: string | null;
  disponivel: boolean; ajusteValor: Prisma.Decimal | null;
};

export const MAX_PRODUCT_IMAGE_BYTES = 2 * 1024 * 1024;
const eligibleProduct = Prisma.sql`p."ativo" = true AND e."quantidadeFisica" > e."quantidadeReservada"`;

@Injectable()
export class CatalogoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3StorageService,
  ) {}

  async list(page: number, limit: number, categoriaId?: string) {
    const offset = (page - 1) * limit;
    const rows = await this.prisma.$queryRaw<CatalogProductRow[]>(Prisma.sql`
      SELECT p."id", p."nome", p."precoAtual", p."categoriaId",
             c."nome" AS "categoriaNome", p."imagem"
      FROM "Produto" p
      INNER JOIN "Categoria" c ON c."id" = p."categoriaId"
      INNER JOIN "Estoque" e ON e."produtoId" = p."id"
      WHERE ${eligibleProduct}
        ${categoriaId ? Prisma.sql`AND p."categoriaId" = ${categoriaId}::uuid` : Prisma.empty}
      ORDER BY c."nome" ASC, c."id" ASC, p."nome" ASC, p."id" ASC
      LIMIT ${limit + 1} OFFSET ${offset}
    `);
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((row) => ({
      id: row.id,
      nome: row.nome,
      precoAtual: row.precoAtual.toFixed(2),
      categoria: { id: row.categoriaId, nome: row.categoriaNome },
      imagemDisponivel: isManagedProductImage(row.imagem, row.id),
    }));

    return { items, page, limit, hasMore };
  }

  async categories(): Promise<Array<{ id: string; nome: string }>> {
    return this.prisma.$queryRaw<Array<{ id: string; nome: string }>>(Prisma.sql`
      SELECT c."id", c."nome"
      FROM "Categoria" c
      WHERE EXISTS (
        SELECT 1 FROM "Produto" p
        INNER JOIN "Estoque" e ON e."produtoId" = p."id"
        WHERE p."categoriaId" = c."id" AND ${eligibleProduct}
      )
      ORDER BY c."nome" ASC, c."id" ASC
    `);
  }

  async detail(produtoId: string) {
    const product = await this.eligibleDetail(produtoId);
    const options = await this.options(produtoId);
    return {
      id: product.id,
      nome: product.nome,
      descricao: product.descricao,
      precoAtual: product.precoAtual.toFixed(2),
      categoria: { id: product.categoriaId, nome: product.categoriaNome },
      imagemDisponivel: isManagedProductImage(product.imagem, product.id),
      disponivel: true,
      personalizacoes: options.map((option) => ({
        id: option.id, nome: option.nome, descricao: option.descricao,
        disponivel: option.disponivel,
        ajusteValor: option.ajusteValor?.toFixed(2) ?? null,
      })),
    };
  }

  async price(produtoId: string, personalizacaoIds: string[]) {
    const product = await this.eligibleDetail(produtoId);
    if (new Set(personalizacaoIds).size !== personalizacaoIds.length) {
      throw new ConflictException('Seleção de personalizações inválida.');
    }
    const options = await this.options(produtoId);
    const selected = new Set(personalizacaoIds);
    const valid = options.filter((option) => selected.has(option.id) && option.disponivel);
    if (valid.length !== selected.size) {
      throw new ConflictException('Seleção de personalizações inválida.');
    }
    const price = somarPrecoUnitario(
      product.precoAtual,
      valid.map((option) => option.ajusteValor),
    );
    if (price.isNegative()) {
      throw new ConflictException({
        code: 'PRECO_NEGATIVO', message: 'Preço unitário negativo para a seleção.',
      });
    }
    return { precoUnitario: price.toFixed(2) };
  }

  private async options(produtoId: string): Promise<PublicOptionRow[]> {
    return this.prisma.$queryRaw<PublicOptionRow[]>(Prisma.sql`
      SELECT z."id", z."nome", z."descricao", z."disponibilidade" AS "disponivel", z."ajusteValor"
      FROM "ProdutoPersonalizacao" pp
      INNER JOIN "Personalizacao" z ON z."id" = pp."personalizacaoId"
      WHERE pp."produtoId" = ${produtoId}::uuid
      ORDER BY z."nome" ASC, z."id" ASC
    `);
  }

  private async eligibleDetail(produtoId: string): Promise<CatalogDetailRow> {
    const [product] = await this.prisma.$queryRaw<CatalogDetailRow[]>(Prisma.sql`
      SELECT p."id", p."nome", p."descricao", p."precoAtual", p."categoriaId",
             c."nome" AS "categoriaNome", p."imagem"
      FROM "Produto" p
      INNER JOIN "Categoria" c ON c."id" = p."categoriaId"
      INNER JOIN "Estoque" e ON e."produtoId" = p."id"
      WHERE p."id" = ${produtoId}::uuid AND ${eligibleProduct}
    `);
    if (!product) throw new NotFoundException('Produto indisponível.');
    return product;
  }

  async getImage(produtoId: string): Promise<Buffer> {
    const [product] = await this.prisma.$queryRaw<Array<{ imagem: string | null }>>(Prisma.sql`
      SELECT p."imagem"
      FROM "Produto" p
      INNER JOIN "Estoque" e ON e."produtoId" = p."id"
      WHERE p."id" = ${produtoId}::uuid
        AND ${eligibleProduct}
    `);
    if (!product || !isManagedProductImage(product.imagem, produtoId)) {
      throw new NotFoundException('Imagem indisponível.');
    }

    try {
      const object = await this.storage.get(product.imagem);
      if (!object.Body) throw new Error('Storage returned no body');
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of object.Body as AsyncIterable<Uint8Array>) {
        size += chunk.byteLength;
        if (size > MAX_PRODUCT_IMAGE_BYTES) {
          throw new Error('Stored image exceeds the allowed size');
        }
        chunks.push(Buffer.from(chunk));
      }
      if (size === 0) {
        throw new Error('Stored image has an invalid size');
      }
      return Buffer.concat(chunks, size);
    } catch {
      throw new ServiceUnavailableException('Imagem temporariamente indisponível.');
    }
  }
}
