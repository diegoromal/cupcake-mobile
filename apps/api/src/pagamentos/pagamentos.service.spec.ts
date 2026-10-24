import { GatewayTimeoutException, Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PagamentosService } from './pagamentos.service';
import { PixSimuladorService } from './pix-simulador.service';

describe('espera e consulta Pix', () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const pedidoId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const usuarioId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const pendente = { id, pedidoId, forma: 'PIX', resultado: 'PENDENTE',
    dataTransacao: null, valorAplicavel: new Prisma.Decimal('12.34') };
  let prisma: { $transaction: jest.Mock; $executeRaw: jest.Mock; pagamento: { findFirst: jest.Mock } };
  let simulador: { simular: jest.Mock };
  let service: PagamentosService;

  beforeEach(() => {
    jest.useFakeTimers();
    prisma = { $transaction: jest.fn().mockResolvedValue({ pagamento: pendente, criado: true }),
      $executeRaw: jest.fn().mockResolvedValue(1),
      pagamento: { findFirst: jest.fn().mockResolvedValue(pendente) } };
    simulador = { simular: jest.fn() };
    service = new PagamentosService(prisma as unknown as PrismaService, simulador as PixSimuladorService);
  });
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  it('retorna 504 com identidade aos 2s e permite conclusão posterior', async () => {
    let concluir!: (resultado: 'APROVADO') => void;
    simulador.simular.mockReturnValue(new Promise((resolve) => { concluir = resolve; }));
    const requisicao = service.iniciarPix(usuarioId, pedidoId, id);
    const erro = requisicao.catch((error: unknown) => error);
    await jest.advanceTimersByTimeAsync(1999);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(await erro).toBeInstanceOf(GatewayTimeoutException);
    expect((await erro as GatewayTimeoutException).getResponse()).toEqual({
      statusCode: 504, message: 'Tempo de espera excedido. Consulte a tentativa.', tentativaId: id,
    });
    concluir('APROVADO');
    await jest.advanceTimersByTimeAsync(0);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('GET pendente não inicia trabalho nem escreve', async () => {
    expect(await service.consultarPix(usuarioId, pedidoId, id)).toEqual({
      tentativaId: id, pedidoId, forma: 'PIX', resultado: 'PENDENTE',
      dataTransacao: null, valorAplicavel: '12.34',
    });
    expect(simulador.simular).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('repetição final não inicia simulação e conserva data e resultado', async () => {
    const final = { ...pendente, resultado: 'RECUSADO', dataTransacao: new Date('2026-10-23T12:00:00Z') };
    prisma.$transaction.mockResolvedValue({ pagamento: final, criado: false });
    expect(await service.iniciarPix(usuarioId, pedidoId, id)).toMatchObject({
      criado: false, pagamento: { resultado: 'RECUSADO', dataTransacao: '2026-10-23T12:00:00.000Z' },
    });
    expect(simulador.simular).not.toHaveBeenCalled();
  });

  it('falha da simulação não vira sucesso ou resultado recusado', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    simulador.simular.mockRejectedValue(new Error('falha de teste'));
    await expect(service.iniciarPix(usuarioId, pedidoId, id)).rejects.toThrow('falha de teste');
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
});
