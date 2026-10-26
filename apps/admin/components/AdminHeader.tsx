'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from './LogoutButton';
export default function AdminHeader() {
  const pathname = usePathname();
  return <aside className="top" aria-label="Painel operacional">
    <div className="sidebar-brand"><Link href="/produtos" className="brand">Cupcake Mobile</Link><span>PAINEL OPERACIONAL</span></div>
    <nav aria-label="Administração" className="admin-nav">
      <span className="nav-caption">GESTÃO DA LOJA</span>
      <Link href="/pedidos" aria-current={pathname==='/pedidos'||pathname.startsWith('/pedidos/')?'page':undefined}>Pedidos</Link>
      {([['/produtos','Produtos / Cardápio'],['/categorias','Categorias'],['/personalizacoes','Personalizações']] as const).map(([href,label])=><Link key={href} href={href} aria-current={pathname===href||pathname.startsWith(`${href}/`)?'page':undefined}>{label}</Link>)}
      <Link href="/configuracao-loja-entrega" aria-current={pathname==='/configuracao-loja-entrega'?'page':undefined}>Configuração de entrega</Link>
      <Link href="/relatorios/vendas" aria-current={pathname.startsWith('/relatorios/vendas')?'page':undefined}>Relatório de Vendas</Link>
    </nav>
    <div className="sidebar-footer"><span className="admin-identity">Admin</span><LogoutButton/></div>
  </aside>;
}
