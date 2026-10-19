import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { S3StorageService } from '../storage/s3-storage.service';
import { CatalogoService } from './catalogo.service';

describe('CatalogoService price preview', () => {
  const query = jest.fn();
  const service = new CatalogoService(
    { $queryRaw: query } as unknown as PrismaService,
    {} as S3StorageService,
  );
  const product = { id: '11111111-1111-4111-8111-111111111111', nome: 'Bolo',
    descricao: null, precoAtual: new Prisma.Decimal('10.00'),
    categoriaId: '22222222-2222-4222-8222-222222222222',
    categoriaNome: 'Doces', imagem: 'private-key' };
  const option = (id: string, adjustment: string | null, available = true) => ({
    id, nome: id, descricao: null, disponivel: available,
    ajusteValor: adjustment === null ? null : new Prisma.Decimal(adjustment),
    estoque: 999,
  });
  const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const c = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  beforeEach(() => query.mockReset());

  it('projects only public fields, including null and zero adjustments', async () => {
    query.mockResolvedValueOnce([product]).mockResolvedValueOnce([
      option(a, null), option(b, '0.00'), option(c, '-1.50', false),
    ]);
    const detail = await service.detail(product.id);
    expect(detail.personalizacoes).toEqual([
      { id: a, nome: a, descricao: null, disponivel: true, ajusteValor: null },
      { id: b, nome: b, descricao: null, disponivel: true, ajusteValor: '0.00' },
      { id: c, nome: c, descricao: null, disponivel: false, ajusteValor: '-1.50' },
    ]);
    expect(JSON.stringify(detail)).not.toMatch(/estoque|private-key|quantidade|imagem"/);
    expect(query.mock.calls[1][0].strings.join('')).toContain('ORDER BY z."nome" ASC, z."id" ASC');
  });

  it('uses exact decimal arithmetic and ignores ID order', async () => {
    const options = [option(a, '0.10'), option(b, '-0.20'), option(c, null)];
    query.mockResolvedValueOnce([product]).mockResolvedValueOnce(options)
      .mockResolvedValueOnce([product]).mockResolvedValueOnce(options);
    await expect(service.price(product.id, [a, b, c])).resolves.toEqual({ precoUnitario: '9.90' });
    await expect(service.price(product.id, [c, b, a])).resolves.toEqual({ precoUnitario: '9.90' });
  });

  it('accepts zero and rejects negative unit prices', async () => {
    query.mockResolvedValueOnce([product]).mockResolvedValueOnce([option(a, '-10.00')])
      .mockResolvedValueOnce([product]).mockResolvedValueOnce([option(a, '-10.01')]);
    await expect(service.price(product.id, [a])).resolves.toEqual({ precoUnitario: '0.00' });
    await expect(service.price(product.id, [a])).rejects.toMatchObject({
      response: { code: 'PRECO_NEGATIVO' },
    });
  });

  it('rejects duplicates, unlinked and unavailable options', async () => {
    query.mockResolvedValueOnce([product]);
    await expect(service.price(product.id, [a, a])).rejects.toBeInstanceOf(ConflictException);
    query.mockResolvedValueOnce([product]).mockResolvedValueOnce([]);
    await expect(service.price(product.id, [a])).rejects.toBeInstanceOf(ConflictException);
    query.mockResolvedValueOnce([product]).mockResolvedValueOnce([option(a, '1.00', false)]);
    await expect(service.price(product.id, [a])).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns neutral 404 for ineligible product', async () => {
    query.mockResolvedValueOnce([]);
    await expect(service.price(product.id, [])).rejects.toBeInstanceOf(NotFoundException);
  });
});
