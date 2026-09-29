const { PrismaService } = require('../dist/prisma/prisma.service');
(async () => {
  let prisma;
  const timeout = setTimeout(() => { console.error('API DB runtime: timeout'); process.exit(1); }, 10000);
  try {
    prisma = new PrismaService();
    await prisma.$queryRawUnsafe('SELECT 1');
  } catch {
    console.error('API DB runtime: conexão/query falhou');
    process.exitCode = 1;
  } finally {
    try { if (prisma) await prisma.$disconnect(); } catch { process.exitCode = 1; }
    clearTimeout(timeout);
  }
})();
