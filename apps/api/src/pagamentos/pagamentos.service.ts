import { ConflictException, GatewayTimeoutException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Pagamento, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PixSimuladorService } from './pix-simulador.service';

const prazoPedidoMs = 15 * 60 * 1000;
const timeoutPixMs = 2000;

@Injectable()
export class PagamentosService {
  private readonly logger = new Logger(PagamentosService.name);

  constructor(private readonly prisma: PrismaService, private readonly simulador: PixSimuladorService) {}

  async iniciarPix(usuarioId: string, pedidoId: string, tentativaId: string) {
    // UUIDs são insensíveis a caixa no PostgreSQL; comparações em memória devem concordar.
    pedidoId = pedidoId.toLowerCase();
    tentativaId = tentativaId.toLowerCase();
    const { pagamento, criado } = await this.obterOuCriar(usuarioId, pedidoId, tentativaId);
    if (pagamento.resultado !== 'PENDENTE') return { criado, pagamento: this.resposta(pagamento) };

    // A transação já foi confirmada. O timeout limita a espera, sem cancelar o trabalho iniciado.
    const trabalho = this.concluir(usuarioId, pagamento).catch((error: unknown) => {
      this.logger.error('Falha ao concluir simulação Pix. A tentativa pode ser consultada e retomada.');
      throw error;
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const final = await Promise.race([
        trabalho,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new GatewayTimeoutException({
            statusCode: 504, message: 'Tempo de espera excedido. Consulte a tentativa.', tentativaId,
          })), timeoutPixMs);
        }),
      ]);
      return { criado, pagamento: this.resposta(final) };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async consultarPix(usuarioId: string, pedidoId: string, tentativaId: string) {
    return this.resposta(await this.buscar(usuarioId, pedidoId, tentativaId));
  }

  private async obterOuCriar(usuarioId: string, pedidoId: string, tentativaId: string) {
    try {
      return await this.prisma.$transaction(async (db) => {
        await db.$queryRaw`SELECT id FROM "Pedido" WHERE id = ${pedidoId}::uuid FOR UPDATE`;
        const pedido = await db.pedido.findUnique({ where: { id: pedidoId } });
        if (!pedido || pedido.clienteUsuarioId !== usuarioId) {
          throw new NotFoundException('Pedido não encontrado.');
        }
        const existente = await db.pagamento.findUnique({ where: { id: tentativaId } });
        if (existente && (existente.pedidoId !== pedidoId || existente.forma !== 'PIX')) {
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
          pedidoId, forma: 'PIX', resultado: { in: ['PENDENTE', 'APROVADO'] },
        } });
        if (emAbertoOuAprovado) throw new ConflictException('Pedido já possui tentativa Pix pendente ou aprovada.');
        const pagamento = await db.pagamento.create({ data: {
          id: tentativaId, pedidoId, forma: 'PIX', resultado: 'PENDENTE',
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
        AND p.forma = 'PIX' AND p.resultado = 'PENDENTE'
        AND pedido.id = p."pedidoId" AND pedido."clienteUsuarioId" = ${usuarioId}::uuid`;
    return this.buscar(usuarioId, pagamento.pedidoId, pagamento.id);
  }

  private async buscar(usuarioId: string, pedidoId: string, tentativaId: string) {
    const pagamento = await this.prisma.pagamento.findFirst({ where: {
      id: tentativaId, pedidoId, forma: 'PIX', pedido: { clienteUsuarioId: usuarioId },
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
