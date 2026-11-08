import { ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { GeocodificacaoService } from './geocodificacao.service';

describe('GeocodificacaoService', () => {
  const originalKey = process.env.GEOCODE_MAPS_CO_API_KEY;
  const findAddress = jest.fn().mockResolvedValue({
    rua: 'Rua de Teste', numero: '1', cidade: 'Curitiba', cep: '80000000',
    latitude: null, longitude: null,
  });
  const updateAddress = jest.fn();
  const service = new GeocodificacaoService({
    endereco: { findFirst: findAddress, updateMany: updateAddress },
  } as never);

  beforeEach(() => {
    process.env.GEOCODE_MAPS_CO_API_KEY = 'test-key';
    findAddress.mockClear();
    updateAddress.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalKey === undefined) delete process.env.GEOCODE_MAPS_CO_API_KEY;
    else process.env.GEOCODE_MAPS_CO_API_KEY = originalKey;
  });

  it('resposta 503 do provider vira falha temporária, sem persistir coordenadas', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 503 }));
    await expect(service.geocodificar('cliente', 'endereco'))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(updateAddress).not.toHaveBeenCalled();
  });

  it('provider sem localização vira 422, sem persistir coordenadas', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('[]', { status: 200 }));
    await expect(service.geocodificar('cliente', 'endereco'))
      .rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(updateAddress).not.toHaveBeenCalled();
  });
});
