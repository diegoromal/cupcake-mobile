import { ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { CoberturaFreteService, calcularCoberturaFrete } from './cobertura-frete.service';

const decimal = (value: string) => new Prisma.Decimal(value);
const loja = (raio: string) => ({
  latitudeLoja: decimal('0'), longitudeLoja: decimal('0'),
  raioMaximoAtendimento: decimal(raio), taxaBase: decimal('5.00'),
  valorPorQuilometro: decimal('2.00'),
});
const origem = { latitude: decimal('0'), longitude: decimal('0') };

describe('CoberturaFreteService', () => {
  it('permite endereço dentro do raio e calcula frete', () => {
    expect(calcularCoberturaFrete(origem, loja('5'))).toEqual({
      situacao: 'ATENDIDO', distanciaKm: '0.000', raioMaximoKm: '5.000', frete: '5.00',
    });
  });

  it('inclui endereço exatamente no limite do raio', () => {
    expect(calcularCoberturaFrete(origem, loja('0'))).toEqual({
      situacao: 'ATENDIDO', distanciaKm: '0.000', raioMaximoKm: '0.000', frete: '5.00',
    });
  });

  it('rejeita endereço acima do raio com o raio real da configuração', () => {
    const resultado = calcularCoberturaFrete(
      { latitude: decimal('0.1'), longitude: decimal('0') }, loja('10'),
    );
    expect(resultado).toEqual({
      situacao: 'FORA_DA_COBERTURA', distanciaKm: '11.120', raioMaximoKm: '10.000', frete: null,
    });
  });

  it('retorna localização indisponível sem consultar configuração quando faltam coordenadas', async () => {
    const findAddress = jest.fn().mockResolvedValue({ latitude: null, longitude: null });
    const findConfig = jest.fn();
    const service = new CoberturaFreteService({
      endereco: { findFirst: findAddress },
      configuracaoLojaEntrega: { findFirst: findConfig },
    } as never);
    await expect(service.consultar('cliente', 'endereco')).resolves.toEqual({
      situacao: 'LOCALIZACAO_INDISPONIVEL', distanciaKm: null, raioMaximoKm: null, frete: null,
    });
    expect(findConfig).not.toHaveBeenCalled();
  });

  it('sinaliza configuração indisponível como 503 sem classificar fora da cobertura', () => {
    expect(() => calcularCoberturaFrete(origem, null)).toThrow(ServiceUnavailableException);
  });
});
