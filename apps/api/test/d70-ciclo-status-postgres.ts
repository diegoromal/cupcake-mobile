import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { ExpiracaoPedidosService } from '../src/pedidos/expiracao-pedidos.service';
import { PedidosService } from '../src/pedidos/pedidos.service';

async function main() {
  const raw = process.env.D70_TEST_DATABASE_URL;
  if (!raw || new URL(raw).hostname !== 'localhost' || new URL(raw).pathname !== '/cupcake_d70') {
    throw new Error('D70 exige D70_TEST_DATABASE_URL para localhost/cupcake_d70.');
  }
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hash ||
      [...url.searchParams].some(([key, value]) => key !== 'schema' || value !== 'public')) {
    throw new Error('D70 exige PostgreSQL local dedicado cupcake_d70, schema public.');
  }

  const marker = `D70-${randomUUID()}`;
  url.searchParams.set('application_name', marker);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  const pedidos = new PedidosService(prisma as never, { agendarStatusPedido: async () => undefined } as never);
  const expiracao = new ExpiracaoPedidosService(prisma as never);
  const clienteId = randomUUID(), adminId = randomUUID();
  const retiradaId = randomUUID(), vencidoId = randomUUID(), vigenteId = randomUUID();
  const pedidoIds = [retiradaId, vencidoId, vigenteId];
  let checks = 0;

  try {
    const [database] = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    assert.equal(database.name, 'cupcake_d70'); checks++;

    await prisma.usuario.create({ data: { id: clienteId, nome: `${marker} cliente`,
      email: `${marker}-cliente@example.test`, telefone: '00000000000', credencialSenha: 'fixture', perfil: 'CLIENTE' } });
    await prisma.usuario.create({ data: { id: adminId, nome: `${marker} admin`,
      email: `${marker}-admin@example.test`, telefone: '00000000000', credencialSenha: 'fixture', perfil: 'ADMIN' } });

    await prisma.pedido.create({ data: { id: retiradaId, identificadorNegocio: `${marker}-${retiradaId}`,
      clienteUsuarioId: clienteId, modalidade: 'RETIRADA', statusAtual: 'PAGO', valorItens: '10.00',
      freteAplicado: '0.00', total: '10.00', confirmacaoPagamento: new Date() } });
    await prisma.historicoStatusPedido.create({ data: { pedidoId: retiradaId,
      statusRegistrado: 'PAGO', dataHora: new Date() } });

    const proximaGravacao = () => new Promise((resolve) => setTimeout(resolve, 5));
    await proximaGravacao();
    assert.equal((await pedidos.iniciarProducao(retiradaId, adminId)).statusAtual, 'EM_PREPARO'); checks++;
    await proximaGravacao();
    assert.equal((await pedidos.marcarProntoParaRetirada(retiradaId, adminId)).statusAtual,
      'PRONTO_PARA_RETIRADA'); checks++;
    await proximaGravacao();
    assert.equal((await pedidos.confirmarRetirada(retiradaId, adminId)).statusAtual, 'RETIRADO'); checks++;
    await assert.rejects(pedidos.confirmarRetirada(retiradaId, adminId)); checks++;
    await assert.rejects(pedidos.marcarProntoParaRetirada(retiradaId, adminId)); checks++;

    const historicoRetirada = await prisma.historicoStatusPedido.findMany({ where: { pedidoId: retiradaId },
      orderBy: [{ dataHora: 'asc' }, { id: 'asc' }], select: { statusRegistrado: true, responsavelUsuarioId: true } });
    assert.deepEqual(historicoRetirada.map(({ statusRegistrado, responsavelUsuarioId }) =>
      [statusRegistrado, responsavelUsuarioId]), [
      ['PAGO', null], ['EM_PREPARO', adminId], ['PRONTO_PARA_RETIRADA', adminId], ['RETIRADO', adminId],
    ]); checks++;

    const agora = new Date();
    await prisma.pedido.createMany({ data: [
      { id: vencidoId, identificadorNegocio: `${marker}-${vencidoId}`, clienteUsuarioId: clienteId,
        modalidade: 'RETIRADA', statusAtual: 'PENDENTE_PAGAMENTO', data: new Date(agora.getTime() - 16 * 60_000),
        valorItens: '10.00', freteAplicado: '0.00', total: '10.00' },
      { id: vigenteId, identificadorNegocio: `${marker}-${vigenteId}`, clienteUsuarioId: clienteId,
        modalidade: 'RETIRADA', statusAtual: 'PENDENTE_PAGAMENTO', data: new Date(agora.getTime() - 14 * 60_000),
        valorItens: '10.00', freteAplicado: '0.00', total: '10.00' },
    ] });
    await prisma.historicoStatusPedido.createMany({ data: pedidoIds.slice(1).map((pedidoId) => ({
      pedidoId, statusRegistrado: 'PENDENTE_PAGAMENTO' as const, dataHora: agora,
    })) });

    assert.equal(await expiracao.executar(), 1); checks++;
    const expirado = await prisma.pedido.findUniqueOrThrow({ where: { id: vencidoId },
      select: { statusAtual: true } });
    const aindaPendente = await prisma.pedido.findUniqueOrThrow({ where: { id: vigenteId },
      select: { statusAtual: true } });
    assert.equal(expirado.statusAtual, 'EXPIRADO'); checks++;
    assert.equal(aindaPendente.statusAtual, 'PENDENTE_PAGAMENTO'); checks++;
    assert.deepEqual(await prisma.historicoStatusPedido.findMany({ where: { pedidoId: vencidoId },
      orderBy: [{ dataHora: 'asc' }, { id: 'asc' }], select: { statusRegistrado: true } }), [
      { statusRegistrado: 'PENDENTE_PAGAMENTO' }, { statusRegistrado: 'EXPIRADO' },
    ]); checks++;
  } finally {
    await prisma.historicoStatusPedido.deleteMany({ where: { pedidoId: { in: pedidoIds } } });
    await prisma.pedido.deleteMany({ where: { id: { in: pedidoIds } } });
    await prisma.usuario.deleteMany({ where: { id: { in: [clienteId, adminId] } } });
    assert.equal(await prisma.pedido.count({ where: { identificadorNegocio: { startsWith: marker } } }), 0);
    assert.equal(await prisma.historicoStatusPedido.count({ where: { pedidoId: { in: pedidoIds } } }), 0);
    assert.equal(await prisma.usuario.count({ where: { id: { in: [clienteId, adminId] } } }), 0);
    await prisma.$disconnect();
  }
  process.stdout.write(`PASS D70 PostgreSQL (${checks} verificações; fixtures limpas)\n`);
}

main().catch((error: unknown) => { process.stderr.write(`${String(error)}\n`); process.exitCode = 1; });
