'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, AdminApiError } from '@/lib/client/admin-api';
export default function DeleteProductButton({id,name}:{id:string;name:string}) {
  const router=useRouter();const [confirm,setConfirm]=useState(false);const [typed,setTyped]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  const trigger=useRef<HTMLButtonElement>(null);const input=useRef<HTMLInputElement>(null);const lock=useRef(false);
  async function remove(){if(lock.current||typed!==name)return;lock.current=true;setBusy(true);setMessage('');try{await adminApi(`/api/admin/produtos/${id}`,{method:'DELETE'});router.push('/produtos');}catch(e){const s=e instanceof AdminApiError?e.status:0;setMessage(s===404?'Produto não existe mais.':s===409?'Produto possui vínculos ou estoque que impedem exclusão. Mantenha ou desative o produto.':e instanceof Error?e.message:'Falha ao excluir.');}finally{lock.current=false;setBusy(false);}}
  function cancel(){setConfirm(false);setTyped('');requestAnimationFrame(()=>trigger.current?.focus());}
  return <section className="card danger"><h2>Excluir produto</h2><p>A exclusão é permanente e exige confirmação.</p>{message&&<p role="alert" className="error">{message}</p>}{!confirm?<button ref={trigger} type="button" className="danger-button" onClick={()=>{setConfirm(true);requestAnimationFrame(()=>input.current?.focus());}}>Excluir produto</button>:<><p>Digite <strong>{name}</strong> para confirmar.</p><label htmlFor="confirm-name">Nome do produto</label><input ref={input} id="confirm-name" value={typed} onChange={e=>setTyped(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'&&!busy)cancel();}} disabled={busy}/><div className="actions"><button type="button" className="danger-button" disabled={typed!==name||busy} onClick={remove}>{busy?'Excluindo...':'Confirmar exclusão'}</button><button type="button" className="secondary" disabled={busy} onClick={cancel}>Cancelar</button></div></>}</section>;
}
