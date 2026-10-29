import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ConfiguracaoLojaEntregaForm from '@/components/ConfiguracaoLojaEntregaForm';
import { adminApi, AdminApiError } from '@/lib/client/admin-api';

jest.mock('@/lib/client/admin-api', () => ({
  adminApi: jest.fn(),
  AdminApiError: class extends Error {
    constructor(public status: number, message: string) { super(message); }
  },
}));

const mock = adminApi as jest.Mock;
const configuration = {
  latitudeLoja: '-23.550520',
  longitudeLoja: '-46.633308',
  raioMaximoAtendimento: '10.000',
  taxaBase: '5.00',
  valorPorQuilometro: '2.00',
};
const fieldLabels = ['Latitude da loja', 'Longitude da loja', 'Raio máximo (km)', 'Taxa base (R$)', 'Valor por km (R$)'];

function expectEditing(enabled: boolean) {
  for (const label of fieldLabels) {
    expect(screen.getByLabelText(label)).toHaveProperty('disabled', !enabled);
  }
  expect(screen.getByRole('button', { name: 'Salvar configuração' })).toHaveProperty('disabled', !enabled);
}

function fillConfiguration() {
  fireEvent.change(screen.getByLabelText('Latitude da loja'), { target: { value: configuration.latitudeLoja } });
  fireEvent.change(screen.getByLabelText('Longitude da loja'), { target: { value: configuration.longitudeLoja } });
  fireEvent.change(screen.getByLabelText('Raio máximo (km)'), { target: { value: configuration.raioMaximoAtendimento } });
  fireEvent.change(screen.getByLabelText('Taxa base (R$)'), { target: { value: configuration.taxaBase } });
  fireEvent.change(screen.getByLabelText('Valor por km (R$)'), { target: { value: configuration.valorPorQuilometro } });
}

afterEach(() => mock.mockReset());

test('loading não apresenta estado vazio ou erro', async () => {
  let resolve!: (value: unknown) => void;
  mock.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  render(<ConfiguracaoLojaEntregaForm />);

  expect(screen.getByRole('status')).toHaveTextContent('Carregando configuração');
  expect(screen.queryByRole('button', { name: 'Salvar configuração' })).not.toBeInTheDocument();
  expect(screen.queryByText('Nenhuma configuração cadastrada.')).not.toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  resolve(configuration);
  expect(await screen.findByLabelText('Latitude da loja')).toHaveValue(configuration.latitudeLoja);
});

test('404 mostra configuração ausente sem mensagem de erro', async () => {
  mock.mockRejectedValueOnce(new AdminApiError(404, 'Configuração da loja não encontrada.'));
  render(<ConfiguracaoLojaEntregaForm />);

  expect(await screen.findByText('Nenhuma configuração cadastrada.')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Recarregar' })).toBeInTheDocument();
  expectEditing(true);
  fillConfiguration();
  mock.mockResolvedValueOnce(configuration);
  fireEvent.click(screen.getByRole('button', { name: 'Salvar configuração' }));
  expect(await screen.findByText('Configuração salva.')).toBeInTheDocument();
  expect(mock).toHaveBeenNthCalledWith(2, '/api/admin/configuracao-loja-entrega', expect.objectContaining({
    method: 'PUT', body: JSON.stringify(configuration),
  }));
});

test('falha de consulta mostra erro e retry sem apresentar estado vazio', async () => {
  mock.mockRejectedValueOnce(new AdminApiError(503, 'Falha de consulta.'));
  render(<ConfiguracaoLojaEntregaForm />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Falha de consulta.');
  expect(screen.queryByText('Nenhuma configuração cadastrada.')).not.toBeInTheDocument();
  expectEditing(false);
  fireEvent.submit(screen.getByRole('button', { name: 'Salvar configuração' }).closest('form')!);
  expect(mock).toHaveBeenCalledTimes(1);
  mock.mockResolvedValueOnce(configuration);
  fireEvent.click(screen.getByRole('button', { name: 'Recarregar' }));
  expect(await screen.findByLabelText('Latitude da loja')).toHaveValue(configuration.latitudeLoja);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByText('Nenhuma configuração cadastrada.')).not.toBeInTheDocument();
  expectEditing(true);
});

test('configuração carregada apresenta os cinco valores normalmente', async () => {
  mock.mockResolvedValueOnce(configuration);
  render(<ConfiguracaoLojaEntregaForm />);

  await waitFor(() => expect(screen.getByLabelText('Latitude da loja')).toHaveValue(configuration.latitudeLoja));
  expect(screen.getByLabelText('Longitude da loja')).toHaveValue(configuration.longitudeLoja);
  expect(screen.getByLabelText('Raio máximo (km)')).toHaveValue(configuration.raioMaximoAtendimento);
  expect(screen.getByLabelText('Taxa base (R$)')).toHaveValue(configuration.taxaBase);
  expect(screen.getByLabelText('Valor por km (R$)')).toHaveValue(configuration.valorPorQuilometro);
  expect(screen.queryByText('Nenhuma configuração cadastrada.')).not.toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expectEditing(true);
  const updated = { ...configuration, taxaBase: '6.00' };
  fireEvent.change(screen.getByLabelText('Taxa base (R$)'), { target: { value: updated.taxaBase } });
  mock.mockResolvedValueOnce(updated);
  fireEvent.click(screen.getByRole('button', { name: 'Salvar configuração' }));
  expect(await screen.findByText('Configuração salva.')).toBeInTheDocument();
  expect(mock).toHaveBeenNthCalledWith(2, '/api/admin/configuracao-loja-entrega', expect.objectContaining({
    method: 'PUT', body: JSON.stringify(updated),
  }));
});

test.each([
  ['403', new AdminApiError(403, 'Acesso negado.')],
  ['500', new AdminApiError(500, 'Falha interna.')],
  ['rede', new Error('Rede indisponível.')],
])('GET %s bloqueia edição e submit programático sem PUT', async (_, failure) => {
  mock.mockRejectedValueOnce(failure);
  render(<ConfiguracaoLojaEntregaForm />);

  expect(await screen.findByRole('alert')).toHaveTextContent(failure.message);
  expectEditing(false);
  expect(screen.getByRole('button', { name: 'Recarregar' })).toBeEnabled();
  fireEvent.submit(screen.getByRole('button', { name: 'Salvar configuração' }).closest('form')!);
  expect(mock).toHaveBeenCalledTimes(1);

  mock.mockResolvedValueOnce(configuration);
  fireEvent.click(screen.getByRole('button', { name: 'Recarregar' }));
  await waitFor(() => expect(screen.getByLabelText('Latitude da loja')).toHaveValue(configuration.latitudeLoja));
  expectEditing(true);
  mock.mockRejectedValueOnce(failure);
  fireEvent.click(screen.getByRole('button', { name: 'Recarregar' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(failure.message);
  expect(screen.getByLabelText('Latitude da loja')).toHaveValue(configuration.latitudeLoja);
  expectEditing(false);
  fireEvent.submit(screen.getByRole('button', { name: 'Salvar configuração' }).closest('form')!);
  expect(mock).toHaveBeenCalledTimes(3);
});

test('retry após erro para 404 libera criação', async () => {
  mock.mockRejectedValueOnce(new AdminApiError(500, 'Falha interna.'));
  render(<ConfiguracaoLojaEntregaForm />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Falha interna.');
  expectEditing(false);

  mock.mockRejectedValueOnce(new AdminApiError(404, 'Configuração da loja não encontrada.'));
  fireEvent.click(screen.getByRole('button', { name: 'Recarregar' }));
  expect(await screen.findByText('Nenhuma configuração cadastrada.')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expectEditing(true);
  fillConfiguration();
  mock.mockResolvedValueOnce(configuration);
  fireEvent.click(screen.getByRole('button', { name: 'Salvar configuração' }));
  expect(await screen.findByText('Configuração salva.')).toBeInTheDocument();
  expect(mock).toHaveBeenCalledTimes(3);
});
