import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SalvarConfiguracaoLojaEntregaDto } from './dto/salvar-configuracao-loja-entrega.dto';

@Injectable()
export class ConfiguracaoLojaEntregaService {
  constructor(private readonly prisma: PrismaService) {}

  async obter() {
    const atual = await this.prisma.configuracaoLojaEntrega.findFirst();
    if (!atual) throw new NotFoundException('Configuração da loja não encontrada.');
    return apresentar(atual);
  }

  async salvar(input: SalvarConfiguracaoLojaEntregaDto) {
    const data = {
      latitudeLoja: new Prisma.Decimal(input.latitudeLoja),
      longitudeLoja: new Prisma.Decimal(input.longitudeLoja),
      raioMaximoAtendimento: new Prisma.Decimal(input.raioMaximoAtendimento),
      taxaBase: new Prisma.Decimal(input.taxaBase),
      valorPorQuilometro: new Prisma.Decimal(input.valorPorQuilometro),
    };
    if (data.latitudeLoja.lessThan(-90) || data.latitudeLoja.greaterThan(90) ||
        data.longitudeLoja.lessThan(-180) || data.longitudeLoja.greaterThan(180)) {
      throw new BadRequestException('Coordenadas da loja inválidas.');
    }
    const atual = await this.prisma.configuracaoLojaEntrega.findFirst({ select: { id: true } });
    if (atual) return apresentar(await this.prisma.configuracaoLojaEntrega.update({ where: { id: atual.id }, data }));
    try {
      return apresentar(await this.prisma.configuracaoLojaEntrega.create({ data }));
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const concorrente = await this.prisma.configuracaoLojaEntrega.findFirst({ select: { id: true } });
      if (!concorrente) throw error;
      return apresentar(await this.prisma.configuracaoLojaEntrega.update({ where: { id: concorrente.id }, data }));
    }
  }
}

function apresentar(row: {
  latitudeLoja: Prisma.Decimal; longitudeLoja: Prisma.Decimal; raioMaximoAtendimento: Prisma.Decimal;
  taxaBase: Prisma.Decimal; valorPorQuilometro: Prisma.Decimal;
}) {
  return {
    latitudeLoja: row.latitudeLoja.toFixed(6),
    longitudeLoja: row.longitudeLoja.toFixed(6),
    raioMaximoAtendimento: row.raioMaximoAtendimento.toFixed(3),
    taxaBase: row.taxaBase.toFixed(2),
    valorPorQuilometro: row.valorPorQuilometro.toFixed(2),
  };
}
