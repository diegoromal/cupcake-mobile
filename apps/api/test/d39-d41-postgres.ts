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
  const url = process.env.D39_41_TEST_DATABASE_URL;
  if (!url) throw new Error('Defina D39_41_TEST_DATABASE_URL.');
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || parsed.pathname !== '/cupcake_d39_41' ||
      [...parsed.searchParams].some(([key, value]) => key !== 'schema' || value !== 'public')) {
    throw new Error('D39–D41 exige banco local cupcake_d39_41, schema public.');
  }
  process.env.DATABASE_URL = url;
  process.env.JWT_ACCESS_SECRET = `d39-41-${randomUUID()}`;
  process.env.JWT_REFRESH_SECRET = `d39-41-refresh-${randomUUID()}`;
  process.env.GEOCODE_MAPS_CO_API_KEY = 'harness-only';
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const userA = randomUUID(), userB = randomUUID(), adminId = randomUUID(), courierId = randomUUID();
  const users = [userA, userB, adminId, courierId];
  const addresses: string[] = [];
  let configId: string | undefined;
  let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;
  const realFetch = global.fetch;
  try {
    const migration = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = '20261022120000_d39_d41_endereco_localizacao' AND finished_at IS NOT NULL`;
    assert.equal(migration.length, 1, 'A migration D39–D41 precisa estar aplicada antes do harness.');
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Endereco' AND column_name IN ('latitude','longitude')`;
    assert.equal(columns.length, 2, 'Colunas de coordenadas ausentes.');
    assert.equal(await prisma.configuracaoLojaEntrega.count(), 0, 'Banco dedicado precisa estar sem configuração inicial.');
    await prisma.usuario.createMany({ data: [
      { id: userA, nome: 'D39 A', email: `d39-a-${userA}@example.test`, telefone: '11900000001', credencialSenha: 'fixture', perfil: PerfilUsuario.CLIENTE },
      { id: userB, nome: 'D39 B', email: `d39-b-${userB}@example.test`, telefone: '11900000002', credencialSenha: 'fixture', perfil: PerfilUsuario.CLIENTE },
      { id: adminId, nome: 'D40 ADMIN', email: `d40-${adminId}@example.test`, telefone: '11900000003', credencialSenha: 'fixture', perfil: PerfilUsuario.ADMIN },
      { id: courierId, nome: 'D40 ENTREGADOR', email: `d40-${courierId}@example.test`, telefone: '11900000004', credencialSenha: 'fixture', perfil: PerfilUsuario.ENTREGADOR },
    ] });
    app = await NestFactory.create(AppModule, { logger: false }); await app.init();
    const http = request(app.getHttpServer());
    const jwt = new JwtService();
    const bearer = async (id: string, perfil: PerfilUsuario) => `Bearer ${await jwt.signAsync(
      { sub: id, perfil, type: 'access' },
      { secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m' },
    )}`;
    const authA = await bearer(userA, PerfilUsuario.CLIENTE);
    const authB = await bearer(userB, PerfilUsuario.CLIENTE);
    const authAdmin = await bearer(adminId, PerfilUsuario.ADMIN);
    const authCourier = await bearer(courierId, PerfilUsuario.ENTREGADOR);
    const body = { rua: 'Rua A', numero: '1', bairro: 'Centro', cidade: 'Curitiba', cep: '80000-000' };
    for (const number of ['1','2']) {
      const result = await http.post('/enderecos').set('Authorization', authA).send({ ...body, numero: number }).expect(201);
      addresses.push(result.body.id);
      assert.equal(result.body.cep, '80000000');
      assert.equal(result.body.latitude, null);
    }
    assert.equal((await http.get('/enderecos').set('Authorization', authA).expect(200)).body.length, 2);
    assert.deepEqual((await http.get('/enderecos').set('Authorization', authB).expect(200)).body, []);
    await http.post(`/enderecos/${addresses[0]}/geocodificacao`).set('Authorization', authB).expect(404);
    global.fetch = async () => { throw new Error('provider offline'); };
    await http.post(`/enderecos/${addresses[0]}/geocodificacao`).set('Authorization', authA).expect(503);
    assert.equal((await prisma.endereco.findUniqueOrThrow({ where: { id: addresses[0] } })).latitude, null);
    global.fetch = async () => new Response(JSON.stringify([{ lat: '-25.1234567', lon: '-49.1234567' }]), { status: 200 });
    await http.post(`/enderecos/${addresses[0]}/geocodificacao`).set('Authorization', authA).expect(200);
    const located = await prisma.endereco.findUniqueOrThrow({ where: { id: addresses[0] } });
    assert.equal(located.latitude?.toFixed(6), '-25.123457');
    assert.equal(located.longitude?.toFixed(6), '-49.123457');
    await assert.rejects(prisma.endereco.create({ data: { usuarioId: randomUUID(), rua:'X',numero:'1',bairro:'X',cidade:'X',cep:'80000000' } }));
    await assert.rejects(prisma.$executeRaw`UPDATE "Endereco" SET "latitude"=0, "longitude"=NULL WHERE "id"=${addresses[1]}::uuid`);
    await assert.rejects(prisma.$executeRaw`UPDATE "Endereco" SET "latitude"=91, "longitude"=0 WHERE "id"=${addresses[1]}::uuid`);
    const params = { latitudeLoja:'-25.000000',longitudeLoja:'-49.000000',raioMaximoAtendimento:'10.000',taxaBase:'5.00',valorPorQuilometro:'2.00' };
    await http.put('/admin/configuracao-loja-entrega').set('Authorization', authA).send(params).expect(403);
    await http.put('/admin/configuracao-loja-entrega').set('Authorization', authCourier).send(params).expect(403);
    await http.put('/admin/configuracao-loja-entrega').set('Authorization', authAdmin).send(params).expect(200);
    const current = await prisma.configuracaoLojaEntrega.findFirstOrThrow(); configId = current.id;
    assert.equal(current.taxaBase.toFixed(2), '5.00');
    await http.put('/admin/configuracao-loja-entrega').set('Authorization', authAdmin).send({ ...params, taxaBase:'6.00' }).expect(200);
    assert.equal(await prisma.configuracaoLojaEntrega.count(), 1);
    await assert.rejects(prisma.configuracaoLojaEntrega.create({ data: params }));
    assert.equal(await prisma.configuracaoLojaEntrega.count(), 1);
    console.log('D39–D41 PostgreSQL: persistência, FK, CHECK, unicidade, RBAC e isolamento aprovados.');
  } finally {
    global.fetch = realFetch;
    if (app) await app.close();
    if (configId) await prisma.configuracaoLojaEntrega.deleteMany({ where: { id: configId } });
    await prisma.endereco.deleteMany({ where: { id: { in: addresses } } });
    await prisma.usuario.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
