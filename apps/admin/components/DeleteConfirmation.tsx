'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, AdminApiError } from '@/lib/client/admin-api';
export default function DeleteConfirmation({kind,id,name,lockRef,busy,setBusy}:{kind:'categoria'|'personalizacao';id:string;name:string;lockRef:React.RefObject<boolean>;busy:boolean;setBusy:(value:boolean)=>void}) {
  const router=useRouter();const [open,setOpen]=useState(false);const [typed,setTyped]=useState('');const [message,setMessage]=useState('');
  const trigger=useRef<HTMLButtonElement>(null);const input=useRef<HTMLInputElement>(null);
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const plural=kind==='categoria'?'categorias':'personalizacoes';const label=kind==='categoria'?'categoria':'personalização';
  async function remove() {
    if (lockRef.current || typed!==name) return;
    lockRef.current=true;setBusy(true);setMessage('');
    try { await adminApi(`/api/admin/${plural}/${id}`,{method:'DELETE'});if(mounted.current)router.push(`/${plural}`); }
    catch(e) { const status=e instanceof AdminApiError?e.status:0;
      if(mounted.current)setMessage(status===404?`${kind==='categoria'?'Categoria':'Personalização'} não encontrada.`:status===409?kind==='categoria'?'Categoria em uso por produtos. Remova os vínculos antes de excluir.':'Personalização em uso. Você ainda pode editar a disponibilidade.':status===403?'Acesso negado.':status===400?'Dados inválidos.':e instanceof Error?e.message:'Falha ao excluir.'); }
    finally { lockRef.current=false;if(mounted.current)setBusy(false); }
  }
  function cancel(){setOpen(false);setTyped('');requestAnimationFrame(()=>trigger.current?.focus());}
  return <section className="card danger"><h2>Excluir {label}</h2>{message&&<p className="error" role="alert">{message}</p>}
    {!open?<button ref={trigger} type="button" className="danger-button" disabled={busy} onClick={()=>{setOpen(true);requestAnimationFrame(()=>input.current?.focus());}}>Excluir {label}</button>:<>
      <p>Digite <strong>{name}</strong> para confirmar.</p><label htmlFor={`${plural}-confirm-name`}>Nome da {label}</label>
      <input ref={input} id={`${plural}-confirm-name`} value={typed} onChange={e=>setTyped(e.target.value)} disabled={busy} onKeyDown={e=>{if(e.key==='Escape'&&!busy)cancel();}} />
      <div className="actions"><button type="button" className="danger-button" disabled={busy||typed!==name} onClick={remove}>{busy?'Excluindo...':'Confirmar exclusão'}</button><button type="button" className="secondary" disabled={busy} onClick={cancel}>Cancelar</button></div>
    </>}</section>;
}
