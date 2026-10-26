import { ModalidadeRecebimento } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { PedidosService } from './pedidos.service';

describe('listarParaEntregador', () => {
  it('filtra pelo dono e entrega, sem status, projetando somente o resumo', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 'pedido-1', identificadorNegocio: 'PED-1', statusAtual: 'SAIU_PARA_ENTREGA' },
      { id: 'pedido-2', identificadorNegocio: 'PED-2', statusAtual: 'ENTREGUE' },
    ]);
    const service = new PedidosService({ pedido: { findMany } } as unknown as PrismaService);

    expect(await service.listarParaEntregador('entregador-autenticado')).toHaveLength(2);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        entregadorUsuarioId: 'entregador-autenticado',
        modalidade: ModalidadeRecebimento.ENTREGA,
      },
      select: { id: true, identificadorNegocio: true, statusAtual: true },
    });
  });
});
