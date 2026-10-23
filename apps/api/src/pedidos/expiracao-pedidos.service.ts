import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const validadeMs = 15 * 60 * 1000;
const lote = 50;

@Injectable()
export class ExpiracaoPedidosService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExpiracaoPedidosService.name);
  private timer?: ReturnType<typeof setInterval>;
  private emExecucao = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.executar().catch(() => this.logger.error('Falha ao processar expiração de pedidos.'));
    }, 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async executar(): Promise<number> {
    if (this.emExecucao) return 0;
    this.emExecucao = true;
    try {
      const [{ agora }] = await this.prisma.$queryRaw<Array<{ agora: Date }>>`
        SELECT clock_timestamp() AS agora`;
      const limite = new Date(agora.getTime() - validadeMs);
      const candidatos = await this.prisma.pedido.findMany({
        where: { statusAtual: 'PENDENTE_PAGAMENTO', data: { lte: limite } },
        orderBy: [{ data: 'asc' }, { id: 'asc' }], take: lote, select: { id: true },
      });
      let expirados = 0;
      for (const { id } of candidatos) {
        const alterados = await this.prisma.$transaction(async (db) => {
          const pedido = await db.pedido.findUnique({ where: { id },
            select: { data: true, statusAtual: true } });
          if (!pedido || pedido.statusAtual !== 'PENDENTE_PAGAMENTO' || pedido.data > limite) return 0;
          const resultado = await db.pedido.updateMany({
            where: { id, statusAtual: 'PENDENTE_PAGAMENTO', data: { lte: limite } },
            data: { statusAtual: 'EXPIRADO' },
          });
          return resultado.count;
        });
        expirados += alterados;
      }
      return expirados;
    } finally {
      this.emExecucao = false;
    }
  }
}
