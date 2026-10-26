import { ConflictException, NotFoundException } from '@nestjs/common';
import { ModalidadeRecebimento, StatusPedido } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { PedidosService } from './pedidos.service';

const agora = new Date('2026-10-25T12:34:00.000Z');

function setup(statusAtual: StatusPedido, modalidade: ModalidadeRecebimento = ModalidadeRecebimento.ENTREGA) {
  const query = jest.fn()
    .mockResolvedValueOnce([{ statusAtual, modalidade }])
    .mockResolvedValueOnce([{ agora }]);
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const create = jest.fn().mockResolvedValue({ id: 'historico' });
  const db = { $queryRaw: query, pedido: { updateMany }, historicoStatusPedido: { create } };
  const transaction = jest.fn((callback: (value: typeof db) => Promise<unknown>) => callback(db));
  const service = new PedidosService(
    { $transaction: transaction } as unknown as PrismaService,
    { agendarStatusPedido: jest.fn().mockResolvedValue(undefined) } as never,
  );
  return { service, query, updateMany, create, transaction };
}

describe('confirmarEntrega', () => {
  it('D75 exige transição elegível e D76 grava status, histórico e mesmo horário', async () => {
    const { service, updateMany, create, transaction } = setup(StatusPedido.SAIU_PARA_ENTREGA);
    expect(await service.confirmarEntrega('pedido-id', 'courier-id'))
      .toEqual({ statusAtual: StatusPedido.ENTREGUE, dataHora: agora });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'pedido-id', entregadorUsuarioId: 'courier-id',
        modalidade: ModalidadeRecebimento.ENTREGA,
        statusAtual: StatusPedido.SAIU_PARA_ENTREGA,
      },
      data: { statusAtual: StatusPedido.ENTREGUE },
    });
    expect(create).toHaveBeenCalledWith({ data: {
      pedidoId: 'pedido-id', statusRegistrado: StatusPedido.ENTREGUE,
      dataHora: agora, responsavelUsuarioId: 'courier-id',
    } });
  });

  it('ausente ou alheio retorna 404 sem escrever', async () => {
    const { service, query, updateMany, create } = setup(StatusPedido.SAIU_PARA_ENTREGA);
    query.mockReset().mockResolvedValue([]);
    await expect(service.confirmarEntrega('pedido-id', 'outro-id'))
      .rejects.toThrow(NotFoundException);
    expect(updateMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    [StatusPedido.PAGO, ModalidadeRecebimento.ENTREGA],
    [StatusPedido.SAIU_PARA_ENTREGA, ModalidadeRecebimento.RETIRADA],
    [StatusPedido.ENTREGUE, ModalidadeRecebimento.ENTREGA],
  ])('status %s e modalidade %s retornam 409 sem escrita', async (status, modalidade) => {
    const { service, updateMany, create } = setup(status, modalidade);
    await expect(service.confirmarEntrega('pedido-id', 'courier-id'))
      .rejects.toThrow(ConflictException);
    expect(updateMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
