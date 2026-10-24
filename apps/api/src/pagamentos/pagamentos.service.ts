import { ConflictException, GatewayTimeoutException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Pagamento, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PagamentoSimuladorService } from './pagamento-simulador.service';

const prazoPedidoMs = 15 * 60 * 1000;
const timeoutSimulacaoMs = 2000;
type FormaPagamento = 'PIX' | 'CARTAO';

@Injectable()
export class PagamentosService {
  private readonly logger = new Logger(PagamentosService.name);

  constructor(private readonly prisma: PrismaService, private readonly simulador: PagamentoSimuladorService) {}

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
    await this.prisma.$executeRaw`
      UPDATE "Pagamento" AS p
      SET resultado = ${resultado}::"ResultadoPagamento", "dataTransacao" = clock_timestamp()
      FROM "Pedido" AS pedido
      WHERE p.id = ${pagamento.id}::uuid AND p."pedidoId" = ${pagamento.pedidoId}::uuid
        AND p.forma = ${pagamento.forma}::"FormaPagamento" AND p.resultado = 'PENDENTE'
        AND pedido.id = p."pedidoId" AND pedido."clienteUsuarioId" = ${usuarioId}::uuid`;
    return this.buscar(usuarioId, pagamento.pedidoId, pagamento.id, pagamento.forma);
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
