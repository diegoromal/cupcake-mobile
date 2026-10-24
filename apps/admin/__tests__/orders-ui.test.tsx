import { fireEvent, render, screen } from '@testing-library/react';
import OrderList from '@/components/OrderList';
import OrderDetail from '@/components/OrderDetail';
import { AdminApiError, adminApi } from '@/lib/client/admin-api';

jest.mock('@/lib/client/admin-api', () => ({
  ...jest.requireActual('@/lib/client/admin-api'), adminApi: jest.fn(),
}));
const mockApi = adminApi as jest.Mock;

const order = {
  id: 'order-1', identificadorNegocio: 'PED-123', confirmacaoPagamento: '2026-10-20T12:00:00.000Z',
  cliente: { nome: 'Ana Silva' }, modalidade: 'RETIRADA', statusAtual: 'PRONTO_PARA_RETIRADA', total: '42.50',
} as const;

beforeEach(() => mockApi.mockReset());

test('carrega pedidos com estado de leitura e valores do pedido', async () => {
  mockApi.mockResolvedValue([order]);
  render(<OrderList />);
  expect(screen.getByRole('status')).toHaveTextContent('Carregando pedidos');
  expect(await screen.findByText('PED-123')).toBeInTheDocument();
  expect(screen.getByText('Ana Silva')).toBeInTheDocument();
  expect(screen.getByText('Retirada')).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: 'Pronto para retirada' })).toBeInTheDocument();
  expect(screen.getByText('R$ 42,50')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('1 pedido listado');
});

test('apresenta lista vazia sem erro', async () => {
  mockApi.mockResolvedValue([]);
  render(<OrderList />);
  expect(await screen.findByText('Nenhum pedido para acompanhar.')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('apresenta erro e permite nova tentativa', async () => {
  mockApi.mockRejectedValueOnce(new Error('API indisponível.')).mockResolvedValueOnce([order]);
  render(<OrderList />);
  expect(await screen.findByRole('alert')).toHaveTextContent('API indisponível.');
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(await screen.findByText('PED-123')).toBeInTheDocument();
});

test('filtra por status válido, conta registros visíveis, limpa e abre o pedido correto', async () => {
  const second = { ...order, id: 'order-2', identificadorNegocio: 'PED-456',
    statusAtual: 'PAGO' as const, cliente: { nome: 'Bia' } };
  mockApi.mockResolvedValue([order, second]);
  render(<OrderList />);
  expect(await screen.findByText('PED-123')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('2 pedidos listados');
  expect(screen.getByRole('link', { name: 'Ver detalhes do pedido PED-123' }))
    .toHaveAttribute('href', '/pedidos/order-1');
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'PAGO' } });
  expect(screen.getByText('PED-456')).toBeInTheDocument();
  expect(screen.queryByText('PED-123')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('1 pedido listado');
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'CANCELADO' } });
  expect(screen.getByText('Nenhum pedido com este status.')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('0 pedidos listados');
  fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
  expect(screen.getByText('PED-123')).toBeInTheDocument();
  expect(screen.getByText('PED-456')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('2 pedidos listados');
  expect(screen.getAllByRole('link', { name: /Ver detalhes do pedido/ }).map((link) =>
    link.getAttribute('href'))).toEqual(['/pedidos/order-1', '/pedidos/order-2']);
  expect(mockApi).toHaveBeenCalledTimes(1);
  expect(mockApi).toHaveBeenCalledWith('/api/admin/pedidos');
  expect(screen.queryByRole('option', { name: 'Pendente de pagamento' })).not.toBeInTheDocument();
});

test('não mostra pedidos quando o acesso administrativo é negado', async () => {
  mockApi.mockRejectedValue(new AdminApiError(403, 'Acesso negado.'));
  render(<OrderList />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Acesso negado.');
  expect(screen.queryByText('PED-123')).not.toBeInTheDocument();
});

const detail = {
  id: 'order-1', identificadorNegocio: 'PED-123', confirmacaoPagamento: '2026-10-20T12:00:00.000Z',
  cliente: { nome: 'Ana Silva' }, modalidade: 'ENTREGA', statusAtual: 'PAGO',
  valorItens: '70.00', freteAplicado: '8.50', total: '78.50', formaPagamento: 'PIX',
  enderecoEntregaSnapshot: { rua: 'Rua A', numero: '7', bairro: 'Centro', cidade: 'Curitiba',
    cep: '80000000', complemento: 'Apto 2', referencia: null },
  historicoStatus: [{ id: 'history-1', status: 'PAGO', dataHora: '2026-10-20T12:01:00.000Z', responsavel: null }],
  itens: [{ id: 'item-1', nome: 'Cupcake', quantidade: 2, precoAplicado: '35.00',
    subtotalAplicado: '70.00', personalizacoes: [{ nomeAplicado: 'Cobertura', ajusteValorAplicado: '2.00' }] }],
} as const;

test('detalhe apresenta campos persistidos, personalização, endereço e valores sem recalcular', async () => {
  mockApi.mockResolvedValue(detail);
  render(<OrderDetail id="order-1" />);
  expect(screen.getByRole('status')).toHaveTextContent('Carregando pedido');
  expect(await screen.findByRole('heading', { name: 'Pedido PED-123' })).toBeInTheDocument();
  expect(screen.getByText('2 × Cupcake')).toBeInTheDocument();
  expect(screen.getByText(/Cobertura/)).toBeInTheDocument();
  expect(screen.getByText(/Rua A, 7/)).toBeInTheDocument();
  expect(screen.getByText('R$ 78,50')).toBeInTheDocument();
  expect(screen.getByText('Pix')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Histórico de alterações' })).toBeInTheDocument();
  expect(screen.getAllByText('Pago')).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Iniciar produção' })).toBeInTheDocument();
  expect(mockApi).toHaveBeenCalledWith('/api/admin/pedidos/order-1');
});

test('inicia produção apenas para pedido pago e atualiza o detalhe após sucesso', async () => {
  const updated = { ...detail, statusAtual: 'EM_PREPARO', historicoStatus: [
    ...detail.historicoStatus,
    { id: 'history-2', status: 'EM_PREPARO', dataHora: '2026-10-20T12:02:00.000Z', responsavel: 'Admin' },
  ] };
  mockApi.mockResolvedValueOnce(detail).mockResolvedValueOnce(updated);
  render(<OrderDetail id="order-1" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Iniciar produção' }));
  expect((await screen.findAllByText('Em preparo')).length).toBeGreaterThan(0);
  expect(screen.queryByRole('button', { name: 'Iniciar produção' })).not.toBeInTheDocument();
  expect(mockApi).toHaveBeenNthCalledWith(2, '/api/admin/pedidos/order-1/iniciar-producao', {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: '{}',
  });
});

test('recarrega o pedido após conflito e remove a ação quando outro administrador iniciou a produção', async () => {
  const updated = { ...detail, statusAtual: 'EM_PREPARO' };
  mockApi.mockResolvedValueOnce(detail)
    .mockRejectedValueOnce(new AdminApiError(409, 'Pedido não pode iniciar a produção neste status.'))
    .mockResolvedValueOnce(updated);
  render(<OrderDetail id="order-1" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Iniciar produção' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('O pedido foi atualizado por outro administrador.');
  expect((await screen.findAllByText('Em preparo')).length).toBeGreaterThan(0);
  expect(screen.queryByRole('button', { name: 'Iniciar produção' })).not.toBeInTheDocument();
  expect(mockApi).toHaveBeenNthCalledWith(3, '/api/admin/pedidos/order-1');
});

test('não mantém ação stale se recarga após conflito falhar', async () => {
  mockApi.mockResolvedValueOnce(detail)
    .mockRejectedValueOnce(new AdminApiError(409, 'Conflito.'))
    .mockRejectedValueOnce(new Error('rede indisponível'));
  render(<OrderDetail id="order-1" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Iniciar produção' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('O pedido foi atualizado por outro administrador.');
  expect(screen.queryByRole('button', { name: 'Iniciar produção' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
});

test('retirada omite endereço e detalhe distingue 404, acesso negado e erro recuperável', async () => {
  mockApi.mockResolvedValueOnce({ ...detail, modalidade: 'RETIRADA', enderecoEntregaSnapshot: null });
  const view = render(<OrderDetail id="order-1" />);
  await screen.findByRole('heading', { name: 'Pedido PED-123' });
  expect(screen.queryByText('Endereço de entrega')).not.toBeInTheDocument();
  view.unmount();

  mockApi.mockRejectedValueOnce(new AdminApiError(404, 'Pedido não encontrado.'));
  const missing = render(<OrderDetail id="order-2" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Pedido não encontrado.');
  missing.unmount();

  mockApi.mockRejectedValueOnce(new AdminApiError(403, 'Acesso negado.'));
  const denied = render(<OrderDetail id="order-3" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Acesso negado.');
  expect(screen.queryByText('Ana Silva')).not.toBeInTheDocument();
  denied.unmount();

  mockApi.mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce(detail);
  render(<OrderDetail id="order-4" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao carregar pedido.');
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(await screen.findByRole('heading', { name: 'Pedido PED-123' })).toBeInTheDocument();
});
