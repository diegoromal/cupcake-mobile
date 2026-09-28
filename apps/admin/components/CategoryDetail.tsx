'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi, AdminApiError } from '@/lib/client/admin-api';
import type { Categoria } from '@/lib/contracts';
import CategoryForm from './CategoryForm';
import DeleteConfirmation from './DeleteConfirmation';
export default function CategoryDetail({id}:{id:string}){
  const [item,setItem]=useState<Categoria|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const generation=useRef(0);const lockRef=useRef(false);
  const load=useCallback(async()=>{const current=++generation.current;setItem(null);setError('');try{const data=await adminApi<Categoria>(`/api/admin/categorias/${id}`);if(current===generation.current)setItem(data);}catch(e){if(current===generation.current){const status=e instanceof AdminApiError?e.status:0;setError(status===404?'Categoria não encontrada.':status===403?'Acesso negado.':e instanceof Error?e.message:'Falha ao carregar categoria.');}}},[id]);
  useEffect(()=>{void load();const generationRef=generation;return()=>{generationRef.current++;};},[load]);
  if(!item||item.id!==id)return <section><h1>Categoria</h1>{error?<p role="alert" className="error">{error} <button onClick={load}>Tentar novamente</button></p>:<p role="status">Carregando categoria...</p>}</section>;
  return <div className="stack"><h1>{item.nome}</h1><CategoryForm key={item.id} category={item} onSaved={setItem} lockRef={lockRef} busy={busy} setBusy={setBusy}/><DeleteConfirmation kind="categoria" id={item.id} name={item.nome} lockRef={lockRef} busy={busy} setBusy={setBusy}/></div>;
}
