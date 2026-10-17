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

  it('returns only public detail fields and a neutral 404 for missing products', async () => {
    query.mockResolvedValueOnce([{
      id: productId, nome: 'Cupcake', descricao: 'Chocolate',
      precoAtual: new Prisma.Decimal('12.30'), categoriaId: categoryId,
      categoriaNome: 'Doces', imagem: null, ativo: false,
      quantidadeFisica: 99,
    }]).mockResolvedValueOnce([]);
    await expect(service.detail(productId)).resolves.toEqual({
      id: productId, nome: 'Cupcake', descricao: 'Chocolate', precoAtual: '12.30',
      categoria: { id: categoryId, nome: 'Doces' }, imagemDisponivel: false,
      disponivel: true,
    });
    expect(query.mock.calls[0][0].strings.join('')).toMatch(/INNER JOIN "Estoque".*quantidadeFisica.*quantidadeReservada/s);
    await expect(service.detail(productId)).rejects.toMatchObject({
      response: { message: 'Produto indisponível.' },
    });
  });

  it('supports null description and a managed image', async () => {
    query.mockResolvedValue([{
      id: productId, nome: 'Cupcake', descricao: null,
      precoAtual: new Prisma.Decimal('0.90'), categoriaId: categoryId,
      categoriaNome: 'Doces',
      imagem: `produtos/${productId}/22222222-2222-4222-8222-222222222222.webp`,
    }]);
    await expect(service.detail(productId)).resolves.toMatchObject({
      descricao: null, precoAtual: '0.90', imagemDisponivel: true,
    });
  });

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

  it('filters before ordering and pagination and returns only eligible category fields', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { id: categoryId, nome: 'Doces' },
    ]);
    await expect(service.list(2, 3, categoryId)).resolves.toEqual({
      items: [], page: 2, limit: 3, hasMore: false,
    });
    const sql = query.mock.calls[0][0];
    expect(sql.values).toEqual([categoryId, 4, 3]);
    expect(sql.strings.join('')).toMatch(/categoriaId.*ORDER BY.*LIMIT.*OFFSET/s);
    await expect(service.categories()).resolves.toEqual([{ id: categoryId, nome: 'Doces' }]);
    const categoriesSql = query.mock.calls[1][0].strings.join('');
    expect(categoriesSql).toMatch(/WHERE EXISTS.*quantidadeFisica.*quantidadeReservada.*ORDER BY/s);
    expect(categoriesSql).toContain('c."nome" ASC, c."id" ASC');
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
