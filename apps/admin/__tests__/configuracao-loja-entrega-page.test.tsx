import { render, screen } from '@testing-library/react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import ConfiguracaoLojaEntregaPage from '@/app/configuracao-loja-entrega/page';

jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('next/navigation', () => ({ redirect: jest.fn() }));
jest.mock('@/components/AdminHeader', () => function Header() { return <nav>Admin</nav>; });
jest.mock('@/components/ConfiguracaoLojaEntregaForm', () => function Form() { return <form>Configuração de entrega</form>; });

const cookieMock = cookies as jest.Mock;
const redirectMock = jest.mocked(redirect);

beforeEach(() => {
  cookieMock.mockReset();
  redirectMock.mockReset();
  redirectMock.mockImplementation(() => { throw new Error('redirect'); });
});

test('sem sessão redireciona antes de renderizar a página', async () => {
  cookieMock.mockResolvedValue({ has: () => false });
  await expect(ConfiguracaoLojaEntregaPage()).rejects.toThrow('redirect');
  expect(redirectMock).toHaveBeenCalledWith('/login');
  expect(screen.queryByText('Configuração de entrega')).not.toBeInTheDocument();
});

test.each(['admin_access', 'admin_refresh'])(
  'sessão com %s renderiza página e formulário', async (name) => {
    cookieMock.mockResolvedValue({ has: (key: string) => key === name });
    render(await ConfiguracaoLojaEntregaPage());
    expect(redirectMock).not.toHaveBeenCalled();
    expect(screen.getByText('Configuração de entrega')).toBeInTheDocument();
  },
);
