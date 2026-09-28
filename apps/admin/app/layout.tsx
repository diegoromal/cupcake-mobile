import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title:'Produtos | Cupcake Admin', description:'Administração de produtos' };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>;}
