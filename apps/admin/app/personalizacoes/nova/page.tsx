import Link from 'next/link';import AdminHeader from '@/components/AdminHeader';import PersonalizationForm from '@/components/PersonalizationForm';
export default function NewPersonalizationPage(){return <main className="container stack"><AdminHeader/><Link href="/personalizacoes">← Personalizações</Link><PersonalizationForm/></main>;}
