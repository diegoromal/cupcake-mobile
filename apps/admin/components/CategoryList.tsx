'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi, AdminApiError } from '@/lib/client/admin-api';
import type { Categoria } from '@/lib/contracts';
export default function CategoryList(){
  const [items,setItems]=useState<Categoria[]|null>(null);const [error,setError]=useState('');const generation=useRef(0);
  const load=useCallback(async()=>{const current=++generation.current;setItems(null);setError('');try{const data=await adminApi<Categoria[]>('/api/admin/categorias');if(current===generation.current)setItems(data);}catch(e){if(current===generation.current)setError(e instanceof AdminApiError&&e.status===403?'Acesso negado.':e instanceof Error?e.message:'Falha ao carregar categorias.');}},[]);
  useEffect(()=>{void load();const generationRef=generation;return()=>{generationRef.current++;};},[load]);
  return <section><div className="heading"><div><h1>Categorias</h1><p>Organize as categorias da loja.</p></div><Link className="button" href="/categorias/nova">Nova categoria</Link></div>
    {error&&<p className="error" role="alert">{error} <button onClick={load}>Tentar novamente</button></p>}
    {!error&&items===null&&<p role="status">Carregando categorias...</p>}
    {items?.length===0&&<p className="card">Nenhuma categoria cadastrada.</p>}
    {!!items?.length&&<div className="card table-wrap"><table><thead><tr><th>Nome</th><th>Descrição</th><th>Identificador</th><th>Ação</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td>{item.nome}</td><td>{item.descricao||'Não definida'}</td><td>{item.id.slice(0,8)}</td><td><Link href={`/categorias/${item.id}`} aria-label={`Abrir ${item.nome} — ${item.id.slice(0,8)}`}>Abrir {item.nome} — {item.id.slice(0,8)}</Link></td></tr>)}</tbody></table></div>}
  </section>;
}
