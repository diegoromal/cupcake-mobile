import Link from 'next/link';import AdminHeader from '@/components/AdminHeader';import ProductForm from '@/components/ProductForm';
export default function NewProductPage(){return <main className="container stack"><AdminHeader/><Link href="/produtos">← Produtos</Link><div className="page-intro"><h1>Novo produto</h1><p>Cadastre um novo produto no catálogo.</p></div><ProductForm/></main>;}
