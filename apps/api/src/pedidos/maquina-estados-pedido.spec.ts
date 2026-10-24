import { ModalidadeRecebimento, StatusPedido } from '../generated/prisma/enums';
import { TransicaoPedidoInvalidaError, validarTransicaoPedido } from './maquina-estados-pedido';

const transicoes: Array<[StatusPedido, StatusPedido, ModalidadeRecebimento?]> = [
  [StatusPedido.PENDENTE_PAGAMENTO, StatusPedido.PAGO],
  [StatusPedido.PENDENTE_PAGAMENTO, StatusPedido.EXPIRADO],
  [StatusPedido.PAGO, StatusPedido.EM_PREPARO],
  [StatusPedido.PAGO, StatusPedido.CANCELADO],
  [StatusPedido.EM_PREPARO, StatusPedido.SAIU_PARA_ENTREGA, ModalidadeRecebimento.ENTREGA],
  [StatusPedido.EM_PREPARO, StatusPedido.PRONTO_PARA_RETIRADA, ModalidadeRecebimento.RETIRADA],
  [StatusPedido.SAIU_PARA_ENTREGA, StatusPedido.ENTREGUE, ModalidadeRecebimento.ENTREGA],
  [StatusPedido.PRONTO_PARA_RETIRADA, StatusPedido.RETIRADO, ModalidadeRecebimento.RETIRADA],
];

describe('máquina de estados do pedido', () => {
  it('permite todas as transições explicitamente definidas', () => {
    for (const [atual, proximo, modalidade] of transicoes) {
      expect(() => validarTransicaoPedido(atual, proximo, modalidade)).not.toThrow();
    }
  });

  it('rejeita todas as transições não listadas, inclusive estado repetido', () => {
    const permitidas = new Set(transicoes.map(([atual, proximo]) => `${atual}:${proximo}`));
    for (const atual of Object.values(StatusPedido)) {
      for (const proximo of Object.values(StatusPedido)) {
        if (!permitidas.has(`${atual}:${proximo}`)) {
          expect(() => validarTransicaoPedido(atual, proximo)).toThrow(TransicaoPedidoInvalidaError);
        }
      }
    }
  });

  it('rejeita modalidades incompatíveis para as transições de modalidade', () => {
    for (const [atual, proximo, modalidade] of [
      [StatusPedido.EM_PREPARO, StatusPedido.SAIU_PARA_ENTREGA, ModalidadeRecebimento.RETIRADA],
      [StatusPedido.EM_PREPARO, StatusPedido.PRONTO_PARA_RETIRADA, ModalidadeRecebimento.ENTREGA],
      [StatusPedido.SAIU_PARA_ENTREGA, StatusPedido.ENTREGUE, ModalidadeRecebimento.RETIRADA],
      [StatusPedido.PRONTO_PARA_RETIRADA, StatusPedido.RETIRADO, ModalidadeRecebimento.ENTREGA],
    ] as const) {
      expect(() => validarTransicaoPedido(atual, proximo, modalidade)).toThrow(TransicaoPedidoInvalidaError);
    }
  });

  it('exige modalidade nas transições específicas de entrega e retirada', () => {
    for (const [atual, proximo] of [
      [StatusPedido.EM_PREPARO, StatusPedido.SAIU_PARA_ENTREGA],
      [StatusPedido.EM_PREPARO, StatusPedido.PRONTO_PARA_RETIRADA],
      [StatusPedido.SAIU_PARA_ENTREGA, StatusPedido.ENTREGUE],
      [StatusPedido.PRONTO_PARA_RETIRADA, StatusPedido.RETIRADO],
    ] as const) {
      expect(() => validarTransicaoPedido(atual, proximo)).toThrow(TransicaoPedidoInvalidaError);
    }
  });
});
