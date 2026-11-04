import { GatewayTimeoutException, Logger } from '@nestjs/common';
import { Pagamento, Prisma } from '../generated/prisma/client';
import { StatusPedido } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { PagamentosService } from './pagamentos.service';
import { PagamentoSimuladorService } from './pagamento-simulador.service';

describe('espera e consulta Pix', () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const pedidoId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const usuarioId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const pendente = { id, pedidoId, forma: 'PIX', resultado: 'PENDENTE',
    dataTransacao: null, valorAplicavel: new Prisma.Decimal('12.34') };
  let prisma: { $transaction: jest.Mock; $executeRaw: jest.Mock; pagamento: { findFirst: jest.Mock } };
  let simulador: { simular: jest.Mock };
  let agendarStatusPedido: jest.Mock;
  let service: PagamentosService;

  beforeEach(() => {
    jest.useFakeTimers();
    prisma = { $transaction: jest.fn().mockResolvedValue({ pagamento: pendente, criado: true }),
      $executeRaw: jest.fn().mockResolvedValue(1),
      pagamento: { findFirst: jest.fn().mockResolvedValue(pendente) } };
    simulador = { simular: jest.fn() };
    agendarStatusPedido = jest.fn().mockResolvedValue(undefined);
    service = new PagamentosService(
      prisma as unknown as PrismaService,
      simulador as PagamentoSimuladorService,
      { agendarStatusPedido } as unknown as NotificacoesService,
    );
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
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
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

  it('simula cartão e expõe somente os campos persistidos da tentativa', async () => {
    const cartao = { ...pendente, forma: 'CARTAO' };
    prisma.$transaction.mockResolvedValue({ pagamento: cartao, criado: true });
    prisma.pagamento.findFirst.mockResolvedValue({
      ...cartao, resultado: 'APROVADO', dataTransacao: new Date('2026-10-23T12:00:00Z'),
    });
    simulador.simular.mockResolvedValue('APROVADO');
    prisma.$transaction.mockResolvedValueOnce({ pagamento: cartao, criado: true })
      .mockResolvedValueOnce({
        pagamento: { ...cartao, resultado: 'APROVADO',
          dataTransacao: new Date('2026-10-23T12:00:00Z') },
        evento: {
          pedidoId, identificadorNegocio: 'PED-123', telefone: '11999999999', status: StatusPedido.PAGO,
        },
      });

    await expect(service.iniciarCartao(usuarioId, pedidoId, id)).resolves.toEqual({
      criado: true,
      pagamento: { tentativaId: id, pedidoId, forma: 'CARTAO', resultado: 'APROVADO',
        valorAplicavel: '12.34', dataTransacao: '2026-10-23T12:00:00.000Z' },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(simulador.simular).toHaveBeenCalledWith(id);
    expect(agendarStatusPedido).toHaveBeenCalledWith({
      pedidoId, identificadorNegocio: 'PED-123', telefone: '11999999999', status: StatusPedido.PAGO,
    });
  });

  it('consulta tentativa de cartão sem iniciar nova simulação nem escrita', async () => {
    const cartao = { ...pendente, forma: 'CARTAO' };
    prisma.pagamento.findFirst.mockResolvedValue(cartao);

    await expect(service.consultarCartao(usuarioId, pedidoId, id)).resolves.toEqual({
      tentativaId: id, pedidoId, forma: 'CARTAO', resultado: 'PENDENTE',
      dataTransacao: null, valorAplicavel: '12.34',
    });
    expect(simulador.simular).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});

describe('ordem de locks na conclusão do pagamento (R-04)', () => {
  it.each([
    { caso: 'aprovação', falhaNaLimpeza: false },
    { caso: 'erro na limpeza', falhaNaLimpeza: true },
  ])('bloqueia Produto antes de Estoque em $caso', async ({ falhaNaLimpeza }) => {
    const usuarioId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const pedidoId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const tentativaId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const produtoId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const reservaId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const agora = new Date('2026-11-04T12:00:00.000Z');
    const ordem: string[] = [];
    const falha = new Error('falha na limpeza');

    const pagamentoPendente = {
      id: tentativaId, pedidoId, forma: 'PIX', resultado: 'PENDENTE',
      dataTransacao: null, valorAplicavel: new Prisma.Decimal('12.34'),
    };
    const pedidoPendente = {
      id: pedidoId, clienteUsuarioId: usuarioId, statusAtual: 'PENDENTE_PAGAMENTO',
      data: agora, total: new Prisma.Decimal('12.34'),
    };

    // Executa as queries reais do serviço e registra apenas os locks de interesse.
    const queryRaw = jest.fn(async (strings: TemplateStringsArray) => {
      const sql = strings.join('?');
      if (sql.includes('FROM "Pedido" p')) {
        return [{ id: pedidoId, statusAtual: 'PENDENTE_PAGAMENTO', data: agora,
          identificadorNegocio: 'PED-1', telefone: '11999999999' }];
      }
      if (sql.includes('SELECT id FROM "Pedido"')) return [{ id: pedidoId }];
      if (sql.includes('FROM "Produto"')) { ordem.push('Produto'); return [{ id: produtoId }]; }
      if (sql.includes('FROM "Estoque"')) { ordem.push('Estoque'); return [{ produtoId }]; }
      if (sql.includes('FROM "ReservaEstoque"') && sql.includes('FOR UPDATE')) {
        return [{ id: reservaId, produtoId, quantidade: 1,
          momentoExpiracaoValidade: new Date(agora.getTime() + 10 * 60 * 1000) }];
      }
      if (sql.includes('FROM "ReservaEstoque"')) return [{ id: reservaId, produtoId }];
      if (sql.includes('clock_timestamp')) return [{ agora }];
      return [];
    });

    const tx = {
      $queryRaw: queryRaw,
      $executeRaw: jest.fn().mockResolvedValue(1),
      pedido: {
        findUnique: jest.fn().mockResolvedValue(pedidoPendente),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      pagamento: {
        findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValue(pagamentoPendente),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...pagamentoPendente, resultado: 'APROVADO', dataTransacao: agora,
        }),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(pagamentoPendente),
      },
      estoque: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      reservaEstoque: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      movimentacaoEstoque: { create: jest.fn(async () => {
        ordem.push('Movimentacao');
        return {};
      }) },
      historicoStatusPedido: { create: jest.fn(async () => { ordem.push('Historico'); return {}; }) },
      itemCarrinho: { deleteMany: jest.fn(async () => {
        ordem.push('LimpezaCarrinho');
        if (falhaNaLimpeza) throw falha;
        return { count: 1 };
      }) },
    };
    const prisma = { $transaction: jest.fn(async (callback: (db: unknown) => Promise<unknown>) => callback(tx)) };
    const agendarStatusPedido = jest.fn().mockResolvedValue(undefined);
    const service = new PagamentosService(
      prisma as unknown as PrismaService,
      { simular: jest.fn().mockResolvedValue('APROVADO') } as unknown as PagamentoSimuladorService,
      { agendarStatusPedido } as unknown as NotificacoesService,
    );

    if (falhaNaLimpeza) {
      await expect(service.iniciarPix(usuarioId, pedidoId, tentativaId)).rejects.toBe(falha);
      expect(agendarStatusPedido).not.toHaveBeenCalled();
    } else {
      await expect(service.iniciarPix(usuarioId, pedidoId, tentativaId)).resolves.toMatchObject({
        pagamento: { resultado: 'APROVADO' },
      });
      expect(agendarStatusPedido).toHaveBeenCalledTimes(1);
    }

    expect(ordem).toEqual(['Produto', 'Estoque', 'Movimentacao', 'Historico', 'LimpezaCarrinho']);
    const queriesDeProduto = queryRaw.mock.calls.filter(([sql]) => sql.join('').includes('FROM "Produto"'));
    expect(queriesDeProduto).toHaveLength(1);
    expect(queriesDeProduto[0][0].join('')).toContain('FOR UPDATE');
    expect(tx.movimentacaoEstoque.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      produtoId, pedidoId, quantidade: -1, motivoOrigem: 'VENDA_PEDIDO',
    }) });
    expect(tx.itemCarrinho.deleteMany).toHaveBeenCalledWith({
      where: { carrinho: { usuarioId } },
    });
  });
});

it('recusa pagamento sem limpar o carrinho', async () => {
  const pedidoId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const usuarioId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const tentativaId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab';
  const pendente = { id: tentativaId, pedidoId, forma: 'PIX', resultado: 'PENDENTE',
    dataTransacao: null, valorAplicavel: new Prisma.Decimal('12.34') };
  const recusado = { ...pendente, resultado: 'RECUSADO', dataTransacao: new Date() };
  const tx = {
    $queryRaw: jest.fn(async (strings: TemplateStringsArray) => {
      if (strings.join('').includes('JOIN "Usuario"')) return [{ id: pedidoId }];
      return [];
    }),
    $executeRaw: jest.fn().mockResolvedValue(1),
    pagamento: {
      findUnique: jest.fn().mockResolvedValue(pendente),
      findUniqueOrThrow: jest.fn().mockResolvedValue(recusado),
    },
    itemCarrinho: { deleteMany: jest.fn() },
  };
  const prisma = { $transaction: jest.fn(async (callback: (db: unknown) => Promise<unknown>) => callback(tx)) };
  const agendarStatusPedido = jest.fn();
  const service = new PagamentosService(
    prisma as unknown as PrismaService,
    { simular: jest.fn().mockResolvedValue('RECUSADO') } as unknown as PagamentoSimuladorService,
    { agendarStatusPedido } as unknown as NotificacoesService,
  );

  await expect(service['concluir'](usuarioId, pendente as unknown as Pagamento)).resolves.toEqual(recusado);
  expect(tx.itemCarrinho.deleteMany).not.toHaveBeenCalled();
  expect(agendarStatusPedido).not.toHaveBeenCalled();
});
