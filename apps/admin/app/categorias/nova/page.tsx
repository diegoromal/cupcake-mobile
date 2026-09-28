import Link from 'next/link';import AdminHeader from '@/components/AdminHeader';import CategoryForm from '@/components/CategoryForm';
export default function NewCategoryPage(){return <main className="container stack"><AdminHeader/><Link href="/categorias">← Categorias</Link><CategoryForm/></main>;}
