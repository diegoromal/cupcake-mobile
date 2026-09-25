import { resolvePort } from './main';

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
});
