import { ConflictException, GatewayTimeoutException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Pagamento, Prisma } from '../generated/prisma/client';
import { StatusPedido } from '../generated/prisma/enums';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { TransicaoPedidoInvalidaError, validarTransicaoPedido } from '../pedidos/maquina-estados-pedido';
import { PrismaService } from '../prisma/prisma.service';
import { PagamentoSimuladorService } from './pagamento-simulador.service';

const prazoPedidoMs = 15 * 60 * 1000;
const timeoutSimulacaoMs = 2000;
type FormaPagamento = 'PIX' | 'CARTAO';

@Injectable()
export class PagamentosService {
  private readonly logger = new Logger(PagamentosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly simulador: PagamentoSimuladorService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  iniciarPix(usuarioId: string, pedidoId: string, tentativaId: string) {
    return this.iniciar(usuarioId, pedidoId, tentativaId, 'PIX');
  }

  iniciarCartao(usuarioId: string, pedidoId: string, tentativaId: string) {
    return this.iniciar(usuarioId, pedidoId, tentativaId, 'CARTAO');
  }

  private async iniciar(usuarioId: string, pedidoId: string, tentativaId: string, forma: FormaPagamento) {
    // UUIDs são insensíveis a caixa no PostgreSQL; comparações em memória devem concordar.
    pedidoId = pedidoId.toLowerCase();
    tentativaId = tentativaId.toLowerCase();
    const { pagamento, criado } = await this.obterOuCriar(usuarioId, pedidoId, tentativaId, forma);
    if (pagamento.resultado !== 'PENDENTE') return { criado, pagamento: this.resposta(pagamento) };

    // A transação já foi confirmada. O timeout limita a espera, sem cancelar o trabalho iniciado.
    const trabalho = this.concluir(usuarioId, pagamento).catch((error: unknown) => {
      this.logger.error('Falha ao concluir simulação de pagamento. A tentativa pode ser consultada e retomada.');
      throw error;
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const final = await Promise.race([
        trabalho,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new GatewayTimeoutException({
            statusCode: 504, message: 'Tempo de espera excedido. Consulte a tentativa.', tentativaId,
          })), timeoutSimulacaoMs);
        }),
      ]);
      return { criado, pagamento: this.resposta(final) };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  consultarPix(usuarioId: string, pedidoId: string, tentativaId: string) {
    return this.consultar(usuarioId, pedidoId, tentativaId, 'PIX');
  }

  consultarCartao(usuarioId: string, pedidoId: string, tentativaId: string) {
    return this.consultar(usuarioId, pedidoId, tentativaId, 'CARTAO');
  }

  private async consultar(usuarioId: string, pedidoId: string, tentativaId: string, forma: FormaPagamento) {
    return this.resposta(await this.buscar(usuarioId, pedidoId, tentativaId, forma));
  }

  private async obterOuCriar(usuarioId: string, pedidoId: string, tentativaId: string, forma: FormaPagamento) {
    try {
      return await this.prisma.$transaction(async (db) => {
        await db.$queryRaw`SELECT id FROM "Pedido" WHERE id = ${pedidoId}::uuid FOR UPDATE`;
        const pedido = await db.pedido.findUnique({ where: { id: pedidoId } });
        if (!pedido || pedido.clienteUsuarioId !== usuarioId) {
          throw new NotFoundException('Pedido não encontrado.');
        }
        const existente = await db.pagamento.findUnique({ where: { id: tentativaId } });
        if (existente && (existente.pedidoId !== pedidoId || existente.forma !== forma)) {
          throw new ConflictException('Tentativa indisponível.');
        }
        if (existente && existente.resultado !== 'PENDENTE') return { pagamento: existente, criado: false };

        const [{ agora }] = await db.$queryRaw<Array<{ agora: Date }>>`SELECT clock_timestamp() AS agora`;
        if (pedido.statusAtual !== 'PENDENTE_PAGAMENTO' ||
            pedido.data.getTime() + prazoPedidoMs <= agora.getTime()) {
          throw new ConflictException('Pedido não elegível para pagamento.');
        }
        if (existente) return { pagamento: existente, criado: false };

        const emAbertoOuAprovado = await db.pagamento.findFirst({ where: {
          pedidoId, resultado: { in: ['PENDENTE', 'APROVADO'] },
        } });
        if (emAbertoOuAprovado) {
          throw new ConflictException('Pedido já possui tentativa de pagamento pendente ou aprovada.');
        }
        const pagamento = await db.pagamento.create({ data: {
          id: tentativaId, pedidoId, forma, resultado: 'PENDENTE',
          valorAplicavel: pedido.total, dataTransacao: null,
        } });
        return { pagamento, criado: true };
      });
    } catch (error) {
      // Dois pedidos distintos podem disputar o mesmo UUID, mesmo com locks por pedido.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Tentativa indisponível.');
      }
      throw error;
    }
  }

  private async concluir(usuarioId: string, pagamento: Pagamento) {
    const resultado = await this.simulador.simular(pagamento.id);
    const transicao = await this.prisma.$transaction(async (db) => {
      const [pedido] = await db.$queryRaw<Array<{
        id: string; statusAtual: StatusPedido; data: Date;
        identificadorNegocio: string; telefone: string;
      }>>`
        SELECT p.id, p."statusAtual", p.data, p."identificadorNegocio", u.telefone
        FROM "Pedido" p JOIN "Usuario" u ON u.id = p."clienteUsuarioId"
        WHERE p.id = ${pagamento.pedidoId}::uuid AND p."clienteUsuarioId" = ${usuarioId}::uuid
        FOR UPDATE OF p`;
      if (!pedido) throw new NotFoundException('Pedido não encontrado.');

      const atual = await db.pagamento.findUnique({ where: { id: pagamento.id } });
      if (!atual || atual.pedidoId !== pagamento.pedidoId || atual.forma !== pagamento.forma) {
        throw new NotFoundException('Tentativa não encontrada.');
      }
      if (atual.resultado !== 'PENDENTE') return { pagamento: atual, evento: null };

      if (resultado === 'RECUSADO') {
        await db.$executeRaw`
          UPDATE "Pagamento" SET resultado = 'RECUSADO', "dataTransacao" = clock_timestamp()
          WHERE id = ${pagamento.id}::uuid AND resultado = 'PENDENTE'`;
        return {
          pagamento: await db.pagamento.findUniqueOrThrow({ where: { id: pagamento.id } }),
          evento: null,
        };
      }

      try {
        validarTransicaoPedido(pedido.statusAtual, StatusPedido.PAGO);
      } catch (error) {
        if (error instanceof TransicaoPedidoInvalidaError) {
          throw new ConflictException('Pedido não elegível para aprovação do pagamento.');
        }
        throw error;
      }
      const candidatas = await db.$queryRaw<Array<{ id: string; produtoId: string }>>`
        SELECT id, "produtoId" FROM "ReservaEstoque"
        WHERE "pedidoId" = ${pagamento.pedidoId}::uuid AND estado = 'ATIVA'::"EstadoReserva"
        ORDER BY "produtoId", id`;
      if (!candidatas.length) throw new ConflictException('Pedido sem reserva ativa de estoque.');

      for (const produtoId of [...new Set(candidatas.map((r) => r.produtoId))].sort()) {
        const [estoque] = await db.$queryRaw<Array<{ produtoId: string }>>`
          SELECT "produtoId" FROM "Estoque" WHERE "produtoId" = ${produtoId}::uuid FOR UPDATE`;
        if (!estoque) throw new ConflictException('Estoque indisponível para concluir a venda.');
      }

      const [{ agora }] = await db.$queryRaw<Array<{ agora: Date }>>`
        SELECT clock_timestamp() AS agora`;
      if (pedido.data.getTime() + prazoPedidoMs <= agora.getTime()) {
        throw new ConflictException('Reserva de estoque expirada.');
      }
      const reservas = await db.$queryRaw<Array<{
        id: string; produtoId: string; quantidade: number; momentoExpiracaoValidade: Date;
      }>>`
        SELECT id, "produtoId", quantidade, "momentoExpiracaoValidade" FROM "ReservaEstoque"
        WHERE "pedidoId" = ${pagamento.pedidoId}::uuid AND estado = 'ATIVA'::"EstadoReserva"
        ORDER BY "produtoId", id FOR UPDATE`;
      if (!reservas.length) throw new ConflictException('Pedido sem reserva ativa de estoque.');
      if (reservas.some((reserva) => reserva.momentoExpiracaoValidade <= agora)) {
        throw new ConflictException('Reserva de estoque expirada.');
      }

      const totais = new Map<string, number>();
      for (const reserva of reservas) {
        totais.set(reserva.produtoId, (totais.get(reserva.produtoId) ?? 0) + reserva.quantidade);
      }
      for (const [produtoId, quantidade] of [...totais].sort(([a], [b]) => a.localeCompare(b))) {
        const atualizado = await db.estoque.updateMany({
          where: { produtoId, quantidadeFisica: { gte: quantidade }, quantidadeReservada: { gte: quantidade } },
          data: { quantidadeFisica: { decrement: quantidade }, quantidadeReservada: { decrement: quantidade } },
        });
        if (atualizado.count !== 1) throw new ConflictException('Saldo de estoque inconsistente.');
      }

      for (const reserva of reservas) {
        const convertida = await db.reservaEstoque.updateMany({
          where: { id: reserva.id, estado: 'ATIVA' }, data: { estado: 'CONVERTIDA_EM_VENDA' },
        });
        if (convertida.count !== 1) throw new ConflictException('Reserva de estoque alterada durante a venda.');
        await db.movimentacaoEstoque.create({ data: {
          produtoId: reserva.produtoId, pedidoId: pagamento.pedidoId,
          quantidade: -reserva.quantidade, motivoOrigem: 'VENDA_PEDIDO', data: agora,
        } });
      }

      const pagamentoAlterado = await db.$executeRaw`
        UPDATE "Pagamento" SET resultado = 'APROVADO', "dataTransacao" = ${agora}
        WHERE id = ${pagamento.id}::uuid AND resultado = 'PENDENTE'`;
      if (pagamentoAlterado !== 1) throw new ConflictException('Tentativa alterada durante a aprovação.');
      const alterado = await db.pedido.updateMany({
        where: { id: pagamento.pedidoId, statusAtual: StatusPedido.PENDENTE_PAGAMENTO },
        data: { statusAtual: StatusPedido.PAGO, confirmacaoPagamento: agora },
      });
      if (alterado.count !== 1) throw new ConflictException('Pedido alterado durante a aprovação.');
      await db.historicoStatusPedido.create({ data: {
        pedidoId: pagamento.pedidoId, statusRegistrado: StatusPedido.PAGO, dataHora: agora,
      } });
      return {
        pagamento: await db.pagamento.findUniqueOrThrow({ where: { id: pagamento.id } }),
        evento: {
          pedidoId: pedido.id,
          identificadorNegocio: pedido.identificadorNegocio,
          telefone: pedido.telefone,
          status: StatusPedido.PAGO,
        },
      };
    }, { timeout: 30_000 });
    if (transicao.evento) {
      this.notificacoes.agendarStatusPedido(transicao.evento);
    }
    return transicao.pagamento;
  }

  private async buscar(usuarioId: string, pedidoId: string, tentativaId: string, forma: FormaPagamento) {
    const pagamento = await this.prisma.pagamento.findFirst({ where: {
      id: tentativaId, pedidoId, forma, pedido: { clienteUsuarioId: usuarioId },
    } });
    if (!pagamento) throw new NotFoundException('Tentativa não encontrada.');
    return pagamento;
  }

  private resposta(pagamento: Pagamento) {
    return {
      tentativaId: pagamento.id, pedidoId: pagamento.pedidoId, forma: pagamento.forma,
      resultado: pagamento.resultado, valorAplicavel: pagamento.valorAplicavel.toFixed(2),
      dataTransacao: pagamento.dataTransacao?.toISOString() ?? null,
    };
  }
}
