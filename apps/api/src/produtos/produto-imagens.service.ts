import { BadRequestException, ConflictException, HttpException, Injectable, Logger, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { S3StorageService } from '../storage/s3-storage.service';

export const MAX_INPUT_BYTES = 10 * 1024 * 1024;
export const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const MAX_PIXELS = 20_000_000;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const managedPattern = new RegExp(`^produtos/(${UUID})/(${UUID})\\.webp$`, 'i');

export function isManagedProductImage(key: string | null, produtoId: string): key is string {
  const match = key?.match(managedPattern);
  return !!match && key!.startsWith('produtos/') && key!.endsWith('.webp') &&
    match[1].toLowerCase() === produtoId.toLowerCase();
}

@Injectable()
export class ProdutoImagensService {
  private readonly logger = new Logger(ProdutoImagensService.name);
  constructor(private readonly prisma: PrismaService, private readonly storage: S3StorageService) {}

  private logFailure(produtoId: string, key: string, etapa: string, error: unknown) {
    const code = error instanceof HttpException ? String(error.getStatus()) :
      error instanceof Error ? error.name : 'UnknownError';
    this.logger.error(JSON.stringify({ produtoId, key, etapa, code }));
  }

  async cleanup(produtoId: string, key: string | null, etapa: string): Promise<void> {
    if (!isManagedProductImage(key, produtoId)) return;
    try { await this.storage.delete(key); }
    catch (error) { this.logFailure(produtoId, key, etapa, error); }
  }

  async process(file?: Express.Multer.File): Promise<Buffer> {
    if (!file?.buffer) throw new BadRequestException('Envie um arquivo no campo imagem.');
    if (file.size > MAX_INPUT_BYTES || file.buffer.length > MAX_INPUT_BYTES) {
      throw new PayloadTooLargeException('Imagem excede 10 MiB.');
    }
    const types: Record<string, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
    try {
      const input = sharp(file.buffer, { failOn: 'error', animated: true, limitInputPixels: MAX_PIXELS });
      const metadata = await input.metadata();
      if (!metadata.format || types[metadata.format] !== file.mimetype ||
          !metadata.width || !metadata.height || metadata.width * metadata.height > MAX_PIXELS ||
          (metadata.pages ?? 1) !== 1) {
        throw new BadRequestException('Imagem inválida ou formato não permitido.');
      }
      const output = await sharp(file.buffer, { failOn: 'error', limitInputPixels: MAX_PIXELS })
        .rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 }).toBuffer();
      if (output.length > MAX_OUTPUT_BYTES) throw new BadRequestException('Imagem processada excede 2 MiB.');
      const result = await sharp(output, { failOn: 'error' }).metadata();
      if (result.format !== 'webp' || !result.width || !result.height ||
          result.width > 1600 || result.height > 1600 || (result.pages ?? 1) !== 1) {
        throw new BadRequestException('Imagem processada inválida.');
      }
      return output;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException('Imagem inválida ou incompleta.');
    }
  }

  async replace(produtoId: string, file?: Express.Multer.File) {
    const current = await this.prisma.produto.findUnique({ where: { id: produtoId }, select: { imagem: true } });
    if (!current) throw new NotFoundException('Produto não encontrado.');
    const output = await this.process(file);
    const key = `produtos/${produtoId}/${randomUUID()}.webp`;
    await this.storage.put(key, output);
    try {
      const changed = await this.prisma.produto.updateMany({
        where: { id: produtoId, imagem: current.imagem }, data: { imagem: key },
      });
      if (changed.count !== 1) throw new ConflictException('Imagem alterada por outra operação.');
    } catch (error) {
      await this.cleanup(produtoId, key, 'compensacao');
      throw error;
    }
    await this.cleanup(produtoId, current.imagem, 'substituicao');
    return { id: produtoId, imagem: key };
  }

  async remove(produtoId: string): Promise<void> {
    const current = await this.prisma.produto.findUnique({ where: { id: produtoId }, select: { imagem: true } });
    if (!current) throw new NotFoundException('Produto não encontrado.');
    if (current.imagem === null) return;
    const changed = await this.prisma.produto.updateMany({
      where: { id: produtoId, imagem: current.imagem }, data: { imagem: null },
    });
    if (changed.count !== 1) throw new ConflictException('Imagem alterada por outra operação.');
    await this.cleanup(produtoId, current.imagem, 'remocao');
  }
}
