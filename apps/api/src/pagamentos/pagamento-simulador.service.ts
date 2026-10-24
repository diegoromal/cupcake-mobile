import { Injectable } from '@nestjs/common';
import { setTimeout } from 'node:timers/promises';

@Injectable()
export class PagamentoSimuladorService {
  async simular(tentativaId: string): Promise<'APROVADO' | 'RECUSADO'> {
    await setTimeout(50);
    // A paridade do último dígito do UUID independe de memória, relógio e processo.
    return Number.parseInt(tentativaId.slice(-1), 16) % 2 === 0 ? 'APROVADO' : 'RECUSADO';
  }
}
