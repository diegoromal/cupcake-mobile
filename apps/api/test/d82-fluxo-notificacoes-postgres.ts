import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { StatusPedido } from '../src/generated/prisma/enums';
import { EventoStatusPedido, NotificacoesService } from '../src/notificacoes/notificacoes.service';
import { PedidosService } from '../src/pedidos/pedidos.service';
import { TEST_NOTIFICATION_PHONE } from './test-notification-phone';

const textoEsperado: Partial<Record<StatusPedido, (pedido: string) => string>> = {
  [StatusPedido.PAGO]: (pedido) => `Pagamento do pedido ${pedido} aprovado.`,
  [StatusPedido.EM_PREPARO]: (pedido) => `Seu pedido ${pedido} está em preparo.`,
  [StatusPedido.SAIU_PARA_ENTREGA]: (pedido) => `Seu pedido ${pedido} saiu para entrega.`,
  [StatusPedido.ENTREGUE]: (pedido) => `Seu pedido ${pedido} foi entregue.`,
  [StatusPedido.PRONTO_PARA_RETIRADA]: (pedido) => `Seu pedido ${pedido} está pronto para retirada.`,
  [StatusPedido.RETIRADO]: (pedido) => `A retirada do pedido ${pedido} foi confirmada.`,
};

async function main() {
  const raw = process.env.D82_TEST_DATABASE_URL;
  if (!raw) throw new Error('D82 exige D82_TEST_DATABASE_URL para localhost:5432/cupcake_d82.');
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== 'localhost' ||
      url.port !== '5432' || url.pathname !== '/cupcake_d82' || url.hash ||
      [...url.searchParams].some(([key, value]) => key !== 'schema' || value !== 'public')) {
    throw new Error('D82 exige PostgreSQL local dedicado localhost:5432/cupcake_d82, schema public.');
  }

  const marker = `D82-${randomUUID()}`;
  url.searchParams.set('application_name', marker);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  const clienteId = randomUUID(), adminId = randomUUID(), entregadorId = randomUUID();
  const deliveryId = randomUUID(), retiradaId = randomUUID();
  const deliveryBusinessId = `${marker}-DELIVERY`, retiradaBusinessId = `${marker}-RETIRADA`;
  const pedidoIds = [deliveryId, retiradaId];
  const eventosEsperados = [
    [StatusPedido.PAGO, deliveryBusinessId],
    [StatusPedido.EM_PREPARO, deliveryBusinessId],
    [StatusPedido.SAIU_PARA_ENTREGA, deliveryBusinessId],
    [StatusPedido.ENTREGUE, deliveryBusinessId],
    [StatusPedido.EM_PREPARO, retiradaBusinessId],
    [StatusPedido.PRONTO_PARA_RETIRADA, retiradaBusinessId],
    [StatusPedido.RETIRADO, retiradaBusinessId],
  ] as const;
  const envios: Array<{ destino: string; texto: string }> = [];
  let checks = 0;
  const evolution = { enviarTexto: async (destino: string, texto: string) => { envios.push({ destino, texto }); } };
  const notificacoes = new NotificacoesService(prisma as never, evolution as never);
  const pedidos = new PedidosService(prisma as never, notificacoes);

  try {
    const [database] = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    assert.equal(database.name, 'cupcake_d82'); checks++;
    await prisma.usuario.createMany({ data: [
      { id: clienteId, nome: `${marker} cliente`, email: `${marker}-cliente@example.test`,
        telefone: TEST_NOTIFICATION_PHONE, credencialSenha: 'fixture', perfil: 'CLIENTE' },
      { id: adminId, nome: `${marker} admin`, email: `${marker}-admin@example.test`,
        telefone: '00000000000', credencialSenha: 'fixture', perfil: 'ADMIN' },
      { id: entregadorId, nome: `${marker} entregador`, email: `${marker}-entregador@example.test`,
        telefone: '00000000001', credencialSenha: 'fixture', perfil: 'ENTREGADOR' },
    ] });
    await prisma.pedido.createMany({ data: [
      { id: deliveryId, identificadorNegocio: deliveryBusinessId, clienteUsuarioId: clienteId,
        modalidade: 'ENTREGA', statusAtual: StatusPedido.PAGO, valorItens: '10.00', freteAplicado: '2.00',
        total: '12.00', confirmacaoPagamento: new Date() },
      { id: retiradaId, identificadorNegocio: retiradaBusinessId, clienteUsuarioId: clienteId,
        modalidade: 'RETIRADA', statusAtual: StatusPedido.PAGO, valorItens: '10.00', freteAplicado: '0.00',
        total: '10.00', confirmacaoPagamento: new Date() },
    ] });
    await prisma.historicoStatusPedido.createMany({ data: pedidoIds.map((pedidoId) => ({
      pedidoId, statusRegistrado: StatusPedido.PAGO, dataHora: new Date(),
    })) });

    const eventoPago: EventoStatusPedido = {
      pedidoId: deliveryId, identificadorNegocio: deliveryBusinessId,
      telefone: TEST_NOTIFICATION_PHONE, status: StatusPedido.PAGO,
    };
    notificacoes.agendarStatusPedido(eventoPago);
    assert.equal((await pedidos.iniciarProducao(deliveryId, adminId)).statusAtual, StatusPedido.EM_PREPARO); checks++;
    assert.equal((await pedidos.sairParaEntrega(deliveryId, entregadorId, adminId)).statusAtual,
      StatusPedido.SAIU_PARA_ENTREGA); checks++;
    assert.equal((await pedidos.confirmarEntrega(deliveryId, entregadorId)).statusAtual,
      StatusPedido.ENTREGUE); checks++;
    assert.equal((await pedidos.iniciarProducao(retiradaId, adminId)).statusAtual, StatusPedido.EM_PREPARO); checks++;
    assert.equal((await pedidos.marcarProntoParaRetirada(retiradaId, adminId)).statusAtual,
      StatusPedido.PRONTO_PARA_RETIRADA); checks++;
    assert.equal((await pedidos.confirmarRetirada(retiradaId, adminId)).statusAtual,
      StatusPedido.RETIRADO); checks++;
    notificacoes.agendarStatusPedido({ pedidoId: deliveryId, identificadorNegocio: deliveryBusinessId,
      telefone: TEST_NOTIFICATION_PHONE, status: StatusPedido.PENDENTE_PAGAMENTO });
    await notificacoes.onModuleDestroy();

    const historicos = await prisma.historicoStatusPedido.findMany({ where: { pedidoId: { in: pedidoIds } },
      orderBy: [{ pedidoId: 'asc' }, { dataHora: 'asc' }, { id: 'asc' }],
      select: { pedidoId: true, statusRegistrado: true } });
    const historicosEsperados = [
      [deliveryId, StatusPedido.PAGO], [deliveryId, StatusPedido.EM_PREPARO],
      [deliveryId, StatusPedido.SAIU_PARA_ENTREGA], [deliveryId, StatusPedido.ENTREGUE],
      [retiradaId, StatusPedido.PAGO], [retiradaId, StatusPedido.EM_PREPARO],
      [retiradaId, StatusPedido.PRONTO_PARA_RETIRADA], [retiradaId, StatusPedido.RETIRADO],
    ];
    const ordenar = (a: string[], b: string[]) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]);
    assert.deepEqual(historicos.map(({ pedidoId, statusRegistrado }) => [pedidoId, statusRegistrado]).sort(ordenar),
      historicosEsperados.sort(ordenar)); checks++;
    assert.deepEqual(envios.sort((a, b) => a.texto.localeCompare(b.texto)),
      eventosEsperados.map(([status, identificador]) => ({
        destino: TEST_NOTIFICATION_PHONE, texto: textoEsperado[status]!(identificador),
      }))
        .sort((a, b) => a.texto.localeCompare(b.texto))); checks++;
    const registros = await prisma.notificacao.findMany({ where: { pedidoId: { in: pedidoIds } },
      select: { eventoStatusOriginador: true, destino: true, canal: true, resultado: true } });
    assert.equal(registros.length, eventosEsperados.length); checks++;
    assert.deepEqual(registros.map(({ eventoStatusOriginador, destino, canal, resultado }) =>
      [eventoStatusOriginador, destino, canal, resultado]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    eventosEsperados.map(([status]) => [status, TEST_NOTIFICATION_PHONE, 'WHATSAPP', 'SUCESSO'])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))); checks++;
  } finally {
    await notificacoes.onModuleDestroy();
    await prisma.notificacao.deleteMany({ where: { pedidoId: { in: pedidoIds } } });
    await prisma.historicoStatusPedido.deleteMany({ where: { pedidoId: { in: pedidoIds } } });
    await prisma.pedido.deleteMany({ where: { id: { in: pedidoIds } } });
    await prisma.usuario.deleteMany({ where: { id: { in: [clienteId, adminId, entregadorId] } } });
    assert.equal(await prisma.notificacao.count({ where: { pedidoId: { in: pedidoIds } } }), 0);
    assert.equal(await prisma.historicoStatusPedido.count({ where: { pedidoId: { in: pedidoIds } } }), 0);
    assert.equal(await prisma.pedido.count({ where: { id: { in: pedidoIds } } }), 0);
    assert.equal(await prisma.usuario.count({ where: { id: { in: [clienteId, adminId, entregadorId] } } }), 0);
    await prisma.$disconnect();
  }
  process.stdout.write(`PASS D82 PostgreSQL (${checks} verificações; delivery e retirada; fixtures limpas)\n`);
}

main().catch((error: unknown) => { process.stderr.write(`${String(error)}\n`); process.exitCode = 1; });
