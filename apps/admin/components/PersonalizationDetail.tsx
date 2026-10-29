'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi, AdminApiError } from '@/lib/client/admin-api';
import type { Personalizacao } from '@/lib/contracts';
import PersonalizationForm from './PersonalizationForm';
import DeleteConfirmation from './DeleteConfirmation';
export default function PersonalizationDetail({id}:{id:string}){
  const [item,setItem]=useState<Personalizacao|null>(null);const [error,setError]=useState('');const [operation,setOperation]=useState<'saving'|'deleting'|null>(null);const generation=useRef(0);const lockRef=useRef(false);const busy=operation!==null;
  const load=useCallback(async()=>{const current=++generation.current;setItem(null);setError('');try{const data=await adminApi<Personalizacao>(`/api/admin/personalizacoes/${id}`);if(current===generation.current)setItem(data);}catch(e){if(current===generation.current){const status=e instanceof AdminApiError?e.status:0;setError(status===404?'Personalização não encontrada.':status===403?'Acesso permitido somente a administradores.':e instanceof Error?e.message:'Falha ao carregar personalização.');}}},[id]);
  useEffect(()=>{void load();const generationRef=generation;return()=>{generationRef.current++;};},[load]);
  if(!item||item.id!==id)return <section><h1>Personalização</h1>{error?<p role="alert" className="error">{error} <button onClick={load}>Tentar novamente</button></p>:<p role="status">Carregando personalização...</p>}</section>;
  return <div className="stack"><div className="page-intro"><h1>{item.nome}</h1><p>Consulte, edite ou exclua esta opção de personalização.</p></div><PersonalizationForm key={item.id} personalization={item} onSaved={setItem} lockRef={lockRef} busy={busy} saving={operation==='saving'} setBusy={value=>setOperation(value?'saving':null)}/><DeleteConfirmation kind="personalizacao" id={item.id} name={item.nome} lockRef={lockRef} busy={busy} deleting={operation==='deleting'} setBusy={value=>setOperation(value?'deleting':null)}/></div>;
}
