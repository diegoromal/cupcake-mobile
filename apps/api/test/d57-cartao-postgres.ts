import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { PrismaClient } from '../src/generated/prisma/client';
import { PagamentosModule } from '../src/pagamentos/pagamentos.module';

const raw = process.env.D57_TEST_DATABASE_URL;
if (!raw) throw new Error('Defina D57_TEST_DATABASE_URL.');
const url = new URL(raw);
if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    (url.port && url.port !== '5432') || url.pathname !== '/cupcake_d57' || url.hash ||
    [...url.searchParams].some(([key, value]) => key !== 'schema' || value !== 'public')) {
  throw new Error('D57 exige PostgreSQL local dedicado cupcake_d57, schema public.');
}
url.searchParams.set('application_name', `d57_${randomUUID().replaceAll('-', '')}`);
process.env.DATABASE_URL = url.toString();
process.env.JWT_ACCESS_SECRET = `d57-access-${randomUUID()}`;
process.env.JWT_REFRESH_SECRET = `d57-refresh-${randomUUID()}`;

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  const marker = `d57_${randomUUID().replaceAll('-', '')}`;
  const usuarios: string[] = [], pedidos: string[] = [], tentativas: string[] = [];
  const categoriaId = randomUUID(), produtoId = randomUUID();
  let app: INestApplication | undefined;
  let originalError: unknown;
  const cleanupErrors: unknown[] = [];
  let checks = 0;
  const eq = (actual: unknown, expected: unknown, label: string) => {
    assert.deepEqual(actual, expected, label); checks++;
  };
  try {
    const migrations = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    for (const migration of readdirSync(resolve(__dirname, '../prisma/migrations')).filter((v) => /^\d+_/.test(v))) {
      eq(migrations.some((m) => m.migration_name === migration), true, migration);
    }
    for (let i = 0; i < 2; i++) {
      const id = randomUUID(); usuarios.push(id);
      await prisma.usuario.create({ data: { id, nome: `${marker}-${i}`, email: `${marker}-${i}@example.test`,
        telefone: '00000000000', credencialSenha: 'fixture', perfil: 'CLIENTE' } });
    }
    await prisma.categoria.create({ data: { id: categoriaId, nome: marker } });
    await prisma.produto.create({ data: { id: produtoId, categoriaId, nome: marker, precoAtual: '12.34' } });
    await prisma.estoque.create({ data: { produtoId, quantidadeFisica: 10, quantidadeReservada: 3 } });
    for (const usuarioId of usuarios) {
      const id = randomUUID(); pedidos.push(id);
      await prisma.pedido.create({ data: { id, identificadorNegocio: `${marker}-${id}`,
        clienteUsuarioId: usuarioId, modalidade: 'RETIRADA', valorItens: '12.34', freteAplicado: '0.00', total: '12.34' } });
      await prisma.reservaEstoque.create({ data: { pedidoId: id, produtoId, quantidade: 1,
        estado: 'ATIVA', momentoExpiracaoValidade: new Date(Date.now() + 900_000) } });
    }
    const module = await Test.createTestingModule({ imports: [PagamentosModule] }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    await app.init();
    const jwt = new JwtService();
    const token = async (id: string) => `Bearer ${await jwt.signAsync({ sub: id, perfil: 'CLIENTE', type: 'access' }, {
      secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m',
    })}`;
    const auth = await token(usuarios[0]), outroAuth = await token(usuarios[1]);
    const pedidoId = pedidos[0], tentativaAprovada = randomUUID().slice(0, -1) + '0';
    tentativas.push(tentativaAprovada);
    const caminho = `/pedidos/${pedidoId}/pagamentos/cartao`;
    const criar = await request(app.getHttpServer()).post(caminho)
      .set('Authorization', auth).send({ tentativaId: tentativaAprovada }).expect(201);
    eq(criar.body, { tentativaId: tentativaAprovada, pedidoId, forma: 'CARTAO', resultado: 'APROVADO',
      valorAplicavel: '12.34', dataTransacao: expectDate(criar.body.dataTransacao) }, 'Contrato aprovado e valor do pedido');
    eq(await prisma.pagamento.findUnique({ where: { id: tentativaAprovada } }).then((p) => p?.forma), 'CARTAO', 'Forma persistida');
    eq(await prisma.pedido.findUnique({ where: { id: pedidoId } }).then((p) => p?.statusAtual),
      'PAGO', 'Pedido pago após conversão da reserva');
    eq(await prisma.reservaEstoque.findFirst({ where: { pedidoId } }).then((r) => r?.estado),
      'CONVERTIDA_EM_VENDA', 'Reserva convertida uma vez');
    eq(await prisma.estoque.findUnique({ where: { produtoId } }).then((e) =>
      [e?.quantidadeFisica, e?.quantidadeReservada]), [9, 2], 'Estoque baixado e reserva liberada');
    eq(await prisma.movimentacaoEstoque.count({ where: { pedidoId } }), 1, 'Movimentação da venda registrada');
    const repeticao = await request(app.getHttpServer()).post(caminho)
      .set('Authorization', auth).send({ tentativaId: tentativaAprovada }).expect(200);
    eq(repeticao.body, criar.body, 'Retry idempotente');
    await request(app.getHttpServer()).post(`/pedidos/${pedidoId}/pagamentos/pix`)
      .set('Authorization', auth).send({ tentativaId: randomUUID() }).expect(409);
    await request(app.getHttpServer()).get(`${caminho}/${tentativaAprovada}`)
      .set('Authorization', outroAuth).expect(404);
    await request(app.getHttpServer()).post(caminho)
      .set('Authorization', auth).send({ tentativaId: randomUUID(), numeroCartao: '4111111111111111' }).expect(400);
    const pedidoRecusado = randomUUID(); pedidos.push(pedidoRecusado);
    await prisma.pedido.create({ data: { id: pedidoRecusado, identificadorNegocio: `${marker}-${pedidoRecusado}`,
      clienteUsuarioId: usuarios[0], modalidade: 'RETIRADA', valorItens: '12.34', freteAplicado: '0.00', total: '12.34' } });
    await prisma.reservaEstoque.create({ data: { pedidoId: pedidoRecusado, produtoId, quantidade: 1,
      estado: 'ATIVA', momentoExpiracaoValidade: new Date(Date.now() + 900_000) } });
    const caminhoRecusado = `/pedidos/${pedidoRecusado}/pagamentos/cartao`;
    const tentativaRecusada = randomUUID().slice(0, -1) + '1';
    tentativas.push(tentativaRecusada);
    const recusada = await request(app.getHttpServer()).post(caminhoRecusado)
      .set('Authorization', auth).send({ tentativaId: tentativaRecusada }).expect(201);
    eq(recusada.body.resultado, 'RECUSADO', 'Recusa determinística');
    const retryId = randomUUID().slice(0, -1) + '2'; tentativas.push(retryId);
    const retry = await request(app.getHttpServer()).post(caminhoRecusado)
      .set('Authorization', auth).send({ tentativaId: retryId }).expect(201);
    eq(retry.body.resultado, 'APROVADO', 'Nova tentativa permitida após recusa');
    eq(await prisma.pagamento.count({ where: { pedidoId: pedidoRecusado } }), 2, 'Tentativas persistidas uma vez cada');
    eq(await prisma.pedido.findUnique({ where: { id: pedidoRecusado } }).then((p) => p?.statusAtual),
      'PAGO', 'Pedido pago na tentativa aprovada posterior');
  } catch (error) {
    originalError = error;
  } finally {
    const cleanup = async (label: string, action: () => Promise<unknown>) => {
      try { await action(); } catch (error) { cleanupErrors.push(new Error(label, { cause: error })); }
    };
    if (app) await cleanup('fechar app', () => app!.close());
    await cleanup('pagamentos', () => prisma.pagamento.deleteMany({ where: { id: { in: tentativas } } }));
    await cleanup('movimentações', () => prisma.movimentacaoEstoque.deleteMany({ where: { pedidoId: { in: pedidos } } }));
    await cleanup('históricos', () => prisma.historicoStatusPedido.deleteMany({ where: { pedidoId: { in: pedidos } } }));
    await cleanup('reservas', () => prisma.reservaEstoque.deleteMany({ where: { pedidoId: { in: pedidos } } }));
    await cleanup('pedidos', () => prisma.pedido.deleteMany({ where: { id: { in: pedidos } } }));
    await cleanup('estoque', () => prisma.estoque.deleteMany({ where: { produtoId } }));
    await cleanup('produto', () => prisma.produto.deleteMany({ where: { id: produtoId } }));
    await cleanup('categoria', () => prisma.categoria.deleteMany({ where: { id: categoriaId } }));
    await cleanup('usuarios', () => prisma.usuario.deleteMany({ where: { id: { in: usuarios } } }));
    await cleanup('fixtures residuais', async () => {
      eq(await prisma.pagamento.count({ where: { id: { in: tentativas } } }), 0, 'Sem pagamentos residuais');
      eq(await prisma.pedido.count({ where: { id: { in: pedidos } } }), 0, 'Sem pedidos residuais');
      eq(await prisma.usuario.count({ where: { id: { in: usuarios } } }), 0, 'Sem usuários residuais');
    });
    await cleanup('fechar prisma', () => prisma.$disconnect());
  }
  if (originalError || cleanupErrors.length) throw new AggregateError(
    [...(originalError ? [originalError] : []), ...cleanupErrors], 'D57 falhou');
  process.stdout.write(`D57 PostgreSQL PASS: ${checks} verificações, fixtures removidas.\n`);
}

function expectDate(value: unknown) {
  assert.equal(typeof value, 'string', 'Pagamento concluído inclui data da transação');
  return value;
}

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
