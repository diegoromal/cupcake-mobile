'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi, AdminApiError } from '@/lib/client/admin-api';
import type { Personalizacao } from '@/lib/contracts';
import { displayAdjustment } from '@/lib/personalization-form';
export default function PersonalizationList(){
  const [items,setItems]=useState<Personalizacao[]|null>(null);const [error,setError]=useState('');const generation=useRef(0);
  const load=useCallback(async()=>{const current=++generation.current;setItems(null);setError('');try{const data=await adminApi<Personalizacao[]>('/api/admin/personalizacoes');if(current===generation.current)setItems(data);}catch(e){if(current===generation.current)setError(e instanceof AdminApiError&&e.status===403?'Acesso negado.':e instanceof Error?e.message:'Falha ao carregar personalizações.');}},[]);
  useEffect(()=>{void load();const generationRef=generation;return()=>{generationRef.current++;};},[load]);
  return <section><div className="heading"><div><h1>Personalizações</h1><p>Consulte e gerencie as opções de personalização oferecidas aos clientes.</p></div><Link className="button" href="/personalizacoes/nova">+ Nova personalização</Link></div>
    {error&&<p className="error" role="alert">{error} <button onClick={load}>Tentar novamente</button></p>}
    {!error&&items===null&&<p role="status">Carregando personalizações...</p>}
    {items?.length===0&&<p className="card">Nenhuma personalização cadastrada.</p>}
    {!!items?.length&&<div className="card table-wrap"><table><thead><tr><th>Nome</th><th>Descrição</th><th>Disponibilidade</th><th>Ajuste de valor</th><th>Ação</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td><strong>{item.nome}</strong></td><td>{item.descricao||'Sem descrição'}</td><td><span className={`badge ${item.disponibilidade?'badge-success':'badge-muted'}`}>{item.disponibilidade?'Disponível':'Indisponível'}</span></td><td>{displayAdjustment(item.ajusteValor)}</td><td><Link href={`/personalizacoes/${item.id}`} aria-label={`Ver detalhes de ${item.nome} — ${item.id.slice(0,8)}`}>Ver detalhes →</Link></td></tr>)}</tbody></table></div>}
  </section>;
}
