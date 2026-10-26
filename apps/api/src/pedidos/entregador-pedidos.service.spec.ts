import { NotFoundException } from '@nestjs/common';
import { ModalidadeRecebimento, StatusPedido } from '../generated/prisma/enums';
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

describe('detalharParaEntregador', () => {
  it('filtra id, dono e modalidade e devolve só snapshot e saída do histórico', async () => {
    const dataHora = new Date('2026-10-25T12:34:00.000Z');
    const pedido = {
      identificadorNegocio: 'PED-42',
      cliente: { nome: 'Cliente', telefone: '11999999999' },
      enderecoEntregaSnapshot: {
        rua: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'São Paulo',
        cep: '01001000', complemento: null, referencia: 'Portaria',
      },
      historicosStatus: [{ dataHora }],
    };
    const findFirst = jest.fn().mockResolvedValue(pedido);
    const service = new PedidosService({ pedido: { findFirst } } as unknown as PrismaService);

    expect(await service.detalharParaEntregador('pedido-id', 'entregador-id')).toEqual({
      identificadorNegocio: pedido.identificadorNegocio,
      cliente: pedido.cliente,
      enderecoEntregaSnapshot: pedido.enderecoEntregaSnapshot,
      dataHoraSaidaParaEntrega: dataHora,
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: 'pedido-id', entregadorUsuarioId: 'entregador-id',
        modalidade: ModalidadeRecebimento.ENTREGA,
      },
      select: {
        identificadorNegocio: true,
        cliente: { select: { nome: true, telefone: true } },
        enderecoEntregaSnapshot: { select: {
          rua: true, numero: true, bairro: true, cidade: true, cep: true,
          complemento: true, referencia: true,
        } },
        historicosStatus: {
          where: { statusRegistrado: StatusPedido.SAIU_PARA_ENTREGA },
          orderBy: [{ dataHora: 'desc' }, { id: 'desc' }], take: 1,
          select: { dataHora: true },
        },
      },
    });
  });

  it('usa 404 uniforme para inexistente, alheio e retirada', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const service = new PedidosService({ pedido: { findFirst } } as unknown as PrismaService);
    await expect(service.detalharParaEntregador('pedido-id', 'entregador-id'))
      .rejects.toThrow(NotFoundException);
  });

  it('não substitui histórico ausente pela data do pedido', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      identificadorNegocio: 'PED-42',
      cliente: { nome: 'Cliente', telefone: '11999999999' },
      enderecoEntregaSnapshot: null,
      historicosStatus: [],
    });
    const service = new PedidosService({ pedido: { findFirst } } as unknown as PrismaService);
    expect(await service.detalharParaEntregador('pedido-id', 'entregador-id'))
      .toMatchObject({ dataHoraSaidaParaEntrega: null });
  });
});
