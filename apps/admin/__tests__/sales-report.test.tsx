import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  const filters = screen.getByRole('button', { name: 'Aplicar período' }).closest('form');
  expect(screen.getByText('Exportar relatório:')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Exportar PDF' }).closest('form')).toBe(filters);
  expect(screen.getByRole('button', { name: 'Exportar CSV' }).closest('form')).toBe(filters);
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

test('pinta o feedback por dois frames antes de imprimir e preserva o relatório', async () => {
  const frames: FrameRequestCallback[] = [];
  const requestAnimationFrame = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    frames.push(callback);
    return frames.length;
  });
  const print = jest.spyOn(window, 'print').mockImplementation(() => {
    expect(screen.getByRole('button', { name: 'Preparando PDF…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('PDF');
  });
  jest.mocked(adminApi).mockResolvedValue(result);
  render(<SalesReport />);

  expect(screen.queryByRole('button', { name: 'Exportar PDF' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-10-01' } });
  fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-10-31' } });
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar período' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Exportar PDF' }));

  expect(screen.getByRole('button', { name: 'Preparando PDF…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('PDF');
  expect(print).not.toHaveBeenCalled();
  await act(async () => { frames.shift()?.(16); });
  expect(screen.getByRole('button', { name: 'Preparando PDF…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('PDF');
  expect(print).not.toHaveBeenCalled();
  await act(async () => { frames.shift()?.(32); });
  expect(print).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Exportar PDF' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeEnabled();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Data inicial')).toHaveValue('2026-10-01');
  expect(screen.getByLabelText('Data final')).toHaveValue('2026-10-31');
  expect(screen.getByText('PED-1')).toBeInTheDocument();
  expect(screen.getByText('PED-2')).toBeInTheDocument();
  expect(adminApi).toHaveBeenCalledTimes(1);
  requestAnimationFrame.mockRestore();
  print.mockRestore();
});

test('falha da impressão mostra erro e libera as exportações', async () => {
  const frames: FrameRequestCallback[] = [];
  const requestAnimationFrame = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    frames.push(callback);
    return frames.length;
  });
  const print = jest.spyOn(window, 'print').mockImplementation(() => { throw new Error('print indisponível'); });
  jest.mocked(adminApi).mockResolvedValue(result);
  render(<SalesReport />);
  fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-10-01' } });
  fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-10-31' } });
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar período' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Exportar PDF' }));
  await act(async () => { frames.shift()?.(16); });
  await act(async () => { frames.shift()?.(32); });

  expect(print).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível preparar o PDF. Tente novamente.');
  expect(screen.getByRole('button', { name: 'Exportar PDF' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeEnabled();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByText('PED-1')).toBeInTheDocument();
  requestAnimationFrame.mockRestore();
  print.mockRestore();
});

test('exporta CSV com os seis campos da tabela, na ordem recebida, sem nova consulta', async () => {
  const specialResult = {
    ...result,
    pedidos: [{
      ...result.pedidos[0],
      identificadorNegocio: '=HYPERLINK("https://example.test")',
      cliente: 'Érica, "Bia"\nLoja',
    }, result.pedidos[1]],
  };
  jest.mocked(adminApi).mockResolvedValue(specialResult);
  let capturedBlob: Blob | undefined;
  const createObjectURL = jest.fn((blob: Blob) => { capturedBlob = blob; return 'blob:d97'; });
  const revokeObjectURL = jest.fn();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
  const frames: FrameRequestCallback[] = [];
  const requestAnimationFrame = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    frames.push(callback);
    return frames.length;
  });
  const download = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.download).toBe('relatorio-vendas.csv');
    expect(this.href).toBe('blob:d97');
  });

  render(<SalesReport />);
  expect(screen.queryByRole('button', { name: 'Exportar CSV' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-10-01' } });
  fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-10-31' } });
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar período' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Exportar CSV' }));

  expect(screen.getByRole('button', { name: 'Preparando CSV…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Exportar PDF' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('CSV');
  expect(createObjectURL).not.toHaveBeenCalled();
  await act(async () => { frames.shift()?.(16); });
  expect(screen.getByRole('button', { name: 'Preparando CSV…' })).toBeInTheDocument();
  expect(createObjectURL).not.toHaveBeenCalled();
  await act(async () => { frames.shift()?.(32); });
  await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeEnabled();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();

  expect(createObjectURL).toHaveBeenCalledTimes(1);
  const blob = capturedBlob;
  expect(blob).toBeDefined();
  if (!blob) throw new Error('CSV Blob não foi criado.');
  const csv = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
  expect(blob.type).toBe('text/csv;charset=utf-8');
  expect(csv.split('\r\n')).toHaveLength(3);
  expect(csv.split('\r\n')[0]).toBe('"Pedido","Data e hora","Cliente","Modalidade","Status","Valor total"');
  expect(csv).toContain('"\'=HYPERLINK(""https://example.test"")"');
  expect(csv).toContain('"2026-10-02T12:30:00.000Z"');
  expect(csv).toContain('"Érica, ""Bia""\nLoja"');
  expect(csv).toContain('"Delivery","Entregue","100.00"');
  expect(csv).toContain('"Retirada","Retirado","20.50"');
  expect(csv).not.toContain('"1"');
  expect(csv).not.toContain('2026-10-01');
  expect(csv).not.toContain('120.50');
  expect(adminApi).toHaveBeenCalledTimes(1);
  expect(download).toHaveBeenCalledTimes(1);
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:d97');
  requestAnimationFrame.mockRestore();
  download.mockRestore();
});

test('exporta relatório sem pedidos com cabeçalho e sem linhas de dados', async () => {
  jest.mocked(adminApi).mockResolvedValue({ ...result, totalVendido: '0.00', quantidadePedidos: 0, pedidos: [] });
  let capturedBlob: Blob | undefined;
  const createObjectURL = jest.fn((blob: Blob) => { capturedBlob = blob; return 'blob:empty'; });
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
  const frames: FrameRequestCallback[] = [];
  const requestAnimationFrame = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    frames.push(callback);
    return frames.length;
  });
  const download = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

  render(<SalesReport />);
  fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-10-01' } });
  fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-10-31' } });
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar período' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Exportar CSV' }));
  await act(async () => { frames.shift()?.(16); });
  await act(async () => { frames.shift()?.(32); });

  const blob = capturedBlob;
  expect(blob).toBeDefined();
  if (!blob) throw new Error('CSV Blob não foi criado.');
  const csv = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
  expect(csv).toBe('"Pedido","Data e hora","Cliente","Modalidade","Status","Valor total"');
  expect(download).toHaveBeenCalledTimes(1);
  requestAnimationFrame.mockRestore();
  download.mockRestore();
});
