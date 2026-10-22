import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { ModalidadeRecebimento } from '../generated/prisma/enums';
import { PedidosService } from './pedidos.service';

const usuarioId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const produtoId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const enderecoId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const personalizacaoId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const dinheiro = (value: string) => new Prisma.Decimal(value);

function linha(quantidade = 2) {
  return {
    id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', produtoId, quantidade,
    produto: {
      nome: 'Cupcake', imagem: null, ativo: true, precoAtual: dinheiro('10.10'),
      estoque: { quantidadeFisica: 10, quantidadeReservada: 1 },
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
  const db = {
    carrinho: { findUnique: findCart }, endereco: { findFirst: findAddress },
    configuracaoLojaEntrega: { findFirst: findConfig },
    pedido: { create: createOrder }, estoque: { update: stockWrite },
    reservaEstoque: { create: reservationWrite },
  };
  const transaction = jest.fn(async (callback: (client: typeof db) => Promise<unknown>) => callback(db));
  const service = new PedidosService({ $transaction: transaction } as never);

  beforeEach(() => {
    jest.clearAllMocks();
    findCart.mockResolvedValue({ id: 'cart', itens: [linha()] });
    findAddress.mockResolvedValue({
      id: enderecoId, rua: 'Rua A', numero: '7', bairro: 'Centro',
      cidade: 'Curitiba', cep: '80000000', complemento: null, referencia: null,
      latitude: dinheiro('0'), longitude: dinheiro('0'),
    });
    findConfig.mockResolvedValue({
      latitudeLoja: dinheiro('0'), longitudeLoja: dinheiro('0'),
      raioMaximoAtendimento: dinheiro('10'), taxaBase: dinheiro('2.05'),
      valorPorQuilometro: dinheiro('0'),
    });
    createOrder.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'order', identificadorNegocio: data.identificadorNegocio,
      modalidade: data.modalidade, statusAtual: 'PENDENTE_PAGAMENTO',
      valorItens: data.valorItens, freteAplicado: data.freteAplicado, total: data.total,
      enderecoEntregaSnapshot: data.enderecoEntregaSnapshot ?
        (data.enderecoEntregaSnapshot as { create: object }).create : null,
      itens: (data.itens as { create: Array<Record<string, unknown>> }).create.map((item) => ({
        ...item,
        personalizacoes: (item.personalizacoes as { create: object[] }).create,
      })),
    }));
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
    second.produto.precoAtual = dinheiro('0.11');
    findCart.mockResolvedValue({ id: 'cart', itens: [linha(2), second] });
    const result = await service.criar(usuarioId, { modalidade: ModalidadeRecebimento.RETIRADA });
    expect(findCart).toHaveBeenCalledWith(expect.objectContaining({ where: { usuarioId } }));
    expect(result).toMatchObject({ valorItens: '20.91', freteAplicado: '0.00', total: '20.91',
      enderecoEntregaSnapshot: null });
    expect(result.itens).toEqual(expect.arrayContaining([
      expect.objectContaining({ quantidade: 2, precoAplicado: '10.30', subtotalAplicado: '20.60',
        personalizacoes: [expect.objectContaining({ nomeAplicado: 'Cobertura', ajusteValorAplicado: '0.20' })] }),
    ]));
    expect(findConfig).not.toHaveBeenCalled();
    expect(stockWrite).not.toHaveBeenCalled();
    expect(reservationWrite).not.toHaveBeenCalled();
  });

  it('calcula frete e snapshot para entrega própria', async () => {
    const result = await service.criar(usuarioId,
      { modalidade: ModalidadeRecebimento.ENTREGA, enderecoId });
    expect(findAddress).toHaveBeenCalledWith(expect.objectContaining({ where: { id: enderecoId, usuarioId } }));
    expect(findAddress).toHaveBeenCalledTimes(1);
    expect(findConfig).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ valorItens: '20.60', freteAplicado: '2.05', total: '22.65',
      enderecoEntregaSnapshot: { rua: 'Rua A', numero: '7' } });
  });

  it('preserva duas linhas do mesmo produto com quantidades e personalizações independentes', async () => {
    const second = linha(5);
    second.id = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    second.personalizacoes = [];
    findCart.mockResolvedValue({ id: 'cart', itens: [linha(5), second] });
    const result = await service.criar(usuarioId, { modalidade: ModalidadeRecebimento.RETIRADA });
    expect(result.itens).toHaveLength(2);
    expect(result.itens).toEqual([
      expect.objectContaining({ produtoId, quantidade: 5, precoAplicado: '10.30',
        subtotalAplicado: '51.50', personalizacoes: [expect.objectContaining({ nomeAplicado: 'Cobertura' })] }),
      expect.objectContaining({ produtoId, quantidade: 5, precoAplicado: '10.10',
        subtotalAplicado: '50.50', personalizacoes: [] }),
    ]);
    expect(result).toMatchObject({ valorItens: '102.00', total: '102.00' });
    expect(stockWrite).not.toHaveBeenCalled();
    expect(reservationWrite).not.toHaveBeenCalled();
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
    ['sem saldo', (item: ReturnType<typeof linha>) => { item.produto.estoque.quantidadeReservada = 10; }],
    ['linha acima do saldo', (item: ReturnType<typeof linha>) => { item.quantidade = 10; }],
    ['quantidade inválida', (item: ReturnType<typeof linha>) => { item.quantidade = 0; }],
    ['preço negativo', (item: ReturnType<typeof linha>) => { item.produto.precoAtual = dinheiro('-20.00'); }],
  ])('rejeita linha inválida: %s', async (_name, change) => {
    const item = linha();
    change(item);
    findCart.mockResolvedValue({ id: 'cart', itens: [item] });
    await expect(service.criar(usuarioId, { modalidade: ModalidadeRecebimento.RETIRADA }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('propaga falha de persistência para rollback da transação', async () => {
    createOrder.mockRejectedValueOnce(new Error('falha de snapshot'));
    await expect(service.criar(usuarioId, { modalidade: ModalidadeRecebimento.RETIRADA }))
      .rejects.toThrow('falha de snapshot');
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(stockWrite).not.toHaveBeenCalled();
    expect(reservationWrite).not.toHaveBeenCalled();
  });
});
