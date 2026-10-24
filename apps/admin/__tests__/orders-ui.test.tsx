import { fireEvent, render, screen } from '@testing-library/react';
import OrderList from '@/components/OrderList';
import { adminApi } from '@/lib/client/admin-api';

jest.mock('@/lib/client/admin-api', () => ({ adminApi: jest.fn() }));
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
  expect(screen.getByText('Pronto para retirada')).toBeInTheDocument();
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
