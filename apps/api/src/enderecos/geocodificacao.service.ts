import { ConflictException, Injectable, NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Coordenadas = { latitude: string; longitude: string };

@Injectable()
export class GeocodificacaoService {
  constructor(private readonly prisma: PrismaService) {}

  async geocodificar(usuarioId: string, id: string): Promise<Coordenadas> {
    const endereco = await this.prisma.endereco.findFirst({
      where: { id, usuarioId },
      select: { rua: true, numero: true, cidade: true, cep: true, latitude: true, longitude: true },
    });
    if (!endereco) throw new NotFoundException('Endereço não encontrado.');
    if (endereco.latitude !== null && endereco.longitude !== null) {
      return apresentar(endereco.latitude, endereco.longitude);
    }
    const resultado = await this.consultar(endereco);
    const updated = await this.prisma.endereco.updateMany({
      where: { id, usuarioId, latitude: null, longitude: null },
      data: { latitude: resultado.latitude, longitude: resultado.longitude },
    });
    if (updated.count === 0) {
      const atual = await this.prisma.endereco.findFirst({ where: { id, usuarioId }, select: { latitude: true, longitude: true } });
      if (!atual) throw new NotFoundException('Endereço não encontrado.');
      if (atual.latitude !== null && atual.longitude !== null) return apresentar(atual.latitude, atual.longitude);
      throw new ConflictException('Localização alterada por outra operação.');
    }
    return apresentar(resultado.latitude, resultado.longitude);
  }

  private async consultar(endereco: { rua: string; numero: string; cidade: string; cep: string }): Promise<{ latitude: Prisma.Decimal; longitude: Prisma.Decimal }> {
    const key = process.env.GEOCODE_MAPS_CO_API_KEY;
    if (!key) throw new ServiceUnavailableException('Geocodificação indisponível.');
    const url = new URL('https://geocode.maps.co/search');
    url.searchParams.set('street', `${endereco.numero} ${endereco.rua}`);
    url.searchParams.set('city', endereco.cidade);
    url.searchParams.set('postalcode', endereco.cep);
    url.searchParams.set('country', 'Brazil');
    url.searchParams.set('countrycodes', 'br');
    url.searchParams.set('limit', '2');
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '0');
    url.searchParams.set('extratags', '0');
    url.searchParams.set('namedetails', '0');
    let data: unknown;
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(2200),
        headers: { authorization: `Bearer ${key}`, accept: 'application/json' },
      });
      if (!response.ok) throw new Error('Provider status');
      data = await response.json();
    } catch {
      throw new ServiceUnavailableException('Geocodificação indisponível.');
    }
    if (!Array.isArray(data)) throw new ServiceUnavailableException('Geocodificação indisponível.');
    if (data.length === 0) throw new UnprocessableEntityException('Endereço não localizado.');
    if (data.length !== 1) throw new ConflictException('Endereço com localização ambígua.');
    const candidate: unknown = data[0];
    if (!candidate || typeof candidate !== 'object') throw new ServiceUnavailableException('Geocodificação indisponível.');
    const { lat, lon } = candidate as Record<string, unknown>;
    if (typeof lat !== 'string' || typeof lon !== 'string' ||
        !/^-?\d+(?:\.\d+)?$/.test(lat) || !/^-?\d+(?:\.\d+)?$/.test(lon)) {
      throw new ServiceUnavailableException('Geocodificação indisponível.');
    }
    const latitude = new Prisma.Decimal(lat);
    const longitude = new Prisma.Decimal(lon);
    if (latitude.lessThan(-90) || latitude.greaterThan(90) || longitude.lessThan(-180) || longitude.greaterThan(180)) {
      throw new ServiceUnavailableException('Geocodificação indisponível.');
    }
    return { latitude: latitude.toDecimalPlaces(6), longitude: longitude.toDecimalPlaces(6) };
  }
}

function apresentar(latitude: Prisma.Decimal, longitude: Prisma.Decimal): Coordenadas {
  return { latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) };
}
