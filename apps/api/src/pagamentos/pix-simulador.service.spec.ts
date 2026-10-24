import { PixSimuladorService } from './pix-simulador.service';

describe('PixSimuladorService', () => {
  it.each('0123456789abcdef'.split(''))('reproduz o resultado do UUID terminado em %s entre instâncias', async (digito) => {
    const id = `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${digito}`;
    const esperado = '02468ace'.includes(digito) ? 'APROVADO' : 'RECUSADO';
    expect(await new PixSimuladorService().simular(id)).toBe(esperado);
    expect(await new PixSimuladorService().simular(id.toUpperCase())).toBe(esperado);
  });
});
