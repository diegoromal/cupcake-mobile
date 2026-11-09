import { ConflictException, Injectable, NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { StatusLocalizacaoEndereco } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

type Coordenadas = { latitude: string; longitude: string };
type EnderecoBusca = { rua: string; numero: string; bairro: string; cidade: string; cep: string };
type EnderecoCapturado = EnderecoBusca & { latitude: Prisma.Decimal | null; longitude: Prisma.Decimal | null };
type Candidato = { latitude: Prisma.Decimal; longitude: Prisma.Decimal; address: Record<string, string> };

@Injectable()
export class GeocodificacaoService {
  constructor(private readonly prisma: PrismaService) {}

  async geocodificar(usuarioId: string, id: string): Promise<Coordenadas> {
    const endereco = await this.prisma.endereco.findFirst({
      where: { id, usuarioId },
      select: { rua: true, numero: true, bairro: true, cidade: true, cep: true, latitude: true, longitude: true },
    });
    if (!endereco) throw new NotFoundException('Endereço não encontrado.');
    if (endereco.latitude !== null && endereco.longitude !== null) {
      return apresentar(endereco.latitude, endereco.longitude);
    }
    let resultado: { latitude: Prisma.Decimal; longitude: Prisma.Decimal };
    try {
      resultado = await this.consultar(endereco);
    } catch (error) {
      const status = error instanceof UnprocessableEntityException
        ? StatusLocalizacaoEndereco.NAO_LOCALIZADO
        : error instanceof ConflictException
          ? StatusLocalizacaoEndereco.AMBIGUO
          : error instanceof ServiceUnavailableException
            ? StatusLocalizacaoEndereco.TEMPORARIO : null;
      if (status) await this.persistirEstado(usuarioId, id, endereco, status);
      throw error;
    }
    await this.persistirEstado(usuarioId, id, endereco, StatusLocalizacaoEndereco.LOCALIZADO, resultado);
    return apresentar(resultado.latitude, resultado.longitude);
  }

  private async persistirEstado(
    usuarioId: string, id: string, endereco: EnderecoCapturado,
    statusLocalizacao: StatusLocalizacaoEndereco,
    coordenadas?: { latitude: Prisma.Decimal; longitude: Prisma.Decimal },
  ) {
    const updated = await this.prisma.endereco.updateMany({
      where: {
        id, usuarioId, rua: endereco.rua, numero: endereco.numero, bairro: endereco.bairro,
        cidade: endereco.cidade, cep: endereco.cep, latitude: null, longitude: null,
      },
      data: {
        statusLocalizacao,
        ...(coordenadas && { latitude: coordenadas.latitude, longitude: coordenadas.longitude }),
      },
    });
    if (updated.count !== 1) {
      const atual = await this.prisma.endereco.findFirst({ where: { id, usuarioId }, select: { id: true } });
      if (!atual) throw new NotFoundException('Endereço não encontrado.');
      throw new ConflictException({
        code: 'LOCALIZACAO_ALTERADA',
        message: 'Endereço alterado durante a localização. Tente novamente.',
        statusCode: 409,
      });
    }
  }

  private async consultar(endereco: EnderecoBusca): Promise<{ latitude: Prisma.Decimal; longitude: Prisma.Decimal }> {
    const key = process.env.GEOCODE_MAPS_CO_API_KEY;
    if (!key) throw new ServiceUnavailableException('Geocodificação indisponível.');
    const url = new URL('https://geocode.maps.co/search');
    url.searchParams.set('street', `${endereco.numero} ${endereco.rua}`);
    url.searchParams.set('city', endereco.cidade);
    url.searchParams.set('postalcode', endereco.cep);
    url.searchParams.set('country', 'Brazil');
    url.searchParams.set('countrycodes', 'br');
    url.searchParams.set('limit', '5');
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('extratags', '0');
    url.searchParams.set('namedetails', '0');
    // Geocode.Maps.co supports the api_key query parameter. Keep the key out of
    // headers and logs; URL is only passed directly to fetch.
    url.searchParams.set('api_key', key);
    let data: unknown;
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(2200),
        headers: { accept: 'application/json' },
      });
      if (!response.ok) throw new Error('Provider status');
      data = await response.json();
    } catch {
      throw new ServiceUnavailableException('Geocodificação indisponível.');
    }
    if (!Array.isArray(data) || data.length > 5) throw new ServiceUnavailableException('Geocodificação indisponível.');
    if (data.length === 0) throw new UnprocessableEntityException('Endereço não localizado.');
    const candidatos = data.map(lerCandidato);
    const compativeis = candidatos.filter((candidate) => !conflitoExplicito(endereco, candidate.address));
    const completos = compativeis.filter((candidate) => matchCompleto(endereco, candidate.address));
    if (completos.length === 1) {
      return { latitude: completos[0].latitude, longitude: completos[0].longitude };
    }
    if (completos.length > 1 || compativeis.length > 0) {
      throw new ConflictException({
        code: 'LOCALIZACAO_AMBIGUA',
        message: 'Endereço com localização ambígua.',
        statusCode: 409,
      });
    }
    throw new UnprocessableEntityException('Endereço não localizado.');
  }
}

function lerCandidato(value: unknown): Candidato {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ServiceUnavailableException('Geocodificação indisponível.');
  }
  const item = value as Record<string, unknown>;
  if (typeof item.lat !== 'string' || typeof item.lon !== 'string' ||
      !/^-?\d+(?:\.\d+)?$/.test(item.lat) || !/^-?\d+(?:\.\d+)?$/.test(item.lon) ||
      !item.address || typeof item.address !== 'object' || Array.isArray(item.address)) {
    throw new ServiceUnavailableException('Geocodificação indisponível.');
  }
  const address = item.address as Record<string, unknown>;
  if (Object.values(address).some((field) => field !== null && typeof field !== 'string')) {
    throw new ServiceUnavailableException('Geocodificação indisponível.');
  }
  let latitude: Prisma.Decimal;
  let longitude: Prisma.Decimal;
  try {
    latitude = new Prisma.Decimal(item.lat);
    longitude = new Prisma.Decimal(item.lon);
  } catch {
    throw new ServiceUnavailableException('Geocodificação indisponível.');
  }
  if (!latitude.isFinite() || !longitude.isFinite() ||
      latitude.lessThan(-90) || latitude.greaterThan(90) ||
      longitude.lessThan(-180) || longitude.greaterThan(180)) {
    throw new ServiceUnavailableException('Geocodificação indisponível.');
  }
  return { latitude: latitude.toDecimalPlaces(6), longitude: longitude.toDecimalPlaces(6),
    address: address as Record<string, string> };
}

function campos(endereco: EnderecoBusca, address: Record<string, string>) {
  return [
    [endereco.cep.replace(/\D/g, ''), primeiro(address, 'postcode').replace(/\D/g, '')],
    [normalizar(endereco.rua), normalizar(primeiro(address, 'road', 'pedestrian', 'residential', 'street'))],
    [normalizar(endereco.numero), normalizar(primeiro(address, 'house_number'))],
    [normalizar(endereco.cidade), normalizar(primeiro(address, 'city', 'town', 'village', 'municipality'))],
    [normalizar(endereco.bairro), normalizar(primeiro(address, 'suburb', 'neighbourhood', 'quarter', 'city_district'))],
  ];
}

function conflitoExplicito(endereco: EnderecoBusca, address: Record<string, string>) {
  return campos(endereco, address).some(([expected, actual]) => actual !== '' && expected !== actual);
}

function matchCompleto(endereco: EnderecoBusca, address: Record<string, string>) {
  return campos(endereco, address).every(([expected, actual]) => expected === actual);
}

function primeiro(address: Record<string, string>, ...keys: string[]) {
  return keys.map((key) => address[key]).find((value) => typeof value === 'string' && value.trim() !== '') ?? '';
}

function normalizar(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function apresentar(latitude: Prisma.Decimal, longitude: Prisma.Decimal): Coordenadas {
  return { latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) };
}
