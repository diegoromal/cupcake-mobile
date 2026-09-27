import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import sharp from 'sharp';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProdutoImagensService, isManagedProductImage } from '../src/produtos/produto-imagens.service';
import { ProdutosService } from '../src/produtos/produtos.service';
import { S3StorageService } from '../src/storage/s3-storage.service';
import { reconcileProductImages } from '../src/scripts/reconcile-product-images';

async function main() {
  const url = process.env.D21_TEST_DATABASE_URL;
  if (!url) throw new Error('D21_TEST_DATABASE_URL obrigatória.');
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname) || parsed.pathname !== '/cupcake_d21') {
    throw new Error('Teste integrado limitado ao banco local cupcake_d21.');
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const storage = new S3StorageService();
  const images = new ProdutoImagensService(prisma as unknown as PrismaService, storage);
  const products = new ProdutosService(prisma as unknown as PrismaService, images);
  const category = await prisma.categoria.create({ data: { nome: `D21 ${Date.now()}` } });
  const ids: string[] = [];
  const reconciliationKeys: string[] = [];
  let checks = 0;
  const makeProduct = async () => {
    const product = await products.create({ categoriaId: category.id, nome: `Imagem ${ids.length}`, precoAtual: '1.00' });
    ids.push(product.id); return product.id;
  };
  const file = (buffer: Buffer) => ({ buffer, size: buffer.length, mimetype: 'image/png' }) as Express.Multer.File;
  const small = await sharp({ create: { width: 80, height: 40, channels: 3, background: '#f00' } })
    .png().withMetadata({ orientation: 6 }).toBuffer();
  const large = await sharp({ create: { width: 3000, height: 1000, channels: 3, background: '#00f' } }).png().toBuffer();
  try {
    const id = await makeProduct();
    const first = await images.replace(id, file(small));
    assert(isManagedProductImage(first.imagem, id)); checks++;
    assert.equal((await prisma.produto.findUniqueOrThrow({ where: { id } })).imagem, first.imagem); checks++;
    const object = await storage.get(first.imagem);
    assert.equal(object.ContentType, 'image/webp'); checks++;
    const bytes = Buffer.from(await object.Body!.transformToByteArray());
    const meta = await sharp(bytes).metadata();
    assert.equal(meta.format, 'webp'); checks++;
    assert.equal(meta.width, 40); assert.equal(meta.height, 80); checks += 2;
    assert.equal(meta.exif, undefined); checks++;
    assert(bytes.length <= 2 * 1024 * 1024); checks++;
    const second = await images.replace(id, file(large));
    assert.notEqual(second.imagem, first.imagem); checks++;
    assert.equal((await prisma.produto.findUniqueOrThrow({ where: { id } })).imagem, second.imagem); checks++;
    assert.equal((await sharp(Buffer.from(await (await storage.get(second.imagem)).Body!.transformToByteArray())).metadata()).width, 1600); checks++;
    await assert.rejects(storage.head(first.imagem)); checks++;
    await images.remove(id);
    assert.equal((await prisma.produto.findUniqueOrThrow({ where: { id } })).imagem, null); checks++;
    await assert.rejects(storage.head(second.imagem)); checks++;
    await images.remove(id); checks++;

    const compensated = await images.replace(id, file(small));
    let newKey = '';
    const broken = ({ produto: {
      findUnique: prisma.produto.findUnique.bind(prisma.produto),
      updateMany: async (args: { data: { imagem?: string | null } }) => {
        newKey = String(args.data.imagem);
        throw new Error('forced DB failure');
      },
    } }) as unknown as PrismaService;
    const failing = new ProdutoImagensService(broken, storage);
    await assert.rejects(failing.replace(id, file(large)), /forced DB failure/); checks++;
    assert.equal((await prisma.produto.findUniqueOrThrow({ where: { id } })).imagem, compensated.imagem); checks++;
    await assert.rejects(storage.head(newKey)); checks++;

    const raceId = await makeProduct();
    const [a, b] = await Promise.allSettled([images.replace(raceId, file(small)), images.replace(raceId, file(large))]);
    assert.equal([a, b].filter((x) => x.status === 'fulfilled').length, 1); checks++;
    assert.equal([a, b].filter((x) => x.status === 'rejected').length, 1); checks++;
    const winner = [a, b].find((x) => x.status === 'fulfilled') as PromiseFulfilledResult<{ imagem: string }>;
    assert.equal((await prisma.produto.findUniqueOrThrow({ where: { id: raceId } })).imagem, winner.value.imagem); checks++;
    await storage.head(winner.value.imagem); checks++;
    const raceObjects = await storage.list(`produtos/${raceId}/`);
    assert.deepEqual(raceObjects.Contents?.map((object) => object.Key), [winner.value.imagem]); checks++;

    await products.remove(id);
    await assert.rejects(storage.head(compensated.imagem)); checks++;
    assert.equal(await prisma.produto.findUnique({ where: { id } }), null); checks++;
    ids.splice(ids.indexOf(id), 1);
    const failedDeleteId = await makeProduct();
    const failedDeleteImage = await images.replace(failedDeleteId, file(small));
    const unavailable = new ProdutoImagensService(prisma as unknown as PrismaService, {
      delete: async () => { throw new Error('forced storage failure'); },
    } as unknown as S3StorageService);
    const productWithFailedCleanup = new ProdutosService(prisma as unknown as PrismaService, unavailable);
    await productWithFailedCleanup.remove(failedDeleteId);
    assert.equal(await prisma.produto.findUnique({ where: { id: failedDeleteId } }), null); checks++;
    await storage.head(failedDeleteImage.imagem); checks++;
    await storage.delete(failedDeleteImage.imagem);
    ids.splice(ids.indexOf(failedDeleteId), 1);

    const threshold = 24 * 60 * 60 * 1000;
    const putForReconciliation = async (productId: string) => {
      const key = `produtos/${productId}/${randomUUID()}.webp`;
      await storage.put(key, Buffer.from('reconciliation test'));
      reconciliationKeys.push(key);
      const lastModified = (await storage.list(`produtos/${productId}/`)).Contents?.find((object) => object.Key === key)?.LastModified;
      assert(lastModified);
      return { key, lastModified };
    };
    const reconcileAtAge = async (lastModified: Date, ageMs: number) =>
      reconcileProductImages(prisma as unknown as PrismaService, storage, new Date(lastModified.getTime() + ageMs));

    const orphan = await putForReconciliation(randomUUID());
    assert.equal(await prisma.produto.count({ where: { imagem: orphan.key } }), 0); checks++;
    await reconcileAtAge(orphan.lastModified, threshold + 1);
    await assert.rejects(storage.head(orphan.key)); checks++;

    const referencedId = await makeProduct();
    const referenced = await putForReconciliation(referencedId);
    await prisma.produto.update({ where: { id: referencedId }, data: { imagem: referenced.key } });
    await reconcileAtAge(referenced.lastModified, threshold + 1);
    await storage.head(referenced.key); checks++;
    assert.equal((await prisma.produto.findUniqueOrThrow({ where: { id: referencedId } })).imagem, referenced.key); checks++;

    const recent = await putForReconciliation(randomUUID());
    await reconcileAtAge(recent.lastModified, threshold - 1);
    await storage.head(recent.key); checks++;
    await storage.delete(recent.key);

    const boundary = await putForReconciliation(randomUUID());
    await reconcileAtAge(boundary.lastModified, threshold);
    await storage.head(boundary.key); checks++;
    process.stdout.write(`PASS PostgreSQL + S3Mock D21: ${checks} verificações\n`);
  } finally {
    for (const key of reconciliationKeys) await storage.delete(key);
    for (const product of await prisma.produto.findMany({ where: { id: { in: ids } }, select: { id: true, imagem: true } })) {
      if (isManagedProductImage(product.imagem, product.id)) await storage.delete(product.imagem);
    }
    await prisma.estoque.deleteMany({ where: { produtoId: { in: ids } } });
    await prisma.produto.deleteMany({ where: { id: { in: ids } } });
    await prisma.categoria.delete({ where: { id: category.id } });
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`Falha no teste integrado D21: ${error instanceof Error ? error.message : 'erro'}\n`);
  process.exitCode = 1;
});
