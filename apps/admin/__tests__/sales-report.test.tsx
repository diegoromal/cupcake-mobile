import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SalesReport from '@/components/SalesReport';
import { adminApi } from '@/lib/client/admin-api';

jest.mock('@/lib/client/admin-api', () => ({
  adminApi: jest.fn(),
  AdminApiError: class AdminApiError extends Error { constructor(public status: number, message: string) { super(message); } },
}));

const result = {
  inicio: '2026-10-01', fim: '2026-10-31', totalVendido: '120.50', quantidadePedidos: 2,
  pedidos: [{ id: '1', identificadorNegocio: 'PED-1', data: '2026-10-02T12:30:00.000Z', cliente: 'Ana', modalidade: 'ENTREGA' as const, statusAtual: 'ENTREGUE' as const, total: '100.00' },
    { id: '2', identificadorNegocio: 'PED-2', data: '2026-10-03T13:30:00.000Z', cliente: 'Bia', modalidade: 'RETIRADA' as const, statusAtual: 'RETIRADO' as const, total: '20.50' }],
};

beforeEach(() => jest.clearAllMocks());

test('aplica período, apresenta totais e pedidos entregues e retirados', async () => {
  jest.mocked(adminApi).mockResolvedValue(result);
  render(<SalesReport />);
  fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-10-01' } });
  fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-10-31' } });
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar período' }));

  expect(await screen.findByText('PED-1')).toBeInTheDocument();
  expect(screen.getByText('PED-2')).toBeInTheDocument();
  expect(screen.getByText('Quantidade de pedidos')).toBeInTheDocument();
  expect(screen.getByText(/120,50/)).toBeInTheDocument();
  expect(adminApi).toHaveBeenCalledWith(expect.stringContaining('inicio=2026-10-01&fim=2026-10-31'));
});

test('não consulta com período invertido', async () => {
  render(<SalesReport />);
  fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-10-02' } });
  fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-10-01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar período' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('data inicial deve ser anterior ou igual');
  expect(adminApi).not.toHaveBeenCalled();
});

test('mostra estado vazio quando o período não possui pedidos elegíveis', async () => {
  jest.mocked(adminApi).mockResolvedValue({ ...result, totalVendido: '0.00', quantidadePedidos: 0, pedidos: [] });
  render(<SalesReport />);
  fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-10-01' } });
  fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-10-31' } });
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar período' }));

  await waitFor(() => expect(screen.getByText('Nenhum pedido finalizado encontrado neste período.')).toBeInTheDocument());
  expect(screen.getByText(/0,00/)).toBeInTheDocument();
});
