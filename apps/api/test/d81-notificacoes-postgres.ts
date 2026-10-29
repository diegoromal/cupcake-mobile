import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { NotificacoesService } from '../src/notificacoes/notificacoes.service';
import { PedidosService } from '../src/pedidos/pedidos.service';
import { TEST_NOTIFICATION_PHONE } from './test-notification-phone';

async function main() {
  const raw = process.env.D81_TEST_DATABASE_URL;
  if (!raw) throw new Error('D81 exige D81_TEST_DATABASE_URL para localhost:5432/cupcake_d81.');
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== 'localhost' ||
      url.port !== '5432' || url.pathname !== '/cupcake_d81' || url.hash ||
      [...url.searchParams].some(([key, value]) => key !== 'schema' || value !== 'public')) {
    throw new Error('D81 exige PostgreSQL local dedicado localhost:5432/cupcake_d81, schema public.');
  }

  const marker = `D81-${randomUUID()}`;
  url.searchParams.set('application_name', marker);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  const pedidoIds = [randomUUID(), randomUUID()];
  const clienteId = randomUUID();
  const adminId = randomUUID();
  let checks = 0;
  let bloquearEnvio = true;
  let deveFalhar = true;
  let concluirPrimeiroEnvio!: (erro?: Error) => void;
  let iniciouPrimeiroEnvio!: () => void;
  const primeiroEnvioIniciado = new Promise<void>((resolve) => { iniciouPrimeiroEnvio = resolve; });
  const primeiroEnvio = new Promise<void>((resolve, reject) => {
    concluirPrimeiroEnvio = (erro) => erro ? reject(erro) : resolve();
  });
  const evolution = {
    enviarTexto: async () => {
      if (bloquearEnvio) {
        iniciouPrimeiroEnvio();
        await primeiroEnvio;
      }
      if (deveFalhar) throw new Error('falha simulada do provedor');
    },
  };
  const notificacoes = new NotificacoesService(prisma as never, evolution as never);
  const pedidos = new PedidosService(prisma as never, notificacoes);

  try {
    const [database] = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    assert.equal(database.name, 'cupcake_d81'); checks++;

    await prisma.usuario.createMany({ data: [
      { id: clienteId, nome: `${marker} cliente`, email: `${marker}-cliente@example.test`,
        telefone: TEST_NOTIFICATION_PHONE, credencialSenha: 'fixture', perfil: 'CLIENTE' },
      { id: adminId, nome: `${marker} admin`, email: `${marker}-admin@example.test`,
        telefone: '00000000000', credencialSenha: 'fixture', perfil: 'ADMIN' },
    ] });
    await prisma.pedido.createMany({ data: pedidoIds.map((id) => ({
      id, identificadorNegocio: `${marker}-${id}`, clienteUsuarioId: clienteId,
      modalidade: 'RETIRADA' as const, statusAtual: 'PAGO' as const,
      valorItens: '10.00', freteAplicado: '0.00', total: '10.00', confirmacaoPagamento: new Date(),
    })) });
    await prisma.historicoStatusPedido.createMany({ data: pedidoIds.map((pedidoId) => ({
      pedidoId, statusRegistrado: 'PAGO' as const, dataHora: new Date(),
    })) });

    await pedidos.iniciarProducao(pedidoIds[0], adminId);
    await primeiroEnvioIniciado;
    assert.equal((await prisma.pedido.findUniqueOrThrow({ where: { id: pedidoIds[0] } })).statusAtual,
      'EM_PREPARO'); checks++;
    assert.equal(await prisma.notificacao.count({ where: { pedidoId: pedidoIds[0] } }), 0); checks++;
    concluirPrimeiroEnvio(new Error('falha simulada do provedor'));
    await notificacoes.onModuleDestroy();
    const falha = await prisma.notificacao.findFirstOrThrow({ where: { pedidoId: pedidoIds[0] } });
    assert.equal(falha.resultado, 'FALHA'); checks++;
    assert.equal(falha.eventoStatusOriginador, 'EM_PREPARO'); checks++;
    assert.equal(falha.destino, TEST_NOTIFICATION_PHONE); checks++;

    bloquearEnvio = false;
    deveFalhar = false;
    await pedidos.iniciarProducao(pedidoIds[1], adminId);
    await notificacoes.onModuleDestroy();
    assert.equal((await prisma.pedido.findUniqueOrThrow({ where: { id: pedidoIds[1] } })).statusAtual,
      'EM_PREPARO'); checks++;
    const sucesso = await prisma.notificacao.findFirstOrThrow({ where: { pedidoId: pedidoIds[1] } });
    assert.equal(sucesso.resultado, 'SUCESSO'); checks++;
    assert.equal(sucesso.canal, 'WHATSAPP'); checks++;
  } finally {
    try {
      await prisma.notificacao.deleteMany({ where: { pedidoId: { in: pedidoIds } } });
      await prisma.historicoStatusPedido.deleteMany({ where: { pedidoId: { in: pedidoIds } } });
      await prisma.pedido.deleteMany({ where: { id: { in: pedidoIds } } });
      await prisma.usuario.deleteMany({ where: { id: { in: [clienteId, adminId] } } });
      assert.equal(await prisma.pedido.count({ where: { identificadorNegocio: { startsWith: marker } } }), 0);
      assert.equal(await prisma.notificacao.count({ where: { pedidoId: { in: pedidoIds } } }), 0);
      assert.equal(await prisma.historicoStatusPedido.count({ where: { pedidoId: { in: pedidoIds } } }), 0);
      assert.equal(await prisma.usuario.count({ where: { id: { in: [clienteId, adminId] } } }), 0);
    } finally {
      await prisma.$disconnect();
    }
  }
  process.stdout.write(`PASS D81 PostgreSQL (${checks} checks; banco dedicado; falha não bloqueia; resíduos zero)\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
