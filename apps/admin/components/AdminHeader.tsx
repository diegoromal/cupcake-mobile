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
      <span className="nav-unavailable" aria-disabled="true">Pedidos <small>Em breve</small></span>
      {([['/produtos','Produtos / Cardápio'],['/categorias','Categorias'],['/personalizacoes','Personalizações']] as const).map(([href,label])=><Link key={href} href={href} aria-current={pathname===href||pathname.startsWith(`${href}/`)?'page':undefined}>{label}</Link>)}
      <span className="nav-unavailable" aria-disabled="true">Relatório de Vendas <small>Em breve</small></span>
    </nav>
    <div className="sidebar-footer"><span className="admin-identity">Admin</span><LogoutButton/></div>
  </aside>;
}
