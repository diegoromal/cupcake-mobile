import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { arch, platform, release } from 'node:os';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaClient } from '../src/generated/prisma/client';
import { PerfilUsuario } from '../src/generated/prisma/enums';

function validateUrl(value: string) {
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      (url.port && url.port !== '5432') || url.pathname !== '/cupcake_d29' ||
      [...url.searchParams].some(([key, content]) => key !== 'schema' || content !== 'public')) {
    throw new Error('D29 exige banco PostgreSQL local dedicado cupcake_d29 e schema public.');
  }
}

async function main() {
  const url = process.env.D29_TEST_DATABASE_URL;
  if (!url) throw new Error('Defina D29_TEST_DATABASE_URL para PostgreSQL local dedicado cupcake_d29.');
  validateUrl(url);
  process.env.DATABASE_URL = url;
  process.env.JWT_ACCESS_SECRET = `d29-access-${randomUUID()}`;
  process.env.JWT_REFRESH_SECRET = `d29-refresh-${randomUUID()}`;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const marker = `D29-${randomUUID()}`;
  const password = randomUUID();
  const categoryIds: string[] = [];
  const productIds: string[] = [];
  let userId: string | undefined;
  let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;
  try {
    const [db] = await prisma.$queryRawUnsafe<Array<{ database: string; schema: string }>>(
      'SELECT current_database() AS database, current_schema() AS schema');
    assert.deepEqual(db, { database: 'cupcake_d29', schema: 'public' });
    const expectedMigrations = readdirSync(resolve(__dirname, '../prisma/migrations'))
      .filter((name) => /^\d+_/.test(name));
    const migrations = await prisma.$queryRawUnsafe<Array<{
      migration_name: string; finished_at: Date | null; rolled_back_at: Date | null;
    }>>('SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"');
    for (const migrationName of expectedMigrations) {
      assert(migrations.some((migration) => migration.migration_name === migrationName &&
        migration.finished_at !== null && migration.rolled_back_at === null), `Migration pendente: ${migrationName}`);
    }
    assert(migrations.every((migration) => migration.finished_at !== null || migration.rolled_back_at !== null),
      'Há migration incompleta no banco D29.');

    userId = (await prisma.usuario.create({ data: {
      nome: `${marker} cliente`, email: `${marker.toLowerCase()}@example.test`, telefone: '00000000000',
      credencialSenha: await argon2.hash(password), perfil: PerfilUsuario.CLIENTE,
    } })).id;
    for (const name of [`${marker} A`, `${marker} B`, `${marker} C`]) {
      categoryIds.push((await prisma.categoria.create({ data: { nome: name } })).id);
    }

    const records: Array<{ id: string; name: string; category: number; active: boolean; physical: number; reserved: number; stock: boolean }> = [];
    for (let index = 0; index < 120; index++) records.push({
      id: randomUUID(), name: `${marker} item ${String(index).padStart(3, '0')}`,
      category: index % 3, active: index % 17 !== 0, physical: 5, reserved: index % 11 === 0 ? 5 : 1, stock: index % 19 !== 0,
    });
    records.push({ id: randomUUID(), name: `${marker} inativo`, category: 0, active: false, physical: 5, reserved: 0, stock: true });
    records.push({ id: randomUUID(), name: `${marker} sem saldo`, category: 0, active: true, physical: 0, reserved: 0, stock: true });
    records.push({ id: randomUUID(), name: `${marker} totalmente reservado`, category: 0, active: true, physical: 5, reserved: 5, stock: true });
    records.push({ id: randomUUID(), name: `${marker} sem estoque`, category: 0, active: true, physical: 5, reserved: 0, stock: false });
    productIds.push(...records.map(({ id }) => id));
    await prisma.produto.createMany({ data: records.map((row) => ({
      id: row.id, categoriaId: categoryIds[row.category], nome: row.name,
      precoAtual: '12.30', ativo: row.active,
    })) });
    await prisma.estoque.createMany({ data: records.filter((row) => row.stock).map((row) => ({
      produtoId: row.id, quantidadeFisica: row.physical, quantidadeReservada: row.reserved,
    })) });

    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    const http = app.getHttpServer();
    const login = await request(http).post('/auth/login').send({
      email: `${marker.toLowerCase()}@example.test`, senha: password,
    }).expect(200);
    const auth = `Bearer ${login.body.accessToken}`;
    const eligible = records.filter((row) => row.active && row.stock && row.physical > row.reserved)
      .sort((a, b) => a.category - b.category || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    const collected: string[] = [];
    const pageSize = 13;
    for (let page = 1; page <= Math.ceil(eligible.length / pageSize); page++) {
      const result = await request(http).get(`/catalogo/produtos?page=${page}&limit=${pageSize}`)
        .set('Authorization', auth).expect(200);
      assert.equal(result.body.page, page);
      assert.equal(result.body.limit, pageSize);
      assert.equal(result.body.items.length, Math.min(pageSize, eligible.length - (page - 1) * pageSize));
      assert.equal(result.body.hasMore, page * pageSize < eligible.length);
      const expected = eligible.slice((page - 1) * pageSize, page * pageSize);
      assert.deepEqual(result.body.items.map((item: { id: string }) => item.id), expected.map((row) => row.id));
      assert(result.body.items.every((item: { id: string; precoAtual: string; imagemDisponivel: boolean }) =>
        item.precoAtual === '12.30' && item.imagemDisponivel === false && !('estoque' in item) && !('imagem' in item)));
      collected.push(...result.body.items.map((item: { id: string }) => item.id));
    }
    assert.equal(new Set(collected).size, collected.length, 'IDs duplicados entre páginas');
    assert.deepEqual(collected, eligible.map(({ id }) => id), 'perda ou ordem instável');
    assert.equal((await request(http).get('/catalogo/produtos?page=1&limit=13').set('Authorization', auth).expect(200)).body.items.length, 13);
    process.stdout.write(`PASS D29 PostgreSQL: ${eligible.length} elegíveis, ${records.length} fixture, páginas 1/intermediária/final, filtro/ordem/hasMore/sem duplicação.\n`);
    if (process.argv.includes('--measure')) {
      const samples: number[] = [];
      for (let sample = 0; sample < 10; sample++) {
        const start = performance.now();
        await request(http).get(`/catalogo/produtos?page=1&limit=${pageSize}`)
          .set('Authorization', auth).expect(200);
        samples.push(Number((performance.now() - start).toFixed(2)));
      }
      process.stdout.write(`${JSON.stringify({
        type: 'D29_PERFORMANCE_PARTIAL', environment: { platform: platform(), release: release(), arch: arch(), node: process.version },
        dataset: { fixtureProducts: records.length, eligibleProducts: eligible.length, pageLimit: pageSize },
        images: { count: 0, bytes: 0 }, apiHttpRoundTripMs: samples,
        mobileResponseProcessMs: null, firstUsablePresentationMs: null, totalObservedMs: null,
        resultAtThreeSeconds: 'NOT_EVALUATED: mobile first usable presentation and image loading are not measured by this API harness',
      })}\n`);
    }
  } finally {
    if (app) await app.close();
    await prisma.estoque.deleteMany({ where: { produtoId: { in: productIds } } });
    await prisma.produto.deleteMany({ where: { id: { in: productIds } } });
    await prisma.categoria.deleteMany({ where: { id: { in: categoryIds } } });
    if (userId) await prisma.usuario.deleteMany({ where: { id: userId } });
    assert.equal(await prisma.estoque.count({ where: { produtoId: { in: productIds } } }), 0);
    assert.equal(await prisma.produto.count({ where: { id: { in: productIds } } }), 0);
    assert.equal(await prisma.categoria.count({ where: { id: { in: categoryIds } } }), 0);
    if (userId) assert.equal(await prisma.usuario.count({ where: { id: userId } }), 0);
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Falha na integração PostgreSQL D29: ${error instanceof Error ? error.message : 'erro inesperado'}\n`);
  process.exitCode = 1;
});
