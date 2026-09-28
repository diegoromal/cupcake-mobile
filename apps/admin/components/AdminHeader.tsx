'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from './LogoutButton';
export default function AdminHeader() {
  const pathname = usePathname();
  return <header className="top"><Link href="/produtos" className="brand">Cupcake Admin</Link><nav aria-label="Administração" className="admin-nav">
    {([['/produtos','Produtos'],['/categorias','Categorias'],['/personalizacoes','Personalizações']] as const).map(([href,label])=><Link key={href} href={href} aria-current={pathname===href||pathname.startsWith(`${href}/`)?'page':undefined}>{label}</Link>)}
    <LogoutButton/>
  </nav></header>;
}
