import Link from 'next/link';import LogoutButton from '@/components/LogoutButton';import ProductList from '@/components/ProductList';
export default function ProductsPage(){return <main className="container"><header className="top"><Link href="/produtos" className="brand">Cupcake Admin</Link><LogoutButton/></header><ProductList/></main>;}
