import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { inspect } from 'node:util';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaClient } from '../src/generated/prisma/client';
import { PerfilUsuario } from '../src/generated/prisma/enums';

function validateDatabaseUrl(url: string) {
  const authority = url.match(/^postgres(?:ql)?:\/\/([^/?#]*)/i)?.[1];
  const hostAndPort = authority?.slice(authority.lastIndexOf('@') + 1);
  if (!hostAndPort || !/^(?:localhost|127\.0\.0\.1)(?::5432)?$/i.test(hostAndPort)) {
    throw new Error('D25 exige PostgreSQL local no banco dedicado cupcake_d25 (schema public).');
  }
  const parsed = new URL(url);
  const allowedParameters = new Set(['schema']);
  if (!['postgresql:', 'postgres:'].includes(parsed.protocol) ||
      !['localhost', '127.0.0.1'].includes(parsed.hostname) ||
      (parsed.port !== '' && parsed.port !== '5432') ||
      parsed.pathname !== '/cupcake_d25' || parsed.hash ||
      [...parsed.searchParams].some(([key, value]) =>
        !allowedParameters.has(key) || value !== 'public') ||
      parsed.searchParams.getAll('schema').length > 1) {
    throw new Error('D25 exige PostgreSQL local no banco dedicado cupcake_d25 (schema public).');
  }
}

function checkUrlGuard() {
  const base = 'postgresql://localhost:5432/cupcake_d25';
  const allowed = [
    'postgresql://localhost/cupcake_d25', base,
    'postgresql://127.0.0.1/cupcake_d25',
    'postgresql://127.0.0.1:5432/cupcake_d25',
    'postgresql://user:p%40ss%3Aword@localhost/cupcake_d25',
    'postgresql://user:p%40ss%3Aword@127.0.0.1:5432/cupcake_d25',
    'postgres://localhost/cupcake_d25',
  ];
  for (const url of [...allowed, ...allowed.map((value) => `${value}?schema=public`)]) {
    assert.doesNotThrow(() => validateDatabaseUrl(url), url);
  }
  for (const url of [
    'postgresql://localhost:05432/cupcake_d25',
    'postgresql://user:p%40ss%3Aword@localhost:05432/cupcake_d25?schema=public',
    'postgresql://localhost:005432/cupcake_d25',
    'postgresql://127.0.0.1:005432/cupcake_d25',
    'postgresql://localhost:54320/cupcake_d25',
    'postgresql://localhost:/cupcake_d25',
    'postgresql://localhost:+5432/cupcake_d25',
    'postgresql://localhost:5432x/cupcake_d25',
    'postgresql://localhost:5433/cupcake_d25',
    'postgresql://127.0.0.1:5433/cupcake_d25',
    'postgresql://localhost:5434/cupcake_d25',
    'postgresql://[::1]/cupcake_d25',
    'postgresql://localhost/cupcake_other', 'postgresql://example.com/cupcake_d25',
    `${base}?host=example.com`, `${base}?hostaddr=203.0.113.1`,
    `${base}?port=5433`, `${base}?socketPath=/tmp/other.sock`,
    `${base}?sslmode=require`, `${base}?service=other`,
    `${base}?options=-c%20search_path%3Dother`, `${base}?unknown=value`,
    `${base}?schema=other`, `${base}?schema=public&schema=public`,
  ]) {
    assert.throws(() => validateDatabaseUrl(url), /D25 exige PostgreSQL local/, url);
  }
  process.stdout.write('PASS D25: guarda de URL aceita apenas endpoint local e schema public\n');
}

function formatError(error: unknown, indentation = ''): string {
  if (error instanceof AggregateError) {
    const detail = (error.stack ?? error.message).split('\n')
      .map((line) => `${indentation}${line}`).join('\n');
    return `${detail}\n${error.errors
      .map((cause: unknown, index: number) =>
        `${indentation}  Causa ${index + 1}:\n${formatError(cause, `${indentation}    `)}`)
      .join('\n')}`;
  }
  if (error instanceof Error) {
    const detail = (error.stack ?? error.message).split('\n')
      .map((line) => `${indentation}${line}`).join('\n');
    return error.cause === undefined ? detail :
      `${detail}\n${indentation}  Causado por:\n${formatError(error.cause, `${indentation}    `)}`;
  }
  return `${indentation}${inspect(error)}`;
}

async function main() {
  const url = process.env.D25_TEST_DATABASE_URL;
  if (!url) throw new Error('D25_TEST_DATABASE_URL é obrigatória.');
  validateDatabaseUrl(url);

  process.env.DATABASE_URL = url;
  process.env.JWT_ACCESS_SECRET = `d25-access-${randomUUID()}`;
  process.env.JWT_REFRESH_SECRET = `d25-refresh-${randomUUID()}`;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  let app: INestApplication | undefined;
  const ids: { admin?: string; categoria?: string; personalizacao?: string; produto?: string } = {};
  const marker = `D25-${randomUUID()}`;
  let failed: unknown;

  try {
    const [{ database, schema }] = await prisma.$queryRawUnsafe<Array<{ database: string; schema: string }>>(
      'SELECT current_database() AS database, current_schema() AS schema',
    );
    assert.equal(database, 'cupcake_d25');
    assert.equal(schema, 'public');
    const expected = readdirSync(resolve(__dirname, '../prisma/migrations'))
      .filter((name) => /^\d+_/.test(name));
    const migrations = await prisma.$queryRawUnsafe<Array<{
      migration_name: string; finished_at: Date | null; rolled_back_at: Date | null;
    }>>('SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"');
    for (const name of expected) {
      assert(migrations.some((row) => row.migration_name === name &&
        row.finished_at !== null && row.rolled_back_at === null), `Migration pendente: ${name}`);
    }
    assert(migrations.every((row) => row.finished_at !== null || row.rolled_back_at !== null),
      'Há migration incompleta no banco D25.');

    const email = `${marker.toLowerCase()}@example.test`;
    const senha = randomUUID();
    ids.admin = (await prisma.usuario.create({ data: {
      nome: `${marker} ADMIN`, email, telefone: '00000000000',
      credencialSenha: await argon2.hash(senha), perfil: PerfilUsuario.ADMIN,
    } })).id;
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    const http = app.getHttpServer();
    const login = await request(http).post('/auth/login').send({ email, senha }).expect(200);
    assert.equal(typeof login.body.accessToken, 'string');
    const auth = `Bearer ${login.body.accessToken}`;

    const category = await request(http).post('/admin/categorias').set('Authorization', auth)
      .send({ nome: `${marker} Categoria`, descricao: 'Categoria do fluxo D25' }).expect(201);
    ids.categoria = category.body.id;
    assert.match(ids.categoria!, /^[0-9a-f-]{36}$/i);
    assert.equal(category.body.nome, `${marker} Categoria`);
    assert.equal(category.body.descricao, 'Categoria do fluxo D25');

    const option = await request(http).post('/admin/personalizacoes').set('Authorization', auth)
      .send({ nome: `${marker} Cobertura`, ajusteValor: '2.35', disponibilidade: true }).expect(201);
    ids.personalizacao = option.body.id;
    assert.match(ids.personalizacao!, /^[0-9a-f-]{36}$/i);
    assert.equal(option.body.nome, `${marker} Cobertura`);
    assert.equal(option.body.ajusteValor, '2.35');
    assert.equal(option.body.disponibilidade, true);

    const created = await request(http).post('/admin/produtos').set('Authorization', auth)
      .send({ categoriaId: ids.categoria, nome: `${marker} Cupcake`,
        descricao: 'Produto do fluxo D25', precoAtual: '12.30', ativo: true }).expect(201);
    ids.produto = created.body.id;
    assert.match(ids.produto!, /^[0-9a-f-]{36}$/i);
    assert.equal(created.body.categoriaId, ids.categoria);
    assert.equal(created.body.precoAtual, '12.30');
    assert.equal(created.body.ativo, true);
    const productPath = `/admin/produtos/${ids.produto}`;
    const found = await request(http).get(productPath).set('Authorization', auth).expect(200);
    assert.deepEqual(found.body, created.body);

    const stockPath = `${productPath}/estoque`;
    const initial = await request(http).get(stockPath).set('Authorization', auth).expect(200);
    assert.deepEqual(initial.body, { produtoId: ids.produto, quantidadeFisica: 0,
      quantidadeReservada: 0, quantidadeDisponivel: 0 });

    const linkPath = `${productPath}/personalizacoes`;
    const linked = await request(http).post(linkPath).set('Authorization', auth)
      .send({ personalizacaoId: ids.personalizacao }).expect(201);
    assert.deepEqual(linked.body, { produtoId: ids.produto, personalizacaoId: ids.personalizacao });
    const options = await request(http).get(linkPath).set('Authorization', auth).expect(200);
    assert.deepEqual(options.body, [option.body]);

    const adjusted = await request(http).patch(stockPath).set('Authorization', auth)
      .send({ quantidadeDisponivel: 7 }).expect(200);
    assert.deepEqual(adjusted.body, { produtoId: ids.produto, quantidadeFisica: 7,
      quantidadeReservada: 0, quantidadeDisponivel: 7 });
    const current = await request(http).get(stockPath).set('Authorization', auth).expect(200);
    assert.deepEqual(current.body, adjusted.body);
    const history = await request(http).get(`${stockPath}/movimentacoes`)
      .set('Authorization', auth).expect(200);
    assert.equal(history.body.length, 1);
    const movement = history.body[0];
    assert.equal(movement.produtoId, ids.produto);
    assert.equal(movement.quantidade, 7);
    assert.equal(movement.pedidoId, null);
    assert.equal(movement.motivoOrigem, 'AJUSTE_ADMINISTRATIVO');
    assert.equal(typeof movement.data, 'string');

    await request(http).delete(`/admin/categorias/${ids.categoria}`)
      .set('Authorization', auth).expect(409);
    const categoryAfter = await request(http).get(`/admin/categorias/${ids.categoria}`)
      .set('Authorization', auth).expect(200);
    assert.deepEqual(categoryAfter.body, category.body);
    await request(http).delete(`/admin/personalizacoes/${ids.personalizacao}`)
      .set('Authorization', auth).expect(409);
    const optionAfter = await request(http).get(`/admin/personalizacoes/${ids.personalizacao}`)
      .set('Authorization', auth).expect(200);
    assert.deepEqual(optionAfter.body, option.body);

    const [dbCategory, dbOption, dbProduct, dbStock, dbLink, dbMovements] = await Promise.all([
      prisma.categoria.findUnique({ where: { id: ids.categoria } }),
      prisma.personalizacao.findUnique({ where: { id: ids.personalizacao } }),
      prisma.produto.findUnique({ where: { id: ids.produto } }),
      prisma.estoque.findUnique({ where: { produtoId: ids.produto } }),
      prisma.produtoPersonalizacao.findUnique({ where: { produtoId_personalizacaoId: {
        produtoId: ids.produto!, personalizacaoId: ids.personalizacao!,
      } } }),
      prisma.movimentacaoEstoque.findMany({ where: { produtoId: ids.produto } }),
    ]);
    assert.equal(dbCategory?.nome, category.body.nome);
    assert.equal(dbOption?.ajusteValor?.toFixed(2), option.body.ajusteValor);
    assert.equal(dbProduct?.categoriaId, ids.categoria);
    assert.equal(dbProduct?.precoAtual.toFixed(2), '12.30');
    assert.equal(dbStock?.quantidadeFisica, 7);
    assert.equal(dbStock?.quantidadeReservada, 0);
    assert.equal(dbLink?.personalizacaoId, ids.personalizacao);
    assert.equal(dbMovements.length, 1);
    assert.equal(dbMovements[0].id, movement.id);
    assert.equal(dbMovements[0].quantidade, 7);
    if (process.argv.includes('--verify-cleanup')) {
      ids.produto = undefined;
      throw new Error('Falha parcial D25 intencional após persistência, sem ID HTTP do produto.');
    }
  } catch (error) {
    failed = error;
  } finally {
    try {
      if (app) await app.close();
    } catch (closeError) {
      failed = new AggregateError([...(failed ? [failed] : []), closeError],
        'Aplicação D25 não pôde ser encerrada.');
    }
    const ownProduct = { produto: { nome: { startsWith: marker } } };
    const ownName = { nome: { startsWith: marker } };
    const ownAdmin = { email: `${marker.toLowerCase()}@example.test` };
    const cleanupErrors: unknown[] = [];
    const cleanupStep = async (name: string, action: () => Promise<unknown>) => {
      try {
        await action();
      } catch (error) {
        cleanupErrors.push(new Error(`Cleanup D25: ${name}`, { cause: error }));
      }
    };
    await cleanupStep('MovimentacaoEstoque', async () => {
      await prisma.movimentacaoEstoque.deleteMany({ where: ownProduct });
      if (process.argv.includes('--verify-cleanup')) {
        throw new Error('Falha de cleanup D25 intencional após DELETE de MovimentacaoEstoque.');
      }
    });
    await cleanupStep('ProdutoPersonalizacao', () => prisma.produtoPersonalizacao.deleteMany({ where: ownProduct }));
    await cleanupStep('Estoque', () => prisma.estoque.deleteMany({ where: ownProduct }));
    await cleanupStep('Produto', () => prisma.produto.deleteMany({ where: ownName }));
    await cleanupStep('Personalizacao', () => prisma.personalizacao.deleteMany({ where: ownName }));
    await cleanupStep('Categoria', () => prisma.categoria.deleteMany({ where: ownName }));
    await cleanupStep('Usuario', () => prisma.usuario.deleteMany({ where: ownAdmin }));
    const residueChecks: Array<[string, () => Promise<number>]> = [
      ['MovimentacaoEstoque', () => prisma.movimentacaoEstoque.count({ where: ownProduct })],
      ['ProdutoPersonalizacao', () => prisma.produtoPersonalizacao.count({ where: ownProduct })],
      ['Estoque', () => prisma.estoque.count({ where: ownProduct })],
      ['Produto', () => prisma.produto.count({ where: ownName })],
      ['Personalizacao', () => prisma.personalizacao.count({ where: ownName })],
      ['Categoria', () => prisma.categoria.count({ where: ownName })],
      ['Usuario', () => prisma.usuario.count({ where: ownAdmin })],
    ];
    for (const [name, count] of residueChecks) {
      await cleanupStep(`verificar resíduos de ${name}`, async () => {
        assert.equal(await count(), 0, `Cleanup D25 deixou fixtures próprias em ${name}.`);
      });
    }
    await cleanupStep('desconectar Prisma', () => prisma.$disconnect());
    if (process.argv.includes('--verify-cleanup') && cleanupErrors.length === 1 &&
        failed instanceof Error && failed.message.startsWith('Falha parcial D25 intencional')) {
      process.stdout.write('VERIFY D25: cleanup continuou após falha parcial e deixou zero fixtures\n');
    }
    if (cleanupErrors.length) {
      failed = new AggregateError([...(failed ? [failed] : []), ...cleanupErrors],
        'Cleanup D25 não pôde ser concluído.');
    }
  }
  if (failed) throw failed;
  process.stdout.write('PASS D25: HTTP Nest, login ADMIN, PostgreSQL, fluxo do catálogo e cleanup\n');
}

if (process.argv.includes('--check-url-guard')) {
  checkUrlGuard();
} else main().catch((error: unknown) => {
  process.stderr.write(`Falha no teste integrado D25:\n${formatError(error)}\n`);
  process.exitCode = 1;
});
