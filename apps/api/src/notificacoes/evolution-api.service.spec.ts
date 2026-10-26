import { ServiceUnavailableException } from '@nestjs/common';
import { EvolutionApiService } from './evolution-api.service';

describe('EvolutionApiService', () => {
  const originalEnv = {
    url: process.env.EVOLUTION_API_URL,
    apiKey: process.env.EVOLUTION_API_KEY,
    instance: process.env.EVOLUTION_API_INSTANCE,
  };
  let service: EvolutionApiService;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    process.env.EVOLUTION_API_URL = 'https://evolution.example.test/';
    process.env.EVOLUTION_API_KEY = 'test-api-key';
    process.env.EVOLUTION_API_INSTANCE = 'cupcake';
    service = new EvolutionApiService();
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
    restoreEnv('EVOLUTION_API_URL', originalEnv.url);
    restoreEnv('EVOLUTION_API_KEY', originalEnv.apiKey);
    restoreEnv('EVOLUTION_API_INSTANCE', originalEnv.instance);
  });

  it('envia texto à instância configurada com autenticação apikey', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));

    await expect(service.enviarTexto('5511999999999', 'Pedido confirmado')).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://evolution.example.test/message/sendText/cupcake',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ apikey: 'test-api-key' }),
        body: JSON.stringify({ number: '5511999999999', text: 'Pedido confirmado' }),
      }),
    );
  });

  it('falha sem consultar o provedor quando a configuração está incompleta', async () => {
    delete process.env.EVOLUTION_API_KEY;

    await expect(service.enviarTexto('5511999999999', 'Mensagem'))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['', 'Mensagem'],
    ['5511999999999', '  '],
  ])('rejeita destino ou texto vazio', async (destino, texto) => {
    await expect(service.enviarTexto(destino, texto)).rejects.toBeInstanceOf(TypeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('converte respostas HTTP não exitosas em erro de indisponibilidade sem expor o corpo', async () => {
    fetchMock.mockResolvedValue(new Response('internal provider details', { status: 401 }));

    await expect(service.enviarTexto('5511999999999', 'Mensagem'))
      .rejects.toThrow('Envio de mensagem indisponível.');
  });

  it('converte falhas de rede em erro de indisponibilidade', async () => {
    fetchMock.mockRejectedValue(new Error('network failure'));

    await expect(service.enviarTexto('5511999999999', 'Mensagem'))
      .rejects.toThrow('Envio de mensagem indisponível.');
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
