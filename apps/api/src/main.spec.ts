import { NestFactory } from '@nestjs/core';
import { bootstrap, resolvePort } from './main';

afterEach(() => jest.restoreAllMocks());

describe('resolvePort', () => {
  it('usa a porta padrão quando PORT não está definida', () => {
    expect(resolvePort(undefined)).toBe(3000);
  });

  it('aceita uma porta definida no ambiente', () => {
    expect(resolvePort('3100')).toBe(3100);
  });

  it('rejeita uma porta inválida', () => {
    expect(() => resolvePort('invalida')).toThrow(
      'PORT deve ser um número inteiro entre 1 e 65535.',
    );
  });

  it('habilita os hooks de encerramento para aguardar notificações pendentes', async () => {
    const app = {
      enableShutdownHooks: jest.fn(),
      listen: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(NestFactory, 'create').mockResolvedValue(app as never);

    await bootstrap();

    expect(app.enableShutdownHooks).toHaveBeenCalledTimes(1);
    expect(app.listen).toHaveBeenCalledWith(resolvePort());
  });
});
