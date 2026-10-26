import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminHeader from '@/components/AdminHeader';
import SalesReport from '@/components/SalesReport';

export default async function SalesReportPage() {
  const jar = await cookies();
  if (!jar.has('admin_access') && !jar.has('admin_refresh')) redirect('/login');
  return <main className="container"><AdminHeader /><SalesReport /></main>;
}
