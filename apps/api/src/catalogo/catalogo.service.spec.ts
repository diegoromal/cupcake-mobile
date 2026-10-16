import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { S3StorageService } from '../storage/s3-storage.service';
import { CatalogoService } from './catalogo.service';

describe('CatalogoService', () => {
  const query = jest.fn();
  const get = jest.fn();
  const service = new CatalogoService(
    { $queryRaw: query } as unknown as PrismaService,
    { get } as unknown as S3StorageService,
  );
  const productId = '9b72c770-bc74-4c77-82c7-205c2d91628a';
  const categoryId = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => jest.clearAllMocks());

  it('returns the safe paged DTO, formats decimal price, and uses limit+1', async () => {
    query.mockResolvedValue([{
      id: productId, nome: 'Cupcake', precoAtual: new Prisma.Decimal('12.50'),
      categoriaId: categoryId, categoriaNome: 'Doces', imagem: `produtos/${productId}/22222222-2222-4222-8222-222222222222.webp`,
    }, {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', nome: 'Extra', precoAtual: new Prisma.Decimal('1.00'),
      categoriaId: categoryId, categoriaNome: 'Doces', imagem: 'private-key',
    }]);

    await expect(service.list(2, 1)).resolves.toEqual({
      items: [{
        id: productId, nome: 'Cupcake', precoAtual: '12.50',
        categoria: { id: categoryId, nome: 'Doces' }, imagemDisponivel: true,
      }], page: 2, limit: 1, hasMore: true,
    });
    expect(query.mock.calls[0][0].values).toEqual([2, 1]);
  });

  it('resolves only managed product images and enforces the output size', async () => {
    query.mockResolvedValueOnce([{ imagem: `produtos/${productId}/22222222-2222-4222-8222-222222222222.webp` }]);
    const bytes = Buffer.from('webp');
    get.mockResolvedValue({ Body: (async function* () { yield bytes; })() });
    await expect(service.getImage(productId)).resolves.toEqual(bytes);
    expect(get).toHaveBeenCalledWith(`produtos/${productId}/22222222-2222-4222-8222-222222222222.webp`);

    query.mockResolvedValueOnce([{ imagem: 'legacy/private/key' }]);
    await expect(service.getImage(productId)).rejects.toBeInstanceOf(NotFoundException);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('hides missing, unavailable, and oversized storage objects behind safe responses', async () => {
    query.mockResolvedValueOnce([]);
    await expect(service.getImage(productId)).rejects.toBeInstanceOf(NotFoundException);
    query.mockResolvedValueOnce([{ imagem: `produtos/${productId}/22222222-2222-4222-8222-222222222222.webp` }]);
    get.mockRejectedValue(new Error('secret endpoint details'));
    await expect(service.getImage(productId)).rejects.toBeInstanceOf(ServiceUnavailableException);
    query.mockResolvedValueOnce([{ imagem: `produtos/${productId}/22222222-2222-4222-8222-222222222222.webp` }]);
    get.mockResolvedValue({ Body: (async function* () { yield Buffer.alloc(2 * 1024 * 1024 + 1); })() });
    await expect(service.getImage(productId)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
