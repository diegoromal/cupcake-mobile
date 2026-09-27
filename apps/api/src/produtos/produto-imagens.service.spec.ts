import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { S3StorageService } from '../storage/s3-storage.service';
import { isManagedProductImage, ProdutoImagensService } from './produto-imagens.service';

const id = '11111111-1111-4111-8111-111111111111';
const old = `produtos/${id}/22222222-2222-4222-8222-222222222222.webp`;
const file = (buffer: Buffer, mimetype: string) => ({ buffer, mimetype, size: buffer.length }) as Express.Multer.File;

describe('ProdutoImagensService', () => {
  const findUnique = jest.fn();
  const updateMany = jest.fn();
  const put = jest.fn();
  const del = jest.fn();
  const service = new ProdutoImagensService({ produto: { findUnique, updateMany } } as unknown as PrismaService,
    { put, delete: del } as unknown as S3StorageService);
  let png: Buffer;
  let jpeg: Buffer;
  let webp: Buffer;
  beforeAll(async () => {
    const image = sharp({ create: { width: 40, height: 20, channels: 3, background: '#fa0011' } });
    png = await image.png().toBuffer();
    jpeg = await sharp(png).jpeg().toBuffer();
    webp = await sharp(png).webp().toBuffer();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    findUnique.mockResolvedValue({ imagem: old });
    updateMany.mockResolvedValue({ count: 1 });
    put.mockResolvedValue(undefined);
    del.mockResolvedValue(undefined);
  });

  it.each(['image/jpeg', 'image/png', 'image/webp'])('aceita %s e produz WebP sem upscale', async (mime) => {
    const source = mime === 'image/jpeg' ? jpeg : mime === 'image/png' ? png : webp;
    const result = await service.process(file(source, mime));
    const info = await sharp(result).metadata();
    expect(info).toMatchObject({ format: 'webp', width: 40, height: 20 });
    expect(info.exif).toBeUndefined();
  });
  it('rejeita MIME divergente, lixo, truncado e SVG', async () => {
    for (const input of [file(png, 'image/jpeg'), file(randomBytes(100), 'image/png'),
      file(jpeg.subarray(0, 30), 'image/jpeg'), file(Buffer.from('<svg/>'), 'image/svg+xml')]) {
      await expect(service.process(input)).rejects.toBeInstanceOf(BadRequestException);
    }
  });
  it('rejeita animação WebP e GIF', async () => {
    const animationGif = Buffer.from('R0lGODlhAgACAPAAAP8AAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQAAAAAACwAAAAAAgACAAACAoRRACH5BAAAAAAALAAAAAACAAIAgAAA/wAAAAIChFEAOw==', 'base64');
    const animated = await sharp(animationGif, { animated: true }).webp().toBuffer();
    await expect(service.process(file(animated, 'image/webp'))).rejects.toBeInstanceOf(BadRequestException);
    const gif = await sharp(png).gif().toBuffer();
    await expect(service.process(file(gif, 'image/gif'))).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejeita entrada maior que 10 MiB e dimensão maior que 20 MP', async () => {
    await expect(service.process(file(Buffer.alloc(10 * 1024 * 1024 + 1), 'image/png')))
      .rejects.toHaveProperty('status', 413);
    const huge = await sharp({ create: { width: 5000, height: 5000, channels: 3, background: '#fff' } }).png().toBuffer();
    await expect(service.process(file(huge, 'image/png'))).rejects.toBeInstanceOf(BadRequestException);
  });
  it('redimensiona e aplica orientação EXIF', async () => {
    const large = await sharp({ create: { width: 3200, height: 1000, channels: 3, background: '#fff' } })
      .jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const result = await sharp(await service.process(file(large, 'image/jpeg'))).metadata();
    expect(result.format).toBe('webp');
    expect(result.width).toBe(500);
    expect(result.height).toBe(1600);
    expect(result.exif).toBeUndefined();
  });
  it('rejeita saída maior que 2 MiB antes do put', async () => {
    const noise = await sharp(randomBytes(1600 * 1600 * 4), { raw: { width: 1600, height: 1600, channels: 4 } }).png().toBuffer();
    await expect(service.replace(id, file(noise, 'image/png'))).rejects.toBeInstanceOf(BadRequestException);
    expect(put).not.toHaveBeenCalled();
  });
  it('substitui e remove objeto anterior', async () => {
    const result = await service.replace(id, file(png, 'image/png'));
    expect(isManagedProductImage(result.imagem, id)).toBe(true);
    expect(put).toHaveBeenCalledWith(result.imagem, expect.any(Buffer));
    expect(updateMany).toHaveBeenCalledWith({ where: { id, imagem: old }, data: { imagem: result.imagem } });
    expect(del).toHaveBeenCalledWith(old);
  });
  it('404 para produto inexistente e 503 no storage', async () => {
    findUnique.mockResolvedValueOnce(null);
    await expect(service.replace(id, file(png, 'image/png'))).rejects.toBeInstanceOf(NotFoundException);
    put.mockRejectedValueOnce(new ServiceUnavailableException());
    await expect(service.replace(id, file(png, 'image/png'))).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it('compensa falha de banco e conflito; propaga erro original', async () => {
    updateMany.mockRejectedValueOnce(new Error('db failed')).mockResolvedValueOnce({ count: 0 });
    await expect(service.replace(id, file(png, 'image/png'))).rejects.toThrow('db failed');
    await expect(service.replace(id, file(png, 'image/png'))).rejects.toBeInstanceOf(ConflictException);
    expect(del).toHaveBeenCalledTimes(2);
    expect(del).not.toHaveBeenCalledWith(old);
  });
  it('remoção limpa referência, é idempotente e ignora legado', async () => {
    await service.remove(id);
    expect(updateMany).toHaveBeenCalledWith({ where: { id, imagem: old }, data: { imagem: null } });
    expect(del).toHaveBeenCalledWith(old);
    findUnique.mockResolvedValueOnce({ imagem: null });
    await service.remove(id);
    expect(updateMany).toHaveBeenCalledTimes(1);
    findUnique.mockResolvedValueOnce({ imagem: 'legacy.jpg' });
    await service.remove(id);
    expect(del).toHaveBeenCalledTimes(1);
  });
  it('remoção detecta corrida e não apaga objeto', async () => {
    updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.remove(id)).rejects.toBeInstanceOf(ConflictException);
    expect(del).not.toHaveBeenCalled();
  });
  it('falha ao excluir antigo não reverte DB', async () => {
    del.mockRejectedValueOnce(new Error('storage failed'));
    await expect(service.replace(id, file(png, 'image/png'))).resolves.toHaveProperty('id', id);
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
  it('reconhece apenas key gerenciada do produto', () => {
    expect(isManagedProductImage(old, id)).toBe(true);
    expect(isManagedProductImage(old, '33333333-3333-4333-8333-333333333333')).toBe(false);
    expect(isManagedProductImage(`produtos/${id}/../${id}.webp`, id)).toBe(false);
    expect(isManagedProductImage(old.replace('produtos/', 'PRODUTOS/'), id)).toBe(false);
    expect(isManagedProductImage('legacy.jpg', id)).toBe(false);
  });
});
