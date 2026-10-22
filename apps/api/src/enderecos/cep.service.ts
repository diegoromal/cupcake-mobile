import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { cepValido, normalizarCep } from './dto/create-endereco.dto';

@Injectable()
export class CepService {
  async consultar(raw: string) {
    if (!cepValido(raw)) throw new BadRequestException('CEP inválido.');
    const cep = normalizarCep(raw);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
        signal: AbortSignal.timeout(2200),
        headers: { accept: 'application/json' },
      });
      if (!response.ok) throw new ServiceUnavailableException('Consulta de CEP indisponível.');
      const data: unknown = await response.json();
      if (!data || typeof data !== 'object') throw new Error('Resposta inválida');
      const item = data as Record<string, unknown>;
      if (item.erro === true) throw new NotFoundException('CEP não encontrado.');
      if (typeof item.logradouro !== 'string' || typeof item.bairro !== 'string' ||
          typeof item.localidade !== 'string' || typeof item.uf !== 'string' ||
          !/^[A-Z]{2}$/.test(item.uf)) throw new Error('Resposta inválida');
      return { cep, rua: item.logradouro, bairro: item.bairro, cidade: item.localidade, uf: item.uf };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new ServiceUnavailableException('Consulta de CEP indisponível.');
    }
  }
}
