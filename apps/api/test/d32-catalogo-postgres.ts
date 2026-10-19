import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaClient } from '../src/generated/prisma/client';
import { PerfilUsuario } from '../src/generated/prisma/enums';

async function main() {
  const url = process.env.D32_TEST_DATABASE_URL;
  if (!url) throw new Error('Defina D32_TEST_DATABASE_URL.');
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname) ||
      parsed.pathname !== '/cupcake_d32' ||
      [...parsed.searchParams].some(([key, value]) => key !== 'schema' || value !== 'public')) {
    throw new Error('D32 exige banco local cupcake_d32, schema public.');
  }
  process.env.DATABASE_URL = url;
  process.env.JWT_ACCESS_SECRET = `d32-${randomUUID()}`;
  process.env.JWT_REFRESH_SECRET = `d32-refresh-${randomUUID()}`;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const userId = randomUUID();
  const categoryId = randomUUID();
  const productId = randomUUID();
  const otherProductId = randomUUID();
  const optionIds = Array.from({ length: 7 }, () => randomUUID());
  let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;
  try {
    await prisma.usuario.create({ data: { id: userId, nome: 'D32 Cliente',
      email: `d32-${userId}@example.test`, telefone: '00000000000',
      credencialSenha: 'fixture', perfil: PerfilUsuario.CLIENTE } });
    await prisma.categoria.create({ data: { id: categoryId, nome: 'D32' } });
    await prisma.produto.createMany({ data: [
      { id: productId, categoriaId: categoryId, nome: 'D32 elegível', precoAtual: '10.00' },
      { id: otherProductId, categoriaId: categoryId, nome: 'D32 inelegível', precoAtual: '2.00', ativo: false },
    ] });
    await prisma.estoque.createMany({ data: [
      { produtoId: productId, quantidadeFisica: 1 },
      { produtoId: otherProductId, quantidadeFisica: 1 },
    ] });
    await prisma.personalizacao.createMany({ data: optionIds.map((id, index) => ({
      id, nome: `D32 ${index}`, descricao: index === 0 ? 'Cacau' : null,
      ajusteValor: [null, '0.00', '0.10', '-0.20', '-10.00', '-10.01', '1.00'][index],
      disponibilidade: index !== 3,
    })) });
    await prisma.produtoPersonalizacao.createMany({ data: optionIds.slice(0, 6).map((id) => ({
      produtoId: productId, personalizacaoId: id,
    })) });
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    const http = app.getHttpServer();
    const jwt = new JwtService();
    const token = await jwt.signAsync({ sub: userId, perfil: 'CLIENTE', type: 'access' },
      { secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m' });
    const auth = `Bearer ${token}`;
    const path = `/catalogo/produtos/${productId}`;
    const detail = await request(http).get(path).set('Authorization', auth).expect(200);
    assert.equal(detail.body.personalizacoes.length, 6);
    assert.deepEqual(Object.keys(detail.body.personalizacoes[0]).sort(),
      ['id', 'nome', 'descricao', 'disponivel', 'ajusteValor'].sort());
    assert.equal(detail.body.personalizacoes[0].descricao, 'Cacau');
    assert.equal(detail.body.personalizacoes[0].ajusteValor, null);
    assert.equal(detail.body.personalizacoes[1].ajusteValor, '0.00');
    assert(!('imagem' in detail.body) && !('estoque' in detail.body));
    const preview = (ids: string[]) => request(http).post(`${path}/preco`)
      .set('Authorization', auth).send({ personalizacaoIds: ids });
    assert.equal((await preview([optionIds[0], optionIds[2]]).expect(200)).body.precoUnitario, '10.10');
    assert.equal((await preview([optionIds[4]]).expect(200)).body.precoUnitario, '0.00');
    assert.equal((await preview([optionIds[5]]).expect(409)).body.code, 'PRECO_NEGATIVO');
    await preview([optionIds[3]]).expect(409);
    await preview([optionIds[6]]).expect(409);
    await preview([optionIds[0], optionIds[0]]).expect(409);
    await preview(['invalid']).expect(400);
    await request(http).post(`${path}/preco`).send({ personalizacaoIds: [] }).expect(401);
    await request(http).post(`/catalogo/produtos/${otherProductId}/preco`)
      .set('Authorization', auth).send({ personalizacaoIds: [] }).expect(404);
    assert.equal(await prisma.carrinho.count({ where: { usuarioId: userId } }), 0);
    process.stdout.write('PASS D32 PostgreSQL\n');
  } finally {
    if (app) await app.close();
    await prisma.produtoPersonalizacao.deleteMany({ where: { produtoId: productId } });
    await prisma.personalizacao.deleteMany({ where: { id: { in: optionIds } } });
    await prisma.estoque.deleteMany({ where: { produtoId: { in: [productId, otherProductId] } } });
    await prisma.produto.deleteMany({ where: { id: { in: [productId, otherProductId] } } });
    await prisma.categoria.deleteMany({ where: { id: categoryId } });
    await prisma.usuario.deleteMany({ where: { id: userId } });
    assert.equal(await prisma.produto.count({ where: { id: productId } }), 0);
    assert.equal(await prisma.produto.count({ where: { id: otherProductId } }), 0);
    assert.equal(await prisma.personalizacao.count({ where: { id: { in: optionIds } } }), 0);
    assert.equal(await prisma.categoria.count({ where: { id: categoryId } }), 0);
    assert.equal(await prisma.usuario.count({ where: { id: userId } }), 0);
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Falha D32 PostgreSQL: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
