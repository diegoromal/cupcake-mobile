import { ModalidadeRecebimento, StatusPedido } from '../generated/prisma/enums';

const transicoesPermitidas: Partial<Record<StatusPedido, readonly StatusPedido[]>> = {
  [StatusPedido.PENDENTE_PAGAMENTO]: [StatusPedido.PAGO, StatusPedido.EXPIRADO],
  [StatusPedido.PAGO]: [StatusPedido.EM_PREPARO, StatusPedido.CANCELADO],
  [StatusPedido.EM_PREPARO]: [StatusPedido.SAIU_PARA_ENTREGA, StatusPedido.PRONTO_PARA_RETIRADA],
  [StatusPedido.SAIU_PARA_ENTREGA]: [StatusPedido.ENTREGUE],
  [StatusPedido.PRONTO_PARA_RETIRADA]: [StatusPedido.RETIRADO],
};

export class TransicaoPedidoInvalidaError extends Error {
  constructor() {
    super('Transição de status do pedido não permitida.');
    this.name = TransicaoPedidoInvalidaError.name;
  }
}

export function validarTransicaoPedido(
  atual: StatusPedido,
  proximo: StatusPedido,
  modalidade?: ModalidadeRecebimento,
): void {
  const permitida = transicoesPermitidas[atual]?.includes(proximo) ?? false;
  if (!permitida || !modalidadeCompativel(atual, proximo, modalidade)) {
    throw new TransicaoPedidoInvalidaError();
  }
}

function modalidadeCompativel(
  atual: StatusPedido,
  proximo: StatusPedido,
  modalidade?: ModalidadeRecebimento,
) {
  if (atual === StatusPedido.EM_PREPARO && proximo === StatusPedido.SAIU_PARA_ENTREGA) {
    return modalidade === ModalidadeRecebimento.ENTREGA;
  }
  if (atual === StatusPedido.EM_PREPARO && proximo === StatusPedido.PRONTO_PARA_RETIRADA) {
    return modalidade === ModalidadeRecebimento.RETIRADA;
  }
  if (atual === StatusPedido.SAIU_PARA_ENTREGA && proximo === StatusPedido.ENTREGUE) {
    return modalidade === ModalidadeRecebimento.ENTREGA;
  }
  if (atual === StatusPedido.PRONTO_PARA_RETIRADA && proximo === StatusPedido.RETIRADO) {
    return modalidade === ModalidadeRecebimento.RETIRADA;
  }
  return true;
}
