import { PrismaService } from '../prisma/prisma.service';
import { isManagedProductImage } from '../produtos/produto-imagens.service';
import { S3StorageService } from '../storage/s3-storage.service';

const olderThanMs = 24 * 60 * 60 * 1000;
const safeCode = (error: unknown) => error instanceof Error ? error.name : 'UnknownError';

export async function reconcileProductImages(prisma: PrismaService, storage: S3StorageService, now = new Date()) {
  let token: string | undefined;
  do {
    const page = await storage.list('produtos/', token);
    for (const object of page.Contents ?? []) {
      const key = object.Key;
      if (!key || !object.LastModified || now.getTime() - object.LastModified.getTime() <= olderThanMs) continue;
      const productId = key.split('/')[1];
      if (!isManagedProductImage(key, productId)) continue;
      try {
        const referenced = await prisma.produto.count({ where: { id: productId, imagem: key } });
        if (referenced) continue;
        // Recheck immediately before deleting to reduce the operational race window.
        const stillReferenced = await prisma.produto.count({ where: { imagem: key } });
        if (stillReferenced) continue;
        await storage.delete(key);
        process.stdout.write(`${JSON.stringify({ produtoId: productId, key, etapa: 'reconciliacao', result: 'deleted' })}\n`);
      } catch (error) {
        process.stderr.write(`${JSON.stringify({ produtoId: productId, key, etapa: 'reconciliacao', code: safeCode(error) })}\n`);
      }
    }
    token = page.NextContinuationToken;
  } while (token);
}

async function main() {
  const prisma = new PrismaService();
  try { await reconcileProductImages(prisma, new S3StorageService()); }
  finally { await prisma.$disconnect(); }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${JSON.stringify({ etapa: 'reconciliacao-lista', code: safeCode(error) })}\n`);
    process.exitCode = 1;
  });
}
