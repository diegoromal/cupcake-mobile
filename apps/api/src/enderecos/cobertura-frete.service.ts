import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const RAIO_TERRA_KM = 6371.0088;

type CoordenadasEndereco = { latitude: Prisma.Decimal | null; longitude: Prisma.Decimal | null };
type ConfiguracaoFrete = {
  latitudeLoja: Prisma.Decimal;
  longitudeLoja: Prisma.Decimal;
  raioMaximoAtendimento: Prisma.Decimal;
  taxaBase: Prisma.Decimal;
  valorPorQuilometro: Prisma.Decimal;
};

@Injectable()
export class CoberturaFreteService {
  constructor(private readonly prisma: PrismaService) {}

  async consultar(usuarioId: string, enderecoId: string) {
    const endereco = await this.prisma.endereco.findFirst({
      where: { id: enderecoId, usuarioId },
      select: { latitude: true, longitude: true },
    });
    if (!endereco) throw new NotFoundException('Endereço não encontrado.');
    if (!coordenadasValidas(endereco.latitude, endereco.longitude)) {
      return calcularCoberturaFrete(endereco, null);
    }

    const configuracao = await this.prisma.configuracaoLojaEntrega.findFirst({
      select: {
        latitudeLoja: true, longitudeLoja: true, raioMaximoAtendimento: true,
        taxaBase: true, valorPorQuilometro: true,
      },
    });
    return calcularCoberturaFrete(endereco, configuracao);
  }
}

export function calcularCoberturaFrete(
  endereco: CoordenadasEndereco,
  configuracao: ConfiguracaoFrete | null,
) {
  if (!coordenadasValidas(endereco.latitude, endereco.longitude)) {
    return { situacao: 'LOCALIZACAO_INDISPONIVEL', distanciaKm: null, raioMaximoKm: null, frete: null };
  }
  if (!configuracao || !coordenadasValidas(configuracao.latitudeLoja, configuracao.longitudeLoja) ||
        !decimalNaoNegativo(configuracao.raioMaximoAtendimento) ||
        !decimalNaoNegativo(configuracao.taxaBase) ||
        !decimalNaoNegativo(configuracao.valorPorQuilometro)) {
    throw new ServiceUnavailableException('Configuração de entrega indisponível.');
  }

  const distanciaKm = distanciaEmKm(
    configuracao.latitudeLoja.toNumber(), configuracao.longitudeLoja.toNumber(),
    endereco.latitude!.toNumber(), endereco.longitude!.toNumber(),
  );
  const raioMaximoKm = configuracao.raioMaximoAtendimento.toFixed(3);
  if (distanciaKm > configuracao.raioMaximoAtendimento.toNumber()) {
    return { situacao: 'FORA_DA_COBERTURA', distanciaKm: distanciaKm.toFixed(3), raioMaximoKm, frete: null };
  }

  // A distância integral entra na fórmula; o arredondamento de três casas é apenas de apresentação.
  const frete = configuracao.taxaBase.plus(
    configuracao.valorPorQuilometro.times(new Prisma.Decimal(distanciaKm.toString())),
  );
  return { situacao: 'ATENDIDO', distanciaKm: distanciaKm.toFixed(3), raioMaximoKm, frete: frete.toFixed(2) };
}

function decimalNaoNegativo(valor: Prisma.Decimal): boolean {
  return Prisma.Decimal.isDecimal(valor) && valor.isFinite() && !valor.isNegative();
}

function coordenadasValidas(latitude: Prisma.Decimal | null, longitude: Prisma.Decimal | null): boolean {
  return latitude !== null && longitude !== null &&
    Prisma.Decimal.isDecimal(latitude) && Prisma.Decimal.isDecimal(longitude) &&
    latitude.isFinite() && longitude.isFinite() &&
    latitude.greaterThanOrEqualTo(-90) && latitude.lessThanOrEqualTo(90) &&
    longitude.greaterThanOrEqualTo(-180) && longitude.lessThanOrEqualTo(180);
}

function distanciaEmKm(latA: number, lonA: number, latB: number, lonB: number): number {
  const radianos = Math.PI / 180;
  const deltaLatitude = (latB - latA) * radianos;
  const deltaLongitude = (lonB - lonA) * radianos;
  const senoLatitude = Math.sin(deltaLatitude / 2);
  const senoLongitude = Math.sin(deltaLongitude / 2);
  const haversine = senoLatitude ** 2 +
    Math.cos(latA * radianos) * Math.cos(latB * radianos) * senoLongitude ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.sqrt(Math.min(1, haversine)));
}
