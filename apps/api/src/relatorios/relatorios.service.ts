import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { StatusPedido } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { RelatorioVendasQueryDto } from './dto/relatorio-vendas-query.dto';
import { intervaloRelatorioUtc } from './horario-relatorio';

@Injectable()
export class RelatoriosService {
  constructor(private readonly prisma: PrismaService) {}

  async vendas({ inicio, fim }: RelatorioVendasQueryDto) {
    const { inicio: dataInicio, fimExclusivo: dataFimExclusiva } = intervaloRelatorioUtc(inicio, fim);

    if (dataInicio >= dataFimExclusiva) {
      throw new BadRequestException('A data inicial deve ser anterior ou igual à data final.');
    }

    const pedidos = await this.prisma.pedido.findMany({
      where: {
        statusAtual: { in: [StatusPedido.ENTREGUE, StatusPedido.RETIRADO] },
        data: { gte: dataInicio, lt: dataFimExclusiva },
      },
      orderBy: [{ data: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        identificadorNegocio: true,
        data: true,
        modalidade: true,
        statusAtual: true,
        total: true,
        cliente: { select: { nome: true } },
      },
    });

    const totalVendido = pedidos.reduce(
      (total, pedido) => total.plus(pedido.total),
      new Prisma.Decimal(0),
    );

    return {
      inicio,
      fim,
      totalVendido: totalVendido.toFixed(2),
      quantidadePedidos: pedidos.length,
      pedidos: pedidos.map(({ id, identificadorNegocio, data, modalidade, statusAtual, total, cliente }) => ({
        id,
        identificadorNegocio,
        data,
        cliente: cliente.nome,
        modalidade,
        statusAtual,
        total: total.toFixed(2),
      })),
    };
  }
}
