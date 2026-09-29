import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductStock from '@/components/ProductStock';
import { adminApi, AdminApiError } from '@/lib/client/admin-api';

jest.mock('@/lib/client/admin-api', () => {
  const real = jest.requireActual('@/lib/client/admin-api');
  return { ...real, adminApi: jest.fn() };
});
const mock = adminApi as jest.Mock;
const saldo = { produtoId: 'p1', quantidadeFisica: 8, quantidadeReservada: 3, quantidadeDisponivel: 5 };
const movimento = { id: 'm1', produtoId: 'p1', pedidoId: null, quantidade: 2,
  motivoOrigem: 'AJUSTE_ADMINISTRATIVO', data: '2026-09-29T12:00:00.000Z' };

beforeEach(() => {
  mock.mockReset().mockImplementation((path: string, options?: RequestInit) => {
    if (options?.method === 'PATCH') return Promise.resolve({ ...saldo, quantidadeFisica: 7, quantidadeDisponivel: 4 });
    return Promise.resolve(path.endsWith('movimentacoes') ? [movimento] : saldo);
  });
});

test('mostra saldo e histórico e envia apenas disponibilidade alvo', async () => {
  let historyReads = 0;
  mock.mockImplementation((path: string, options?: RequestInit) => {
    if (options?.method === 'PATCH') return Promise.resolve({ ...saldo, quantidadeFisica: 7, quantidadeDisponivel: 4 });
    if (path.endsWith('movimentacoes')) return Promise.resolve(++historyReads === 1 ? [movimento] : [
      { ...movimento, id: 'm2', quantidade: -1 }, movimento,
    ]);
    return Promise.resolve(saldo);
  });
  const user = userEvent.setup();
  render(<ProductStock id="p1" />);
  expect(await screen.findByText(/Físico: 8/)).toHaveTextContent('Reservado: 3 · Disponível: 5');
  expect(screen.getByText('Ajuste administrativo')).toBeInTheDocument();
  await user.clear(screen.getByLabelText('Quantidade disponível'));
  await user.type(screen.getByLabelText('Quantidade disponível'), '4');
  await user.click(screen.getByRole('button', { name: 'Ajustar estoque' }));
  await waitFor(() => expect(screen.getByText(/Físico: 7/)).toBeInTheDocument());
  expect(JSON.parse(mock.mock.calls.find(call => call[1]?.method === 'PATCH')[1].body))
    .toEqual({ quantidadeDisponivel: 4 });
  expect(mock.mock.calls.filter(call => call[0].endsWith('movimentacoes'))).toHaveLength(2);
  expect(await screen.findByText('-1')).toBeInTheDocument();
});

test('mostra loading e histórico vazio ao concluir a consulta', async () => {
  let finishSaldo!: (value: typeof saldo) => void;
  let finishHistory!: (value: typeof movimento[]) => void;
  mock.mockImplementation((path: string) => path.endsWith('movimentacoes')
    ? new Promise(resolve => { finishHistory = resolve; })
    : new Promise(resolve => { finishSaldo = resolve; }));
  render(<ProductStock id="p1" />);
  expect(screen.getByRole('status')).toHaveTextContent('Carregando estoque...');
  finishSaldo(saldo);
  finishHistory([]);
  expect(await screen.findByText('Nenhuma movimentação registrada.')).toBeInTheDocument();
  expect(screen.queryByText('Carregando estoque...')).not.toBeInTheDocument();
});

test('mostra falha de consulta e permite recarregar saldo e histórico', async () => {
  const user = userEvent.setup();
  let failed = false;
  mock.mockImplementation((path: string) => {
    if (!failed) { failed = true; return Promise.reject(new Error('Falha de rede.')); }
    return Promise.resolve(path.endsWith('movimentacoes') ? [] : saldo);
  });
  render(<ProductStock id="p1" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Falha de rede.');
  await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(await screen.findByText(/Físico: 8/)).toBeInTheDocument();
  expect(screen.getByText('Nenhuma movimentação registrada.')).toBeInTheDocument();
});

test('mostra erro de ajuste sem perder saldo e permite repetir', async () => {
  const user = userEvent.setup();
  let attempts = 0;
  mock.mockImplementation((path: string, options?: RequestInit) => {
    if (options?.method === 'PATCH') return ++attempts === 1
      ? Promise.reject(new AdminApiError(409, 'Estoque indisponível.'))
      : Promise.resolve({ ...saldo, quantidadeFisica: 9, quantidadeDisponivel: 6 });
    return Promise.resolve(path.endsWith('movimentacoes') ? [] : saldo);
  });
  render(<ProductStock id="p1" />);
  await screen.findByText(/Físico: 8/);
  await user.click(screen.getByRole('button', { name: 'Ajustar estoque' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Estoque indisponível.');
  expect(screen.getByText(/Físico: 8/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Ajustar estoque' }));
  expect(await screen.findByText(/Físico: 9/)).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(attempts).toBe(2);
});

test('recupera histórico após falha no GET sem repetir ajuste confirmado', async () => {
  const user = userEvent.setup();
  let historyReads = 0;
  mock.mockImplementation((path: string, options?: RequestInit) => {
    if (options?.method === 'PATCH') return Promise.resolve({ ...saldo, quantidadeFisica: 7, quantidadeDisponivel: 4 });
    if (path.endsWith('movimentacoes')) {
      historyReads += 1;
      if (historyReads === 2) return Promise.reject(new Error('Falha de rede.'));
      return Promise.resolve(historyReads === 1 ? [movimento] : [
        { ...movimento, id: 'm2', quantidade: -1 }, movimento,
      ]);
    }
    return Promise.resolve(saldo);
  });
  render(<ProductStock id="p1" />);
  await screen.findByText(/Físico: 8/);
  await user.clear(screen.getByLabelText('Quantidade disponível'));
  await user.type(screen.getByLabelText('Quantidade disponível'), '4');
  await user.click(screen.getByRole('button', { name: 'Ajustar estoque' }));
  expect(await screen.findByText(/Físico: 7/)).toHaveTextContent('Reservado: 3 · Disponível: 4');
  expect(screen.getByRole('status')).toHaveTextContent('Ajuste salvo.');
  expect(await screen.findByRole('alert')).toHaveTextContent('O histórico exibido pode estar desatualizado.');
  expect(screen.queryByText('-1')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Recarregar histórico' }));
  expect(await screen.findByText('-1')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText(/Físico: 7/)).toHaveTextContent('Reservado: 3 · Disponível: 4');
  expect(mock.mock.calls.filter(call => call[1]?.method === 'PATCH')).toHaveLength(1);
  expect(historyReads).toBe(3);
});
