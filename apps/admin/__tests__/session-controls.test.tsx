import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginForm from '@/components/LoginForm';
import LogoutButton from '@/components/LogoutButton';
import { adminApi } from '@/lib/client/admin-api';

jest.mock('@/lib/client/admin-api', () => ({ adminApi: jest.fn() }));
const replace = jest.fn();
const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace, push }) }));
const request = adminApi as jest.Mock;

function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => { request.mockReset(); replace.mockReset(); push.mockReset(); });

test('login desabilita controles durante request, bloqueia submit concorrente e restaura após erro', async () => {
  const pending = deferred();
  request.mockReturnValue(pending.promise);
  const user = userEvent.setup();
  const { container } = render(<LoginForm />);
  const email = screen.getByLabelText('E-mail');
  const senha = screen.getByLabelText('Senha');
  await user.type(email, 'admin@example.com');
  await user.type(senha, 'senha');
  const form = container.querySelector('form')!;
  fireEvent.submit(form);
  expect(request).toHaveBeenCalledTimes(1);
  expect(email).toBeDisabled();
  expect(senha).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Entrando...' })).toBeDisabled();
  fireEvent.submit(form);
  expect(request).toHaveBeenCalledTimes(1);
  expect(email).toBeDisabled();
  expect(senha).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Entrando...' })).toBeDisabled();
  pending.reject(new Error('Falha no login'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Falha no login');
  await waitFor(() => {
    expect(email).toBeEnabled();
    expect(senha).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });
  expect(replace).not.toHaveBeenCalled();
});

test('logout desabilita botão durante request e bloqueia cliques concorrentes', async () => {
  const pending = deferred();
  request.mockReturnValue(pending.promise);
  const user = userEvent.setup();
  render(<LogoutButton />);
  await user.click(screen.getByRole('button', { name: 'Sair' }));
  expect(request).toHaveBeenCalledWith('/api/session/logout', { method: 'POST' });
  expect(request).toHaveBeenCalledTimes(1);
  const button = screen.getByRole('button', { name: 'Saindo...' });
  expect(button).toBeDisabled();
  fireEvent.click(button);
  fireEvent.click(button);
  expect(request).toHaveBeenCalledTimes(1);
  expect(button).toBeDisabled();
  expect(push).not.toHaveBeenCalled();
  pending.resolve(undefined);
  await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
});

test('logout exibe erro e restaura botão após falha', async () => {
  const pending = deferred();
  request.mockReturnValue(pending.promise);
  const user = userEvent.setup();
  render(<LogoutButton />);
  await user.click(screen.getByRole('button', { name: 'Sair' }));
  expect(screen.getByRole('button', { name: 'Saindo...' })).toBeDisabled();
  pending.reject(new Error('Falha ao sair'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao sair');
  expect(screen.getByRole('button', { name: 'Sair' })).toBeEnabled();
  expect(push).not.toHaveBeenCalled();
  request.mockResolvedValueOnce(undefined);
  await user.click(screen.getByRole('button', { name: 'Sair' }));
  expect(request).toHaveBeenCalledTimes(2);
  await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
});
