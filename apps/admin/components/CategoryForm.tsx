'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, AdminApiError } from '@/lib/client/admin-api';
import { acquireOperation, releaseOperation } from '@/lib/operation-lock';
import type { Categoria } from '@/lib/contracts';
import { categoryPayload, emptyCategory, CategoryFields, validateCategory } from '@/lib/category-form';
export default function CategoryForm({category,onSaved,lockRef:sharedLockRef,busy:sharedBusy,setBusy:setSharedBusy}:{category?:Categoria;onSaved?:(value:Categoria)=>void;lockRef?:React.RefObject<boolean>;busy?:boolean;setBusy?:(value:boolean)=>void}){
  const router=useRouter();const localLock=useRef(false);const lockRef=sharedLockRef??localLock;const mounted=useRef(true);
  const [value,setValue]=useState<CategoryFields>(category?{nome:category.nome,descricao:category.descricao}:emptyCategory);
  const [errors,setErrors]=useState<Record<string,string>>({});const [message,setMessage]=useState('');const [localBusy,setLocalBusy]=useState(false);const busy=sharedBusy??localBusy;
  const summaryRef=useRef<HTMLParagraphElement>(null);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{if(Object.keys(errors).length)summaryRef.current?.focus();},[errors]);
  async function submit(event:FormEvent){event.preventDefault();if(lockRef.current)return;setMessage('');const next=validateCategory(value);setErrors(next);if(Object.keys(next).length)return;
    const payload=categoryPayload(value,category?{nome:category.nome,descricao:category.descricao}:undefined);
    if(category&&!Object.keys(payload).length){setMessage('Nenhuma alteração para salvar.');return;}
    if (!acquireOperation(lockRef)) return;(setSharedBusy??setLocalBusy)(true);
    try{const saved=await adminApi<Categoria>(category?`/api/admin/categorias/${category.id}`:'/api/admin/categorias',{method:category?'PATCH':'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
      if(mounted.current){if(category){setMessage('Categoria salva.');onSaved?.(saved);}else router.push(`/categorias/${saved.id}`);}
    }catch(e){if(mounted.current){const status=e instanceof AdminApiError?e.status:0;setMessage(status===400?e instanceof AdminApiError&&e.detail?`Dados inválidos: ${e.message}`:'Dados inválidos. Confira os campos.':status===403?'Acesso negado.':status===404?'Categoria não encontrada.':status===409?'Conflito ao salvar categoria.':e instanceof Error?e.message:'Falha ao salvar categoria.');}}
    finally{releaseOperation(lockRef);if(mounted.current)(setSharedBusy??setLocalBusy)(false);}
  }
  return <form className="card form" onSubmit={submit} noValidate aria-busy={busy}><h2>{category?'Editar categoria':'Nova categoria'}</h2>
    {!!Object.keys(errors).length&&<p ref={summaryRef} id="category-errors" className="error" role="alert" tabIndex={-1}>Corrija os campos indicados.</p>}
    {message&&<p role={message.endsWith('salva.')||message.includes('Nenhuma')?'status':'alert'} className={message.endsWith('salva.')?'notice':'error'}>{message}</p>}
    <label htmlFor="category-name">Nome</label><input id="category-name" value={value.nome} onChange={e=>setValue(v=>({...v,nome:e.target.value}))} aria-invalid={!!errors.nome} aria-describedby={errors.nome?'category-name-error':undefined} disabled={busy}/>{errors.nome&&<small className="error" id="category-name-error">{errors.nome}</small>}
    <label htmlFor="category-description">Descrição (opcional)</label><textarea id="category-description" value={value.descricao??''} onChange={e=>setValue(v=>({...v,descricao:e.target.value}))} disabled={busy}/>
    <button disabled={busy}>{busy?'Salvando...':category?'Salvar alterações':'Criar categoria'}</button>
  </form>;
}
