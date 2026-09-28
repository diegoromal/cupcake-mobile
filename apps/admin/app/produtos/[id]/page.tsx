import Link from 'next/link';import AdminHeader from '@/components/AdminHeader';import ProductDetail from '@/components/ProductDetail';
export default async function ProductPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <main className="container stack"><AdminHeader/><Link href="/produtos">← Produtos</Link><ProductDetail id={id}/></main>;}
