'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, AdminApiError } from '@/lib/client/admin-api';
import { acquireOperation, releaseOperation } from '@/lib/operation-lock';
import type { Personalizacao } from '@/lib/contracts';
import { emptyPersonalization, personalizationPayload, PersonalizationFields, validatePersonalization } from '@/lib/personalization-form';
export default function PersonalizationForm({personalization,onSaved,lockRef:sharedLockRef,busy:sharedBusy,setBusy:setSharedBusy}:{personalization?:Personalizacao;onSaved?:(value:Personalizacao)=>void;lockRef?:React.RefObject<boolean>;busy?:boolean;setBusy?:(value:boolean)=>void}){
  const router=useRouter();const localLock=useRef(false);const lockRef=sharedLockRef??localLock;const mounted=useRef(true);
  const [value,setValue]=useState<PersonalizationFields>(personalization?{nome:personalization.nome,descricao:personalization.descricao,disponibilidade:personalization.disponibilidade,ajusteValor:personalization.ajusteValor}:emptyPersonalization);
  const [baseline,setBaseline]=useState<PersonalizationFields|undefined>(personalization?{nome:personalization.nome,descricao:personalization.descricao,disponibilidade:personalization.disponibilidade,ajusteValor:personalization.ajusteValor}:undefined);
  const [errors,setErrors]=useState<Record<string,string>>({});const [message,setMessage]=useState('');const [localBusy,setLocalBusy]=useState(false);const busy=sharedBusy??localBusy;
  const summaryRef=useRef<HTMLParagraphElement>(null);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{if(Object.keys(errors).length)summaryRef.current?.focus();},[errors]);
  async function submit(event:FormEvent){event.preventDefault();if(lockRef.current)return;setMessage('');const next=validatePersonalization(value);setErrors(next);if(Object.keys(next).length)return;
    const payload=personalizationPayload(value,baseline);
    if(personalization&&!Object.keys(payload).length){setMessage('Nenhuma alteração para salvar.');return;}
    if (!acquireOperation(lockRef)) return;(setSharedBusy??setLocalBusy)(true);
    try{const saved=await adminApi<Personalizacao>(personalization?`/api/admin/personalizacoes/${personalization.id}`:'/api/admin/personalizacoes',{method:personalization?'PATCH':'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
      if(mounted.current){const confirmed={nome:saved.nome,descricao:saved.descricao,disponibilidade:saved.disponibilidade,ajusteValor:saved.ajusteValor};setBaseline(confirmed);setValue(confirmed);if(personalization){setMessage('Personalização salva.');onSaved?.(saved);}else router.push(`/personalizacoes/${saved.id}`);}
    }catch(e){if(mounted.current){const status=e instanceof AdminApiError?e.status:0;setMessage(status===400?e instanceof AdminApiError&&e.detail?`Dados inválidos: ${e.message}`:'Dados inválidos. Confira os campos.':status===403?'Acesso negado.':status===404?'Personalização não encontrada.':status===409?'Conflito ao salvar personalização.':e instanceof Error?e.message:'Falha ao salvar personalização.');}}
    finally{releaseOperation(lockRef);if(mounted.current)(setSharedBusy??setLocalBusy)(false);}
  }
  return <form className="card form" onSubmit={submit} noValidate aria-busy={busy}><h2>{personalization?'Editar personalização':'Nova personalização'}</h2>
    {!!Object.keys(errors).length&&<p ref={summaryRef} id="personalization-errors" className="error" role="alert" tabIndex={-1}>Corrija os campos indicados.</p>}
    {message&&<p role={message.endsWith('salva.')||message.includes('Nenhuma')?'status':'alert'} className={message.endsWith('salva.')?'notice':'error'}>{message}</p>}
    <label htmlFor="personalization-name">Nome</label><input id="personalization-name" value={value.nome} onChange={e=>setValue(v=>({...v,nome:e.target.value}))} aria-invalid={!!errors.nome} aria-describedby={errors.nome?'personalization-name-error':undefined} disabled={busy}/>{errors.nome&&<small className="error" id="personalization-name-error">{errors.nome}</small>}
    <label htmlFor="personalization-description">Descrição (opcional)</label><textarea id="personalization-description" value={value.descricao??''} onChange={e=>setValue(v=>({...v,descricao:e.target.value}))} disabled={busy}/>
    <label className="check"><input type="checkbox" checked={value.disponibilidade} onChange={e=>setValue(v=>({...v,disponibilidade:e.target.checked}))} disabled={busy}/> Disponível</label>
    <label htmlFor="personalization-adjustment">Ajuste de valor (R$)</label><input id="personalization-adjustment" inputMode="decimal" placeholder="0.00" value={value.ajusteValor??''} onChange={e=>setValue(v=>({...v,ajusteValor:e.target.value}))} aria-invalid={!!errors.ajusteValor} aria-describedby={errors.ajusteValor?'personalization-adjustment-error':'personalization-adjustment-help'} disabled={busy}/><small id="personalization-adjustment-help">Use ponto decimal. Deixe vazio para não definir.</small>{errors.ajusteValor&&<small className="error" id="personalization-adjustment-error">{errors.ajusteValor}</small>}
    <button disabled={busy}>{busy?'Salvando...':personalization?'Salvar alterações':'Criar personalização'}</button>
  </form>;
}
