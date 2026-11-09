import { ConflictException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { GeocodificacaoService } from './geocodificacao.service';

const endereco = {
  rua: 'Rua de Teste', numero: '1', bairro: 'Centro', cidade: 'Curitiba', cep: '80000000',
  latitude: null, longitude: null,
};
const enderecoProvider = {
  postcode: '80000-000', road: 'Rua de Teste', house_number: '1',
  city: 'Curitiba', suburb: 'Centro',
};
const candidato = (address: Record<string, string> = enderecoProvider,
  lat = '-25.1234567', lon = '-49.1234567', importance = 0.1) => ({
  lat, lon, address, importance,
});

describe('GeocodificacaoService', () => {
  const originalKey = process.env.GEOCODE_MAPS_CO_API_KEY;
  const findFirst = jest.fn();
  const updateMany = jest.fn();
  const service = new GeocodificacaoService({ endereco: { findFirst, updateMany } } as never);

  beforeEach(() => {
    process.env.GEOCODE_MAPS_CO_API_KEY = 'fixture-key';
    findFirst.mockReset().mockResolvedValue(endereco);
    updateMany.mockReset().mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalKey === undefined) delete process.env.GEOCODE_MAPS_CO_API_KEY;
    else process.env.GEOCODE_MAPS_CO_API_KEY = originalKey;
  });

  function provider(data: unknown, status = 200) {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(data), { status }),
    );
    return fetchMock;
  }

  it('escolhe match completo único, ignora primeiro resultado broad e importância maior, arredonda a seis casas', async () => {
    const fetchMock = provider([
      candidato({ ...enderecoProvider, house_number: '' }, '-25.000000', '-49.000000', 0.99),
      candidato(),
      candidato({ ...enderecoProvider, road: 'Rua Diferente' }, '-26.000000', '-49.000000', 0.9),
    ]);
    await expect(service.geocodificar('cliente', 'id')).resolves.toEqual({
      latitude: '-25.123457', longitude: '-49.123457',
    });
    const requested = fetchMock.mock.calls[0][0] as URL;
    expect(requested.searchParams.get('limit')).toBe('5');
    expect(requested.searchParams.get('addressdetails')).toBe('1');
    const call = updateMany.mock.calls[0][0];
    expect(call.where).toMatchObject({ id: 'id', usuarioId: 'cliente',
      rua: endereco.rua, numero: endereco.numero, bairro: endereco.bairro,
      cidade: endereco.cidade, cep: endereco.cep, latitude: null, longitude: null });
    expect(call.data.statusLocalizacao).toBe('LOCALIZADO');
    expect(call.data.latitude.toFixed(6)).toBe('-25.123457');
  });

  it.each([
    [[], UnprocessableEntityException, 'NAO_LOCALIZADO'],
    [[candidato({ ...enderecoProvider, postcode: '99999-999' })], UnprocessableEntityException, 'NAO_LOCALIZADO'],
    [[candidato({ ...enderecoProvider, house_number: '' })], ConflictException, 'AMBIGUO'],
    [[candidato(), candidato()], ConflictException, 'AMBIGUO'],
    [[candidato({ ...enderecoProvider, suburb: '' })], ConflictException, 'AMBIGUO'],
    [[{ lat: '0', lon: '0', address: 'malformed' }], ServiceUnavailableException, 'TEMPORARIO'],
    [[candidato(enderecoProvider, '91', '-49')], ServiceUnavailableException, 'TEMPORARIO'],
  ])('classifica candidatos sem gravar coordenadas: %s', async (data, exception, status) => {
    provider(data);
    const response = service.geocodificar('cliente', 'id');
    await expect(response).rejects.toBeInstanceOf(exception);
    if (status === 'AMBIGUO') {
      await expect(response).rejects.toMatchObject({
        response: { code: 'LOCALIZACAO_AMBIGUA', statusCode: 409 },
      });
    }
    expect(updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'id', usuarioId: 'cliente' }),
      data: { statusLocalizacao: status },
    });
  });

  it('provider 503 persiste TEMPORARIO sem coordenadas', async () => {
    provider({}, 503);
    await expect(service.geocodificar('cliente', 'id'))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'id', usuarioId: 'cliente' }),
      data: { statusLocalizacao: 'TEMPORARIO' },
    });
  });

  it.each(['network', 'timeout'])('falha %s do provider persiste TEMPORARIO', async (kind) => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error(kind));
    await expect(service.geocodificar('cliente', 'id'))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'id', usuarioId: 'cliente' }),
      data: { statusLocalizacao: 'TEMPORARIO' },
    });
  });

  it('edição concorrente impede gravar coordenadas stale e mantém a nova busca', async () => {
    provider([candidato()]);
    updateMany.mockResolvedValueOnce({ count: 0 });
    findFirst.mockResolvedValueOnce(endereco).mockResolvedValueOnce({ id: 'id' });
    await expect(service.geocodificar('cliente', 'id'))
      .rejects.toMatchObject({ response: { code: 'LOCALIZACAO_ALTERADA', statusCode: 409 } });
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(findFirst).toHaveBeenLastCalledWith({ where: { id: 'id', usuarioId: 'cliente' },
      select: { id: true } });
  });

  it('falha do provider não sobrescreve PENDENTE após edição concorrente', async () => {
    provider([]);
    updateMany.mockResolvedValueOnce({ count: 0 });
    findFirst.mockResolvedValueOnce(endereco).mockResolvedValueOnce({ id: 'id' });
    await expect(service.geocodificar('cliente', 'id'))
      .rejects.toMatchObject({ response: { code: 'LOCALIZACAO_ALTERADA', statusCode: 409 } });
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany.mock.calls[0][0].data).toEqual({ statusLocalizacao: 'NAO_LOCALIZADO' });
  });

  it('não consulta provider nem atualiza endereço de outro dono', async () => {
    findFirst.mockResolvedValueOnce(null);
    const fetchMock = jest.spyOn(global, 'fetch');
    await expect(service.geocodificar('outro', 'id')).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });
});
