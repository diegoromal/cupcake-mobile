import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { S3StorageService } from '../storage/s3-storage.service';
import { isManagedProductImage } from '../produtos/produto-imagens.service';

type CatalogProductRow = {
  id: string;
  nome: string;
  precoAtual: Prisma.Decimal;
  categoriaId: string;
  categoriaNome: string;
  imagem: string | null;
};

export const MAX_PRODUCT_IMAGE_BYTES = 2 * 1024 * 1024;

@Injectable()
export class CatalogoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3StorageService,
  ) {}

  async list(page: number, limit: number) {
    const offset = (page - 1) * limit;
    const rows = await this.prisma.$queryRaw<CatalogProductRow[]>(Prisma.sql`
      SELECT p."id", p."nome", p."precoAtual", p."categoriaId",
             c."nome" AS "categoriaNome", p."imagem"
      FROM "Produto" p
      INNER JOIN "Categoria" c ON c."id" = p."categoriaId"
      INNER JOIN "Estoque" e ON e."produtoId" = p."id"
      WHERE p."ativo" = true AND e."quantidadeFisica" > e."quantidadeReservada"
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

  async getImage(produtoId: string): Promise<Buffer> {
    const [product] = await this.prisma.$queryRaw<Array<{ imagem: string | null }>>(Prisma.sql`
      SELECT p."imagem"
      FROM "Produto" p
      INNER JOIN "Estoque" e ON e."produtoId" = p."id"
      WHERE p."id" = ${produtoId}::uuid
        AND p."ativo" = true
        AND e."quantidadeFisica" > e."quantidadeReservada"
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
