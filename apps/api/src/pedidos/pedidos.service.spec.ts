import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { ModalidadeRecebimento } from '../generated/prisma/enums';
import { PedidosService } from './pedidos.service';

const usuarioId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const produtoId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const outroProdutoId = '99999999-9999-4999-8999-999999999999';
const enderecoId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const personalizacaoId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const dinheiro = (value: string) => new Prisma.Decimal(value);

function linha(quantidade = 2) {
  return {
    id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', produtoId, quantidade,
    produto: {
      nome: 'Cupcake', imagem: null, ativo: true, precoAtual: dinheiro('10.10'),
      estoque: { quantidadeFisica: 12, quantidadeReservada: 1 },
      personalizacoes: [{ personalizacaoId }],
    },
    personalizacoes: [{ personalizacao: {
      id: personalizacaoId, nome: 'Cobertura', disponibilidade: true,
      ajusteValor: dinheiro('0.20'),
    } }],
  };
}

describe('PedidosService', () => {
  const findCart = jest.fn();
  const findAddress = jest.fn();
  const findConfig = jest.fn();
  const createOrder = jest.fn();
  const stockWrite = jest.fn();
  const reservationWrite = jest.fn();
  const lockStock = jest.fn();
  const readStock = jest.fn();
  const findOrder = jest.fn();
  const executeRaw = jest.fn();
  let cartItems: ReturnType<typeof linha>[];
  const setCart = (itens: ReturnType<typeof linha>[]) => {
    cartItems = itens;
    findCart.mockResolvedValue({ id: 'cart', itens });
  };
  const db = {
    $queryRaw: lockStock, $executeRaw: executeRaw,
    carrinho: { findUnique: findCart }, endereco: { findFirst: findAddress },
    configuracaoLojaEntrega: { findFirst: findConfig },
    pedido: { create: createOrder, findFirst: findOrder }, estoque: { update: stockWrite, findUnique: readStock },
    reservaEstoque: { create: reservationWrite },
  };
  const transaction = jest.fn(async (callback: (client: typeof db) => Promise<unknown>) => callback(db));
  const service = new PedidosService({ $transaction: transaction,
    pedido: { findFirst: findOrder } } as never);

  beforeEach(() => {
    jest.clearAllMocks();
    setCart([linha()]);
    findAddress.mockResolvedValue({
      id: enderecoId, rua: 'Rua A', numero: '7', bairro: 'Centro',
      cidade: 'Curitiba', cep: '80000000', complemento: null, referencia: null,
      latitude: dinheiro('0'), longitude: dinheiro('0'),
    });
    const config = {
      id: 'abababab-abab-4bab-8bab-abababababab',
      latitudeLoja: dinheiro('0'), longitudeLoja: dinheiro('0'),
      raioMaximoAtendimento: dinheiro('10'), taxaBase: dinheiro('2.05'),
      valorPorQuilometro: dinheiro('0'),
    };
    findConfig.mockResolvedValue(config);
    createOrder.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'order', data: new Date('2026-10-22T12:00:00.000Z'), identificadorNegocio: data.identificadorNegocio,
      clienteUsuarioId: data.clienteUsuarioId,
      modalidade: data.modalidade, statusAtual: 'PENDENTE_PAGAMENTO',
      valorItens: data.valorItens, freteAplicado: data.freteAplicado, total: data.total,
      enderecoEntregaSnapshot: data.enderecoEntregaSnapshot ?
        (data.enderecoEntregaSnapshot as { create: object }).create : null,
      itens: (data.itens as { create: Array<Record<string, unknown>> }).create.map((item) => ({
        ...item,
        personalizacoes: (item.personalizacoes as { create: object[] }).create,
      })),
    }));
    stockWrite.mockResolvedValue({});
    reservationWrite.mockResolvedValue({});
    findOrder.mockResolvedValue(null);
    lockStock.mockImplementation(async (query: TemplateStringsArray, value: string) => {
      const sql = query.join('?');
      if (sql.includes('FROM "Carrinho"')) return [{ id: 'cart' }];
      if (sql.includes('FROM "ItemCarrinho" WHERE')) return cartItems.map((item) => ({
        id: item.id, produtoId: item.produtoId,
      }));
      if (sql.includes('FROM "ItemCarrinhoPersonalizacao"')) return cartItems.flatMap((item) =>
        item.personalizacoes.map(({ personalizacao }) => ({
          itemCarrinhoId: item.id, personalizacaoId: personalizacao.id,
        })));
      return [{ produtoId: value }];
    });
    readStock.mockImplementation(async ({ where }: { where: { produtoId: string } }) => {
      const carrinho = await findCart.mock.results.at(-1)?.value;
      const estoque = carrinho?.itens.find((item: ReturnType<typeof linha>) => item.produtoId === where.produtoId)?.produto.estoque;
      return estoque ? { ...estoque } : null;
    });
  });

  it('rejeita carrinho inexistente e vazio', async () => {
    findCart.mockResolvedValueOnce(null);
    await expect(service.criar(usuarioId, { modalidade: ModalidadeRecebimento.RETIRADA }))
      .rejects.toBeInstanceOf(NotFoundException);
    findCart.mockResolvedValueOnce({ id: 'cart', itens: [] });
    await expect(service.criar(usuarioId, { modalidade: ModalidadeRecebimento.RETIRADA }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('congela preço vigente, quantidade e personalização de várias linhas em retirada', async () => {
    const second = linha(1);
    second.id = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    second.produtoId = outroProdutoId;
    second.produto.precoAtual = dinheiro('0.11');
    setCart([linha(2), second]);
    const result = await service.criar(usuarioId, { modalidade: ModalidadeRecebimento.RETIRADA });
    expect(findCart).toHaveBeenCalledWith(expect.objectContaining({ where: { usuarioId } }));
    expect(result).toMatchObject({ valorItens: '20.91', freteAplicado: '0.00', total: '20.91',
      enderecoEntregaSnapshot: null });
    expect(result.itens).toEqual(expect.arrayContaining([
      expect.objectContaining({ quantidade: 2, precoAplicado: '10.30', subtotalAplicado: '20.60',
        personalizacoes: [expect.objectContaining({ nomeAplicado: 'Cobertura', ajusteValorAplicado: '0.20' })] }),
    ]));
    expect(findConfig).not.toHaveBeenCalled();
    expect(stockWrite).toHaveBeenCalledTimes(2);
    expect(stockWrite).toHaveBeenCalledWith({ where: { produtoId },
      data: { quantidadeReservada: { increment: 2 } } });
    expect(stockWrite).toHaveBeenCalledWith({ where: { produtoId: outroProdutoId },
      data: { quantidadeReservada: { increment: 1 } } });
    expect(reservationWrite).toHaveBeenCalledTimes(2);
  });

  it('calcula frete e snapshot para entrega própria', async () => {
    const result = await service.criar(usuarioId,
      { modalidade: ModalidadeRecebimento.ENTREGA, enderecoId });
    expect(findAddress).toHaveBeenCalledWith(expect.objectContaining({ where: { id: enderecoId, usuarioId } }));
    expect(findAddress).toHaveBeenCalledTimes(1);
    expect(findConfig).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ valorItens: '20.60', freteAplicado: '2.05', total: '22.65',
      enderecoEntregaSnapshot: { rua: 'Rua A', numero: '7' } });
    expect(stockWrite).toHaveBeenCalledWith({ where: { produtoId },
      data: { quantidadeReservada: { increment: 2 } } });
    expect(reservationWrite).toHaveBeenCalledWith({ data: expect.objectContaining({
      pedidoId: 'order', produtoId, quantidade: 2, estado: 'ATIVA',
      momentoExpiracaoValidade: new Date('2026-10-22T12:15:00.000Z'),
    }) });
  });

  it('preserva duas linhas do mesmo produto com quantidades e personalizações independentes', async () => {
    const second = linha(3);
    second.id = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    second.personalizacoes = [];
    setCart([linha(2), second]);
    const result = await service.criar(usuarioId, { modalidade: ModalidadeRecebimento.RETIRADA });
    expect(result.itens).toHaveLength(2);
    expect(result.itens).toEqual([
      expect.objectContaining({ produtoId, quantidade: 2, precoAplicado: '10.30',
        subtotalAplicado: '20.60', personalizacoes: [expect.objectContaining({ nomeAplicado: 'Cobertura' })] }),
      expect.objectContaining({ produtoId, quantidade: 3, precoAplicado: '10.10',
        subtotalAplicado: '30.30', personalizacoes: [] }),
    ]);
    expect(result).toMatchObject({ valorItens: '50.90', total: '50.90' });
    expect(stockWrite).toHaveBeenCalledTimes(1);
    expect(stockWrite).toHaveBeenCalledWith({ where: { produtoId },
      data: { quantidadeReservada: { increment: 5 } } });
    expect(reservationWrite).toHaveBeenCalledTimes(2);
    expect(reservationWrite.mock.calls.map(([call]) => call.data.quantidade)).toEqual([2, 3]);
  });

  it('rejeita endereço alheio, local sem cobertura e modalidades inconsistentes', async () => {
    findAddress.mockResolvedValueOnce(null);
    await expect(service.criar(usuarioId, { modalidade: ModalidadeRecebimento.ENTREGA, enderecoId }))
      .rejects.toBeInstanceOf(NotFoundException);
    findAddress.mockResolvedValueOnce({ id: enderecoId, usuarioId,
      rua: 'Rua B', numero: '1', bairro: 'Centro', cidade: 'Curitiba', cep: '80000000',
      complemento: null, referencia: null, latitude: dinheiro('1'), longitude: dinheiro('0') });
    await expect(service.criar(usuarioId, { modalidade: ModalidadeRecebimento.ENTREGA, enderecoId }))
      .rejects.toBeInstanceOf(ConflictException);
    await expect(service.criar(usuarioId, { modalidade: ModalidadeRecebimento.ENTREGA }))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(service.criar(usuarioId, { modalidade: ModalidadeRecebimento.RETIRADA, enderecoId }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it.each([
    ['produto inativo', (item: ReturnType<typeof linha>) => { item.produto.ativo = false; }],
    ['personalização inválida', (item: ReturnType<typeof linha>) => { item.personalizacoes[0].personalizacao.disponibilidade = false; }],
    ['sem vínculo', (item: ReturnType<typeof linha>) => { item.produto.personalizacoes = []; }],
    ['sem saldo', (item: ReturnType<typeof linha>) => { item.produto.estoque.quantidadeReservada = 12; }],
    ['linha acima do saldo', (item: ReturnType<typeof linha>) => { item.quantidade = 12; }],
    ['quantidade inválida', (item: ReturnType<typeof linha>) => { item.quantidade = 0; }],
    ['preço negativo', (item: ReturnType<typeof linha>) => { item.produto.precoAtual = dinheiro('-20.00'); }],
  ])('rejeita linha inválida: %s', async (_name, change) => {
    const item = linha();
    change(item);
    setCart([item]);
    await expect(service.criar(usuarioId, { modalidade: ModalidadeRecebimento.RETIRADA }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('rejeita demanda agregada acima do saldo antes de persistir', async () => {
    const second = linha(4);
    second.id = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    setCart([linha(8), second]);
    await expect(service.criar(usuarioId, { modalidade: ModalidadeRecebimento.RETIRADA }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(createOrder).not.toHaveBeenCalled();
    expect(stockWrite).not.toHaveBeenCalled();
    expect(reservationWrite).not.toHaveBeenCalled();
  });

  it('rejeita estoque ausente sem criar reserva', async () => {
    const item = linha();
    item.produto.estoque = null as never;
    setCart([item]);
    await expect(service.criar(usuarioId, { modalidade: ModalidadeRecebimento.RETIRADA }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(createOrder).not.toHaveBeenCalled();
    expect(reservationWrite).not.toHaveBeenCalled();
  });

  it('propaga falha após persistência de pedido e estoque dentro da transação', async () => {
    reservationWrite.mockRejectedValueOnce(new Error('falha de reserva'));
    await expect(service.criar(usuarioId, { modalidade: ModalidadeRecebimento.RETIRADA }))
      .rejects.toThrow('falha de reserva');
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(stockWrite).toHaveBeenCalledTimes(1);
    expect(reservationWrite).toHaveBeenCalledTimes(1);
  });

  it('propaga falha de persistência para rollback da transação', async () => {
    createOrder.mockRejectedValueOnce(new Error('falha de snapshot'));
    await expect(service.criar(usuarioId, { modalidade: ModalidadeRecebimento.RETIRADA }))
      .rejects.toThrow('falha de snapshot');
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(stockWrite).not.toHaveBeenCalled();
    expect(reservationWrite).not.toHaveBeenCalled();
  });

  it('adquire locks em ordem antes de atualizar e usa saldo relido', async () => {
    const second = linha(1);
    second.id = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    second.produtoId = outroProdutoId;
    setCart([linha(), second]);
    await service.criar(usuarioId, { modalidade: ModalidadeRecebimento.RETIRADA });
    const stockLocks = lockStock.mock.calls.filter((call) => call[0].join('?').includes('FROM "Estoque"'));
    expect(stockLocks.map((call) => call[1])).toEqual([outroProdutoId, produtoId].sort());
    expect(lockStock.mock.invocationCallOrder[lockStock.mock.calls.indexOf(stockLocks[1])])
      .toBeLessThan(readStock.mock.invocationCallOrder[0]);
    expect(readStock.mock.invocationCallOrder[1]).toBeLessThan(createOrder.mock.invocationCallOrder[0]);
    expect(readStock.mock.invocationCallOrder[1]).toBeLessThan(stockWrite.mock.invocationCallOrder[0]);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('não bloqueia configuração nem personalização compartilhadas e mantém lock por estoque', async () => {
    await service.criar(usuarioId, { modalidade: ModalidadeRecebimento.ENTREGA, enderecoId });
    const sql = lockStock.mock.calls.map((call) => call[0].join('?'));
    expect(sql).toEqual(expect.arrayContaining([
      expect.stringContaining('FROM "Carrinho"'),
      expect.stringContaining('FROM "ItemCarrinho" WHERE'),
      expect.stringContaining('FROM "Produto"'),
      expect.stringContaining('FROM "Estoque"'),
      expect.stringContaining('FROM "Endereco"'),
    ]));
    expect(sql.some((query) => /FROM\s+"(ConfiguracaoLojaEntrega|Personalizacao)"/i.test(query)))
      .toBe(false);
    expect(sql.every((query) => query.includes('FOR UPDATE') && !/LOCK\s+TABLE/i.test(query))).toBe(true);
    expect(executeRaw).not.toHaveBeenCalled();
    expect(findConfig).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({
      taxaBase: true, valorPorQuilometro: true,
    }) }));
  });

  it('rejeita saldo que mudou antes do lock sem pedido ou reserva', async () => {
    readStock.mockResolvedValue({ quantidadeFisica: 2, quantidadeReservada: 1 });
    await expect(service.criar(usuarioId, { modalidade: ModalidadeRecebimento.RETIRADA }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(createOrder).not.toHaveBeenCalled();
    expect(stockWrite).not.toHaveBeenCalled();
    expect(reservationWrite).not.toHaveBeenCalled();
  });

  it('revisão apresenta valores e não grava pedido, estoque nem reserva', async () => {
    const result = await service.revisar(usuarioId, { modalidade: ModalidadeRecebimento.RETIRADA });
    expect(result).toMatchObject({ total: '20.60', freteAplicado: '0.00',
      itens: [expect.objectContaining({ nome: 'Cupcake', quantidade: 2 })] });
    expect(result).toHaveProperty('revisaoId', expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(createOrder).not.toHaveBeenCalled();
    expect(stockWrite).not.toHaveBeenCalled();
    expect(reservationWrite).not.toHaveBeenCalled();
  });

  it('revisão Delivery usa endereço próprio e frete atual sem persistência', async () => {
    const result = await service.revisar(usuarioId,
      { modalidade: ModalidadeRecebimento.ENTREGA, enderecoId });
    expect(result).toMatchObject({ freteAplicado: '2.05', total: '22.65',
      enderecoEntregaSnapshot: { rua: 'Rua A', numero: '7' } });
    expect(findAddress).toHaveBeenCalledWith(expect.objectContaining({ where: { id: enderecoId, usuarioId } }));
    expect(createOrder).not.toHaveBeenCalled();
    expect(stockWrite).not.toHaveBeenCalled();
    expect(reservationWrite).not.toHaveBeenCalled();
    findAddress.mockResolvedValueOnce(null);
    await expect(service.revisar(usuarioId,
      { modalidade: ModalidadeRecebimento.ENTREGA, enderecoId }))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejeita frete alterado depois da revisão', async () => {
    const input = { modalidade: ModalidadeRecebimento.ENTREGA, enderecoId };
    const preview = await service.revisar(usuarioId, input);
    if (!('revisaoId' in preview)) throw new Error('Revisão sem ID.');
    findConfig.mockResolvedValue({ latitudeLoja: dinheiro('0'), longitudeLoja: dinheiro('0'),
      raioMaximoAtendimento: dinheiro('10'), taxaBase: dinheiro('3.05'),
      valorPorQuilometro: dinheiro('0') });
    await expect(service.criar(usuarioId, { ...input, revisaoId: preview.revisaoId }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('rejeita personalização alterada após revisão sem reservar', async () => {
    const input = { modalidade: ModalidadeRecebimento.RETIRADA };
    const preview = await service.revisar(usuarioId, input);
    if (!('revisaoId' in preview)) throw new Error('Revisão sem ID.');
    const changed = linha();
    changed.personalizacoes[0].personalizacao.ajusteValor = dinheiro('0.30');
    setCart([changed]);
    await expect(service.criar(usuarioId, { ...input, revisaoId: preview.revisaoId }))
      .rejects.toThrow('Revisão desatualizada. Atualize os valores.');
    expect(createOrder).not.toHaveBeenCalled();
    expect(stockWrite).not.toHaveBeenCalled();
    expect(reservationWrite).not.toHaveBeenCalled();
  });

  it('rejeita revisão quando saldo protegido mudou mesmo ainda suficiente', async () => {
    const input = { modalidade: ModalidadeRecebimento.RETIRADA };
    const preview = await service.revisar(usuarioId, input);
    if (!('revisaoId' in preview)) throw new Error('Revisão sem ID.');
    readStock.mockResolvedValue({ quantidadeFisica: 12, quantidadeReservada: 2 });
    await expect(service.criar(usuarioId, { ...input, revisaoId: preview.revisaoId }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('rejeita revisão desatualizada antes de gravar', async () => {
    await expect(service.criar(usuarioId, { modalidade: ModalidadeRecebimento.RETIRADA,
      revisaoId: '0'.repeat(64) })).rejects.toBeInstanceOf(ConflictException);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('vincula revisão ao cliente e rejeita referência de outro cliente sem reservar', async () => {
    const clienteB = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    const input = { modalidade: ModalidadeRecebimento.RETIRADA };
    const revisaoA = await service.revisar(usuarioId, input);
    const revisaoB = await service.revisar(clienteB, input);
    if (!('revisaoId' in revisaoA) || !('revisaoId' in revisaoB)) {
      throw new Error('Revisão sem ID.');
    }
    expect(revisaoB.revisaoId).not.toBe(revisaoA.revisaoId);
    expect({ ...revisaoB, revisaoId: undefined }).toEqual({ ...revisaoA, revisaoId: undefined });
    await expect(service.criar(clienteB, { ...input, revisaoId: revisaoA.revisaoId }))
      .rejects.toThrow('Revisão desatualizada. Atualize os valores.');
    expect(findCart).toHaveBeenCalledWith(expect.objectContaining({ where: { usuarioId: clienteB } }));
    expect(createOrder).not.toHaveBeenCalled();
    expect(stockWrite).not.toHaveBeenCalled();
    expect(reservationWrite).not.toHaveBeenCalled();
  });

  it('repete a mesma tentativa sem reservar novamente e bloqueia outro cliente', async () => {
    const tentativaId = '11111111-1111-4111-8111-111111111111';
    const preview = await service.revisar(usuarioId, { modalidade: ModalidadeRecebimento.RETIRADA });
    if (!('revisaoId' in preview)) throw new Error('Revisão sem ID.');
    const input = { modalidade: ModalidadeRecebimento.RETIRADA, tentativaId,
      revisaoId: preview.revisaoId };
    const primeiro = await service.criar(usuarioId, input);
    const persisted = await createOrder.mock.results[0].value;
    findOrder.mockResolvedValue(persisted);
    const repetido = await service.criar(usuarioId, input);
    expect(repetido).toEqual(primeiro);
    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(stockWrite).toHaveBeenCalledTimes(1);
    await expect(service.criar('ffffffff-ffff-4fff-8fff-ffffffffffff', input))
      .rejects.toBeInstanceOf(ConflictException);
    expect(createOrder).toHaveBeenCalledTimes(1);
  });

  it('vincula tentativa ao endereço, modalidade e revisão imutáveis', async () => {
    const tentativaId = '11111111-1111-4111-8111-111111111111';
    const preview = await service.revisar(usuarioId,
      { modalidade: ModalidadeRecebimento.ENTREGA, enderecoId });
    if (!('revisaoId' in preview)) throw new Error('Revisão sem ID.');
    const input = { modalidade: ModalidadeRecebimento.ENTREGA, enderecoId,
      tentativaId, revisaoId: preview.revisaoId };
    const first = await service.criar(usuarioId, input);
    findOrder.mockResolvedValue(await createOrder.mock.results[0].value);
    expect(await service.criar(usuarioId, input)).toEqual(first);
    for (const changed of [
      { ...input, enderecoId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' },
      { ...input, modalidade: ModalidadeRecebimento.RETIRADA, enderecoId: undefined },
      { ...input, revisaoId: '0'.repeat(64) },
    ]) {
      await expect(service.criar(usuarioId, changed)).rejects.toBeInstanceOf(ConflictException);
    }
    await expect(service.criar('ffffffff-ffff-4fff-8fff-ffffffffffff', input))
      .rejects.toBeInstanceOf(ConflictException);
    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(reservationWrite).toHaveBeenCalledTimes(1);
    expect(stockWrite).toHaveBeenCalledTimes(1);
  });

  it('rejeita preço alterado após revisão antes de reservar', async () => {
    const preview = await service.revisar(usuarioId, { modalidade: ModalidadeRecebimento.RETIRADA });
    if (!('revisaoId' in preview)) throw new Error('Revisão sem ID.');
    const changed = linha();
    changed.produto.precoAtual = dinheiro('11.10');
    setCart([changed]);
    await expect(service.criar(usuarioId, { modalidade: ModalidadeRecebimento.RETIRADA,
      revisaoId: preview.revisaoId })).rejects.toBeInstanceOf(ConflictException);
    expect(lockStock.mock.invocationCallOrder[0]).toBeLessThan(
      findCart.mock.invocationCallOrder[1]);
    expect(createOrder).not.toHaveBeenCalled();
    expect(stockWrite).not.toHaveBeenCalled();
    expect(reservationWrite).not.toHaveBeenCalled();
  });
});
