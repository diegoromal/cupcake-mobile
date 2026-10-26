import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ResultadoNotificacao, StatusPedido } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { EvolutionApiService } from './evolution-api.service';

export interface EventoStatusPedido {
  pedidoId: string;
  identificadorNegocio: string;
  telefone: string;
  status: StatusPedido;
}

const templates: Partial<Record<StatusPedido, (pedido: string) => string>> = {
  [StatusPedido.PAGO]: (pedido) => `Pagamento do pedido ${pedido} aprovado.`,
  [StatusPedido.EM_PREPARO]: (pedido) => `Seu pedido ${pedido} está em preparo.`,
  [StatusPedido.SAIU_PARA_ENTREGA]: (pedido) => `Seu pedido ${pedido} saiu para entrega.`,
  [StatusPedido.ENTREGUE]: (pedido) => `Seu pedido ${pedido} foi entregue.`,
  [StatusPedido.PRONTO_PARA_RETIRADA]: (pedido) => `Seu pedido ${pedido} está pronto para retirada.`,
  [StatusPedido.RETIRADO]: (pedido) => `A retirada do pedido ${pedido} foi confirmada.`,
};

@Injectable()
export class NotificacoesService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificacoesService.name);
  private readonly enviosPendentes = new Set<Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly evolutionApi: EvolutionApiService,
  ) {}

  agendarStatusPedido(evento: EventoStatusPedido): void {
    const envio = Promise.resolve()
      .then(() => this.notificarStatusPedido(evento))
      .catch(() => this.logger.error(`Falha inesperada na notificação do pedido ${evento.pedidoId}.`))
      .finally(() => this.enviosPendentes.delete(envio));
    this.enviosPendentes.add(envio);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.enviosPendentes);
  }

  async notificarStatusPedido(evento: EventoStatusPedido): Promise<void> {
    const criarTexto = templates[evento.status];
    if (!criarTexto) return;

    let destino = evento.telefone.trim();
    let resultado: ResultadoNotificacao = ResultadoNotificacao.FALHA;
    try {
      destino = normalizarTelefoneBrasileiro(destino);
      await this.evolutionApi.enviarTexto(destino, criarTexto(evento.identificadorNegocio));
      resultado = ResultadoNotificacao.SUCESSO;
    } catch {
      this.logger.warn(`Falha no envio WhatsApp do pedido ${evento.pedidoId} (${evento.status}).`);
    }

    try {
      await this.prisma.notificacao.create({ data: {
        pedidoId: evento.pedidoId,
        eventoStatusOriginador: evento.status,
        destino,
        canal: 'WHATSAPP',
        resultado,
        dataHora: new Date(),
      } });
    } catch {
      this.logger.error(`Falha ao registrar notificação WhatsApp do pedido ${evento.pedidoId} (${evento.status}).`);
    }
  }
}

function normalizarTelefoneBrasileiro(telefone: string): string {
  const digitos = telefone.replace(/\D/g, '');
  if (telefone.trim().startsWith('+')) {
    if (digitos.length < 8 || digitos.length > 15) {
      throw new Error('Telefone incompatível com o formato internacional.');
    }
    return digitos;
  }
  const nacional = digitos.startsWith('55') ? digitos.slice(2) : digitos;
  if (nacional.length !== 10 && nacional.length !== 11) {
    throw new Error('Telefone incompatível com o formato brasileiro.');
  }
  return `55${nacional}`;
}
