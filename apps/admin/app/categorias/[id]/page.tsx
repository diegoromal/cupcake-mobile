import Link from 'next/link';import AdminHeader from '@/components/AdminHeader';import CategoryDetail from '@/components/CategoryDetail';
export default async function CategoryPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <main className="container stack"><AdminHeader/><Link href="/categorias">← Categorias</Link><CategoryDetail key={id} id={id}/></main>;}
