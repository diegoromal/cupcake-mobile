import { act, fireEvent, render, screen, within } from '@testing-library/react';
import OrderList from '@/components/OrderList';
import OrderDetail from '@/components/OrderDetail';
import { AdminApiError, adminApi } from '@/lib/client/admin-api';
import { formatDate, statusLabel } from '@/lib/order-display';

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
  expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
    'Pedido', 'Data / Hora', 'Cliente', 'Modalidade', 'Status', 'Total', 'Ação',
  ]);
  expect(screen.getByRole('cell', { name: formatDate(order.confirmacaoPagamento) }))
    .toBeInTheDocument();
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
  cliente: { nome: 'Ana Silva' }, entregador: null, modalidade: 'ENTREGA', statusAtual: 'PAGO',
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
  const summary = within(screen.getByRole('region', { name: 'Pedido PED-123' }));
  expect(summary.getByRole('heading', { name: 'Pedido PED-123' })).toBeInTheDocument();
  expect(summary.getByText('Pago')).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Pedido PED-123' })).toHaveTextContent('Delivery');
  expect(summary.getByText(`Pagamento confirmado: ${formatDate(detail.confirmacaoPagamento)}`))
    .toBeInTheDocument();
  expect(screen.getByText('2 × Cupcake')).toBeInTheDocument();
  expect(screen.getByText(/Cobertura/)).toBeInTheDocument();
  expect(screen.getByText(/Rua A, 7/)).toBeInTheDocument();
  expect(screen.getByText('R$ 78,50')).toBeInTheDocument();
  expect(screen.getByText('Pix')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Histórico de alterações' })).toBeInTheDocument();
  expect(screen.getAllByText('Pago')).toHaveLength(3);
  expect(screen.getByRole('button', { name: 'Iniciar produção' })).toBeInTheDocument();
  expect(mockApi).toHaveBeenCalledWith('/api/admin/pedidos/order-1');
});

test('representa a sequência Delivery com Pago atual, Em preparo próximo e ação correspondente', async () => {
  mockApi.mockResolvedValue(detail);
  render(<OrderDetail id="order-1" />);
  await screen.findByRole('heading', { name: 'Pedido PED-123' });

  const steps = within(screen.getByRole('list', { name: 'Etapas do pedido' }));
  expect(steps.getAllByRole('listitem')).toHaveLength(5);
  expect(steps.getByRole('listitem', { name: 'Etapa concluída: Pendente de pagamento' }))
    .toBeInTheDocument();
  expect(steps.getByRole('listitem', { name: 'Etapa atual: Pago' })).toHaveAttribute('aria-current', 'step');
  expect(steps.getByRole('listitem', { name: 'Etapa próxima: Em preparo' })).toBeInTheDocument();
  expect(steps.getByRole('listitem', { name: 'Etapa pendente: Saiu para entrega' })).toBeInTheDocument();
  expect(steps.getByRole('listitem', { name: 'Etapa pendente: Entregue' })).toBeInTheDocument();
  expect(screen.getByText('Etapa 2 de 5')).toBeInTheDocument();
  expect(screen.getByText('Próxima etapa').parentElement).toHaveTextContent('Em preparo');
  expect(screen.getByRole('button', { name: 'Iniciar produção' })).toBeInTheDocument();
});

test('permite percorrer o stepper informativo com as setas sem transformar etapas em controles', async () => {
  mockApi.mockResolvedValue(detail);
  render(<OrderDetail id="order-1" />);
  await screen.findByRole('heading', { name: 'Pedido PED-123' });

  const region = screen.getByRole('region', { name: /Etapas do pedido.*setas esquerda e direita/i });
  const steps = within(screen.getByRole('list', { name: 'Etapas do pedido' }));
  expect(region).toHaveAttribute('tabindex', '0');
  expect(steps.getAllByRole('listitem')).toHaveLength(5);
  expect(steps.getByRole('listitem', { name: 'Etapa atual: Pago' })).toHaveAttribute('aria-current', 'step');
  expect(steps.getByRole('listitem', { name: 'Etapa pendente: Entregue' })).toBeInTheDocument();
  expect(steps.queryByRole('button')).not.toBeInTheDocument();

  Object.defineProperties(region, {
    clientWidth: { configurable: true, value: 233 },
    scrollWidth: { configurable: true, value: 692 },
    scrollLeft: { configurable: true, writable: true, value: 0 },
  });
  fireEvent.keyDown(region, { key: 'ArrowRight' });
  expect(region.scrollLeft).toBe(186);
  fireEvent.keyDown(region, { key: 'ArrowRight' });
  fireEvent.keyDown(region, { key: 'ArrowRight' });
  expect(region.scrollLeft).toBe(459);
  fireEvent.keyDown(region, { key: 'ArrowLeft' });
  expect(region.scrollLeft).toBe(273);
  fireEvent.keyDown(region, { key: 'ArrowLeft' });
  fireEvent.keyDown(region, { key: 'ArrowLeft' });
  expect(region.scrollLeft).toBe(0);
});

test('usa a sequência de Retirada e não apresenta etapas de Delivery', async () => {
  mockApi.mockResolvedValue({ ...detail, modalidade: 'RETIRADA', statusAtual: 'EM_PREPARO',
    enderecoEntregaSnapshot: null });
  render(<OrderDetail id="order-1" />);
  await screen.findByRole('heading', { name: 'Pedido PED-123' });

  const steps = within(screen.getByRole('list', { name: 'Etapas do pedido' }));
  expect(steps.getByRole('listitem', { name: 'Etapa atual: Em preparo' })).toHaveAttribute('aria-current', 'step');
  expect(steps.getByRole('listitem', { name: 'Etapa próxima: Pronto para retirada' })).toBeInTheDocument();
  expect(steps.getByRole('listitem', { name: 'Etapa pendente: Retirado' })).toBeInTheDocument();
  expect(steps.queryByText('Saiu para entrega')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Marcar como pronto para retirada' })).toBeInTheDocument();
});

test.each([
  ['saiu para entrega', { modalidade: 'ENTREGA', statusAtual: 'SAIU_PARA_ENTREGA' }, 'Entregue'],
  ['pedido entregue', { modalidade: 'ENTREGA', statusAtual: 'ENTREGUE' }, null],
  ['pedido retirado', { modalidade: 'RETIRADA', statusAtual: 'RETIRADO' }, null],
  ['pedido cancelado', { modalidade: 'ENTREGA', statusAtual: 'CANCELADO' }, null],
  ['pedido expirado', { modalidade: 'ENTREGA', statusAtual: 'EXPIRADO' }, null],
] as const)('%s apresenta somente a progressão compatível e não oferece ação indevida', async (_label, changes, nextLabel) => {
  mockApi.mockResolvedValue({ ...detail, ...changes });
  render(<OrderDetail id="order-1" />);
  await screen.findByRole('heading', { name: 'Pedido PED-123' });

  const steps = within(screen.getByRole('list', { name: 'Etapas do pedido' }));
  expect(steps.getByRole('listitem', { name: `Etapa atual: ${statusLabel[changes.statusAtual]}` }))
    .toHaveAttribute('aria-current', 'step');
  if (nextLabel) {
    expect(steps.getByRole('listitem', { name: `Etapa próxima: ${nextLabel}` })).toBeInTheDocument();
    expect(screen.getByText('Próxima etapa').parentElement).toHaveTextContent(nextLabel);
  } else {
    expect(screen.queryByText('Próxima etapa')).not.toBeInTheDocument();
  }
  expect(screen.queryByRole('button', { name: /Iniciar produção|saiu para entrega|retirada/i }))
    .not.toBeInTheDocument();
});

test('confirma início de produção, cancela sem PATCH e impede envio duplicado', async () => {
  const updated = { ...detail, statusAtual: 'EM_PREPARO', historicoStatus: [
    ...detail.historicoStatus,
    { id: 'history-2', status: 'EM_PREPARO', dataHora: '2026-10-20T12:02:00.000Z', responsavel: 'Admin' },
  ] };
  let finishPatch!: (value: unknown) => void;
  const patch = new Promise((resolve) => { finishPatch = resolve; });
  mockApi.mockResolvedValueOnce(detail).mockImplementationOnce(() => patch).mockResolvedValueOnce(updated)
    .mockResolvedValueOnce([]);
  render(<OrderDetail id="order-1" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Iniciar produção' }));
  expect(screen.getByRole('heading', { name: 'Confirmar início da produção' })).toHaveFocus();
  expect(screen.getByText(/PED-123 passará de Pago para Em preparo/)).toBeInTheDocument();
  expect(mockApi).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Voltar sem alterar' }));
  expect(screen.queryByRole('heading', { name: 'Confirmar início da produção' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Iniciar produção' })).toHaveFocus();
  expect(mockApi).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole('button', { name: 'Iniciar produção' }));
  const confirm = screen.getByRole('button', { name: 'Confirmar início da produção' });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  expect(screen.getByRole('status')).toHaveTextContent('Atualizando pedido...');
  expect(screen.getByRole('button', { name: 'Salvando alteração...' })).toBeDisabled();
  expect(mockApi).toHaveBeenCalledTimes(2);
  await act(async () => { finishPatch(updated); await patch; });
  expect((await screen.findAllByText('Em preparo')).length).toBeGreaterThan(0);
  expect(screen.queryByRole('button', { name: 'Iniciar produção' })).not.toBeInTheDocument();
  expect(mockApi).toHaveBeenNthCalledWith(2, '/api/admin/pedidos/order-1/iniciar-producao', {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  expect(mockApi).toHaveBeenNthCalledWith(3, '/api/admin/pedidos/order-1');
});

test('recarrega o pedido após conflito e remove a ação quando outro administrador iniciou a produção', async () => {
  const updated = { ...detail, statusAtual: 'EM_PREPARO' };
  mockApi.mockResolvedValueOnce(detail)
    .mockRejectedValueOnce(new AdminApiError(409, 'Pedido não pode iniciar a produção neste status.'))
    .mockResolvedValueOnce(updated).mockResolvedValueOnce([]);
  render(<OrderDetail id="order-1" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Iniciar produção' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar início da produção' }));
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
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar início da produção' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('O pedido foi atualizado por outro administrador.');
  expect(screen.queryByRole('button', { name: 'Iniciar produção' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
});

test('retirada avança apenas pelas duas ações válidas e atualiza o pedido após cada PATCH', async () => {
  const preparing = { ...detail, modalidade: 'RETIRADA', statusAtual: 'EM_PREPARO',
    enderecoEntregaSnapshot: null };
  const ready = { ...preparing, statusAtual: 'PRONTO_PARA_RETIRADA' };
  const collected = { ...ready, statusAtual: 'RETIRADO' };
  mockApi.mockResolvedValueOnce(preparing).mockResolvedValueOnce(ready).mockResolvedValueOnce(ready)
    .mockResolvedValueOnce(collected).mockResolvedValueOnce(collected);
  render(<OrderDetail id="order-1" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Marcar como pronto para retirada' }));
  expect(screen.getByText(/Em preparo para Pronto para retirada/)).toBeInTheDocument();
  expect(mockApi).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar pedido pronto para retirada' }));
  expect(await screen.findByRole('button', { name: 'Confirmar retirada' })).toBeInTheDocument();
  expect(mockApi).toHaveBeenNthCalledWith(2, '/api/admin/pedidos/order-1/pronto-para-retirada', {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  expect(mockApi).toHaveBeenNthCalledWith(3, '/api/admin/pedidos/order-1');
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar retirada' }));
  expect(screen.getByText(/Pronto para retirada para Retirado/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar retirada do pedido' }));
  expect((await screen.findAllByText('Retirado')).length).toBeGreaterThan(0);
  expect(screen.queryByRole('button', { name: 'Confirmar retirada' })).not.toBeInTheDocument();
  expect(mockApi).toHaveBeenNthCalledWith(4, '/api/admin/pedidos/order-1/confirmar-retirada', {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  expect(mockApi).toHaveBeenNthCalledWith(5, '/api/admin/pedidos/order-1');
});

test('não oferece retirada em Delivery nem ação administrativa para pedido entregue', async () => {
  mockApi.mockResolvedValueOnce({ ...detail, statusAtual: 'EM_PREPARO' }).mockResolvedValueOnce([]);
  const delivery = render(<OrderDetail id="order-1" />);
  await screen.findByRole('heading', { name: 'Pedido PED-123' });
  expect(screen.queryByRole('button', { name: /retirada/i })).not.toBeInTheDocument();
  delivery.unmount();
  mockApi.mockResolvedValueOnce({ ...detail, statusAtual: 'ENTREGUE' });
  render(<OrderDetail id="order-1" />);
  await screen.findByRole('heading', { name: 'Pedido PED-123' });
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('atribui entregador ao confirmar saída de Delivery em preparo', async () => {
  const preparing = { ...detail, statusAtual: 'EM_PREPARO' };
  const courier = { id: 'courier-1', nome: 'João Entregador' };
  const departed = { ...preparing, statusAtual: 'SAIU_PARA_ENTREGA', entregador: courier };
  mockApi.mockResolvedValueOnce(preparing).mockResolvedValueOnce([courier])
    .mockResolvedValueOnce(departed).mockResolvedValueOnce(departed);
  render(<OrderDetail id="order-1" />);
  const select = await screen.findByLabelText('Entregador');
  expect(mockApi).toHaveBeenNthCalledWith(2, '/api/admin/entregadores');
  expect(screen.getByRole('button', { name: 'Marcar como saiu para entrega' })).toBeDisabled();
  fireEvent.change(select, { target: { value: courier.id } });
  fireEvent.click(screen.getByRole('button', { name: 'Marcar como saiu para entrega' }));
  expect(screen.getByText(/Entregador: João Entregador/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar saída para entrega' }));
  expect(await screen.findByText('Entregador: João Entregador')).toBeInTheDocument();
  expect(mockApi).toHaveBeenNthCalledWith(3, '/api/admin/pedidos/order-1/saiu-para-entrega', {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ entregadorUsuarioId: courier.id }),
  });
  expect(mockApi).toHaveBeenNthCalledWith(4, '/api/admin/pedidos/order-1');
});

test('permite tentar carregar entregadores novamente após falha', async () => {
  const preparing = { ...detail, statusAtual: 'EM_PREPARO' };
  const courier = { id: 'courier-1', nome: 'João Entregador' };
  mockApi.mockResolvedValueOnce(preparing).mockRejectedValueOnce(new Error('API indisponível'))
    .mockResolvedValueOnce([courier]);
  render(<OrderDetail id="order-1" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os entregadores.');
  fireEvent.click(screen.getByRole('button', { name: 'Tentar carregar novamente' }));
  expect(await screen.findByRole('option', { name: 'João Entregador' })).toBeInTheDocument();
  expect(mockApi).toHaveBeenNthCalledWith(3, '/api/admin/entregadores');
});

test('conflito na retirada recarrega estado vigente sem manter confirmação antiga', async () => {
  const ready = { ...detail, modalidade: 'RETIRADA', statusAtual: 'PRONTO_PARA_RETIRADA' };
  mockApi.mockResolvedValueOnce(ready)
    .mockRejectedValueOnce(new AdminApiError(409, 'Status alterado.'))
    .mockResolvedValueOnce({ ...ready, statusAtual: 'RETIRADO' });
  render(<OrderDetail id="order-1" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Confirmar retirada' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar retirada do pedido' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('O pedido foi atualizado por outro administrador.');
  expect(screen.queryByRole('button', { name: 'Confirmar retirada' })).not.toBeInTheDocument();
  expect(mockApi).toHaveBeenNthCalledWith(3, '/api/admin/pedidos/order-1');
});

test('erro na retirada recarrega o pedido e informa falha sem assumir transição', async () => {
  const ready = { ...detail, modalidade: 'RETIRADA', statusAtual: 'PRONTO_PARA_RETIRADA' };
  mockApi.mockResolvedValueOnce(ready).mockRejectedValueOnce(new Error('rede indisponível'))
    .mockResolvedValueOnce(ready);
  render(<OrderDetail id="order-1" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Confirmar retirada' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar retirada do pedido' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao atualizar o pedido.');
  expect(screen.getByRole('button', { name: 'Confirmar retirada' })).toBeInTheDocument();
  expect(mockApi).toHaveBeenCalledTimes(3);
  expect(mockApi).toHaveBeenNthCalledWith(3, '/api/admin/pedidos/order-1');
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
