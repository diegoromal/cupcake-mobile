import Link from 'next/link';import AdminHeader from '@/components/AdminHeader';import ProductForm from '@/components/ProductForm';
export default function NewProductPage(){return <main className="container stack"><AdminHeader/><Link href="/produtos">← Produtos</Link><ProductForm/></main>;}
