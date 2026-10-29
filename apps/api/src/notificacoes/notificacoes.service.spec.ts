import { Logger } from '@nestjs/common';
import { ResultadoNotificacao, StatusPedido } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { TEST_NOTIFICATION_PHONE } from '../../test/test-notification-phone';
import { EvolutionApiService } from './evolution-api.service';
import { NotificacoesService } from './notificacoes.service';

describe('NotificacoesService', () => {
  const pedidoId = 'pedido-1';
  const eventoBase = {
    pedidoId,
    identificadorNegocio: 'PED-123',
    telefone: TEST_NOTIFICATION_PHONE,
  };
  let criar: jest.Mock;
  let enviarTexto: jest.Mock;
  let service: NotificacoesService;

  beforeEach(() => {
    criar = jest.fn().mockResolvedValue({});
    enviarTexto = jest.fn().mockResolvedValue(undefined);
    service = new NotificacoesService(
      { notificacao: { create: criar } } as unknown as PrismaService,
      { enviarTexto } as unknown as EvolutionApiService,
    );
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([
    [StatusPedido.PAGO, 'Pagamento do pedido PED-123 aprovado.'],
    [StatusPedido.EM_PREPARO, 'Seu pedido PED-123 está em preparo.'],
    [StatusPedido.SAIU_PARA_ENTREGA, 'Seu pedido PED-123 saiu para entrega.'],
    [StatusPedido.ENTREGUE, 'Seu pedido PED-123 foi entregue.'],
    [StatusPedido.PRONTO_PARA_RETIRADA, 'Seu pedido PED-123 está pronto para retirada.'],
    [StatusPedido.RETIRADO, 'A retirada do pedido PED-123 foi confirmada.'],
  ])('renderiza e registra template de %s', async (status, texto) => {
    await service.notificarStatusPedido({ ...eventoBase, status });

    expect(enviarTexto).toHaveBeenCalledWith(TEST_NOTIFICATION_PHONE, texto);
    expect(criar).toHaveBeenCalledWith({ data: expect.objectContaining({
      pedidoId,
      eventoStatusOriginador: status,
      destino: TEST_NOTIFICATION_PHONE,
      canal: 'WHATSAPP',
      resultado: ResultadoNotificacao.SUCESSO,
      dataHora: expect.any(Date),
    }) });
  });

  it('registra falha do provedor sem propagar erro ao fluxo do pedido', async () => {
    enviarTexto.mockRejectedValue(new Error('provider unavailable'));

    await expect(service.notificarStatusPedido({ ...eventoBase, status: StatusPedido.PAGO }))
      .resolves.toBeUndefined();

    expect(criar).toHaveBeenCalledWith({ data: expect.objectContaining({
      resultado: ResultadoNotificacao.FALHA,
    }) });
  });

  it('agenda o envio sem aguardar a Evolution e aguarda o resultado no encerramento normal', async () => {
    let concluirEnvio!: () => void;
    enviarTexto.mockReturnValue(new Promise<void>((resolve) => { concluirEnvio = resolve; }));

    service.agendarStatusPedido({ ...eventoBase, status: StatusPedido.PAGO });
    await Promise.resolve();

    expect(enviarTexto).toHaveBeenCalled();
    expect(criar).not.toHaveBeenCalled();
    concluirEnvio();
    await service.onModuleDestroy();

    expect(criar).toHaveBeenCalledWith({ data: expect.objectContaining({
      resultado: ResultadoNotificacao.SUCESSO,
    }) });
  });

  it('registra falha quando o telefone não pode ser enviado e não chama a API', async () => {
    await service.notificarStatusPedido({
      ...eventoBase, telefone: 'inválido', status: StatusPedido.PAGO,
    });

    expect(enviarTexto).not.toHaveBeenCalled();
    expect(criar).toHaveBeenCalledWith({ data: expect.objectContaining({
      destino: 'inválido', resultado: ResultadoNotificacao.FALHA,
    }) });
  });

  it('preserva telefone internacional informado com prefixo +', async () => {
    await service.notificarStatusPedido({
      ...eventoBase, telefone: `+${TEST_NOTIFICATION_PHONE}`, status: StatusPedido.PAGO,
    });

    expect(enviarTexto).toHaveBeenCalledWith(TEST_NOTIFICATION_PHONE, expect.any(String));
    expect(criar).toHaveBeenCalledWith({ data: expect.objectContaining({
      destino: TEST_NOTIFICATION_PHONE, resultado: ResultadoNotificacao.SUCESSO,
    }) });
  });

  it('não propaga falha ao persistir o resultado da notificação', async () => {
    criar.mockRejectedValue(new Error('database unavailable'));

    await expect(service.notificarStatusPedido({ ...eventoBase, status: StatusPedido.PAGO }))
      .resolves.toBeUndefined();
  });

  it.each([StatusPedido.EXPIRADO, StatusPedido.CANCELADO, StatusPedido.PENDENTE_PAGAMENTO])(
    'não envia nem registra status fora da lista do backlog: %s', async (status) => {
      await service.notificarStatusPedido({ ...eventoBase, status });

      expect(enviarTexto).not.toHaveBeenCalled();
      expect(criar).not.toHaveBeenCalled();
    },
  );
});
