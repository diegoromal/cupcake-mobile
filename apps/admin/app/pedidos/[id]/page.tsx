import Link from 'next/link';
import AdminHeader from '@/components/AdminHeader';
import OrderDetail from '@/components/OrderDetail';

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="container stack">
    <AdminHeader />
    <Link href="/pedidos">← Pedidos</Link>
    <OrderDetail id={id} />
  </main>;
}
