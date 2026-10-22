import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminHeader from '@/components/AdminHeader';
import ConfiguracaoLojaEntregaForm from '@/components/ConfiguracaoLojaEntregaForm';

export default async function ConfiguracaoLojaEntregaPage() {
  const jar = await cookies();
  if (!jar.has('admin_access') && !jar.has('admin_refresh')) redirect('/login');
  return <main className="container"><AdminHeader/><ConfiguracaoLojaEntregaForm/></main>;
}
