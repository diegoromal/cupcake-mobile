import Link from 'next/link';import ProductForm from '@/components/ProductForm';
export default function NewProductPage(){return <main className="container stack"><Link href="/produtos">← Produtos</Link><ProductForm/></main>;}
