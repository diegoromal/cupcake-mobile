import { PrismaService } from '../prisma/prisma.service';
import { S3StorageService } from '../storage/s3-storage.service';
import { reconcileProductImages } from './reconcile-product-images';

const id = '11111111-1111-4111-8111-111111111111';
const key = `produtos/${id}/22222222-2222-4222-8222-222222222222.webp`;
const now = new Date('2026-09-27T12:00:00Z');
const old = new Date(now.getTime() - 25 * 60 * 60 * 1000);

describe('reconcileProductImages', () => {
  const list = jest.fn();
  const del = jest.fn();
  const count = jest.fn();
  const storage = { list, delete: del } as unknown as S3StorageService;
  const prisma = { produto: { count } } as unknown as PrismaService;
  beforeEach(() => { jest.clearAllMocks(); del.mockResolvedValue(undefined); count.mockResolvedValue(0); });

  it('remove apenas key gerenciada antiga e órfã, com segunda consulta', async () => {
    list.mockResolvedValue({ Contents: [
      { Key: key, LastModified: old },
      { Key: `produtos/${id}/legacy.jpg`, LastModified: old },
      { Key: `produtos/${id}/33333333-3333-4333-8333-333333333333.webp`, LastModified: now },
    ] });
    await reconcileProductImages(prisma, storage, now);
    expect(count).toHaveBeenCalledTimes(2);
    expect(del).toHaveBeenCalledWith(key);
    expect(del).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledWith('produtos/', undefined);
  });
  it('preserva órfão com exatamente 24 horas', async () => {
    list.mockResolvedValue({ Contents: [{ Key: key, LastModified: new Date(now.getTime() - 24 * 60 * 60 * 1000) }] });
    await reconcileProductImages(prisma, storage, now);
    expect(count).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });
  it('preserva referências e continua após erro individual', async () => {
    const other = `produtos/${id}/44444444-4444-4444-8444-444444444444.webp`;
    const third = `produtos/${id}/55555555-5555-4555-8555-555555555555.webp`;
    list.mockResolvedValue({ Contents: [
      { Key: key, LastModified: old }, { Key: other, LastModified: old },
      { Key: third, LastModified: old },
    ] });
    count.mockResolvedValueOnce(1).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    del.mockRejectedValueOnce(new Error('offline'));
    await reconcileProductImages(prisma, storage, now);
    expect(del).toHaveBeenCalledTimes(2);
    expect(del).toHaveBeenCalledWith(other);
    expect(del).toHaveBeenCalledWith(third);
  });
});
