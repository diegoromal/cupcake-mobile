import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const lote = 50;

@Injectable()
export class LiberacaoReservasService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LiberacaoReservasService.name);
  private timer?: ReturnType<typeof setInterval>;
  private emExecucao = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.executar().catch((error: unknown) => this.logger.error(
        'Falha ao liberar reservas expiradas.', error instanceof Error ? error.stack : String(error)));
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
      const candidatos = await this.prisma.reservaEstoque.findMany({
        where: { estado: 'ATIVA', pedido: { statusAtual: 'EXPIRADO' },
          momentoExpiracaoValidade: { lte: agora } },
        orderBy: [{ momentoExpiracaoValidade: 'asc' }, { id: 'asc' }],
        take: lote, select: { id: true, produtoId: true },
      });
      if (!candidatos.length) return 0;
      return await this.prisma.$transaction(async (db) => {
        // A mesma ordem de D50 impede inversão de locks entre produtos.
        for (const produtoId of [...new Set(candidatos.map((r) => r.produtoId))].sort()) {
          const [estoque] = await db.$queryRaw<Array<{ produtoId: string }>>`
            SELECT "produtoId" FROM "Estoque" WHERE "produtoId" = ${produtoId}::uuid FOR UPDATE`;
          if (!estoque) throw new Error('Estoque ausente para reserva ativa.');
        }
        const [{ agora: instanteBloqueado }] = await db.$queryRaw<Array<{ agora: Date }>>`
          SELECT clock_timestamp() AS agora`;
        const reservas: Array<{ id: string; produtoId: string; quantidade: number }> = [];
        for (const { id } of [...candidatos].sort((a, b) => a.id.localeCompare(b.id))) {
          // O pedido também é bloqueado: seu status não pode mudar entre a releitura e o commit.
          const [reserva] = await db.$queryRaw<Array<{
            id: string; produtoId: string; quantidade: number;
          }>>`
            SELECT r.id, r."produtoId", r.quantidade FROM "ReservaEstoque" r
            JOIN "Pedido" p ON p.id = r."pedidoId"
            WHERE r.id = ${id}::uuid AND r.estado = 'ATIVA'::"EstadoReserva"
              AND p."statusAtual" = 'EXPIRADO'::"StatusPedido"
              AND r."momentoExpiracaoValidade" <= ${instanteBloqueado}
            FOR UPDATE OF r, p`;
          if (reserva) reservas.push(reserva);
        }
        const totais = new Map<string, number>();
        for (const reserva of reservas) {
          totais.set(reserva.produtoId, (totais.get(reserva.produtoId) ?? 0) + reserva.quantidade);
        }
        for (const produtoId of [...totais.keys()].sort()) {
          const quantidade = totais.get(produtoId)!;
          const alterado = await db.estoque.updateMany({
            where: { produtoId, quantidadeReservada: { gte: quantidade } },
            data: { quantidadeReservada: { decrement: quantidade } },
          });
          if (alterado.count !== 1) throw new Error('Saldo reservado insuficiente para liberação.');
        }
        for (const reserva of reservas) {
          const alterada = await db.reservaEstoque.updateMany({
            where: { id: reserva.id, estado: 'ATIVA' }, data: { estado: 'EXPIRADA_LIBERADA' },
          });
          if (alterada.count !== 1) throw new Error('Reserva alterada durante liberação.');
        }
        return reservas.length;
      }, { timeout: 30_000 });
    } finally {
      this.emExecucao = false;
    }
  }
}
