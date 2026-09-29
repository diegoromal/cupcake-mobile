import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Saldo = { produtoId: string; quantidadeFisica: number; quantidadeReservada: number };
const MAX_QUANTIDADE = 2147483647;
const MOTIVO_AJUSTE = 'AJUSTE_ADMINISTRATIVO';

@Injectable()
export class EstoqueService {
  constructor(private readonly prisma: PrismaService) {}

  async consultar(produtoId: string) {
    const saldo = await this.prisma.estoque.findUnique({ where: { produtoId } });
    if (!saldo) throw new NotFoundException('Estoque do produto não encontrado.');
    return this.output(saldo);
  }

  async ajustar(produtoId: string, quantidadeDisponivel: number) {
    return this.prisma.$transaction(async (tx) => {
      // Serializa ajustes e futuras reservas sobre a mesma linha de estoque.
      const [saldo] = await tx.$queryRaw<Saldo[]>`
        SELECT "produtoId", "quantidadeFisica", "quantidadeReservada"
        FROM "Estoque" WHERE "produtoId" = ${produtoId}::uuid FOR UPDATE
      `;
      if (!saldo) throw new NotFoundException('Estoque do produto não encontrado.');
      if (quantidadeDisponivel > MAX_QUANTIDADE - saldo.quantidadeReservada) {
        throw new BadRequestException('Quantidade física excede o limite permitido.');
      }
      const quantidadeFisica = quantidadeDisponivel + saldo.quantidadeReservada;
      const diferenca = quantidadeFisica - saldo.quantidadeFisica;
      if (diferenca === 0) return this.output(saldo);
      const atualizado = await tx.estoque.update({
        where: { produtoId }, data: { quantidadeFisica },
      });
      await tx.movimentacaoEstoque.create({ data: {
        produtoId, quantidade: diferenca, motivoOrigem: MOTIVO_AJUSTE, data: new Date(),
      } });
      return this.output(atualizado);
    });
  }

  async historico(produtoId: string) {
    const saldo = await this.prisma.estoque.findUnique({ where: { produtoId }, select: { produtoId: true } });
    if (!saldo) throw new NotFoundException('Estoque do produto não encontrado.');
    return this.prisma.movimentacaoEstoque.findMany({
      where: { produtoId },
      orderBy: [{ data: 'desc' }, { id: 'desc' }],
      select: { id: true, produtoId: true, pedidoId: true, quantidade: true, motivoOrigem: true, data: true },
    });
  }

  private output(saldo: Saldo) {
    return { ...saldo, quantidadeDisponivel: saldo.quantidadeFisica - saldo.quantidadeReservada };
  }
}
