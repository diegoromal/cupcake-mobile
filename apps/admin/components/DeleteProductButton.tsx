'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, AdminApiError } from '@/lib/client/admin-api';
export default function DeleteProductButton({id,name}:{id:string;name:string}) {
  const router=useRouter();const [confirm,setConfirm]=useState(false);const [typed,setTyped]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  async function remove(){setBusy(true);setMessage('');try{await adminApi(`/api/admin/produtos/${id}`,{method:'DELETE'});router.push('/produtos');}catch(e){const s=e instanceof AdminApiError?e.status:0;setMessage(s===404?'Produto não existe mais.':s===409?'Produto possui vínculos ou estoque que impedem exclusão. Mantenha ou desative o produto.':e instanceof Error?e.message:'Falha ao excluir.');}finally{setBusy(false);}}
  return <section className="card danger"><h2>Excluir produto</h2>{message&&<p role="alert" className="error">{message}</p>}{!confirm?<button className="danger-button" onClick={()=>setConfirm(true)}>Excluir produto</button>:<><p>Digite <strong>{name}</strong> para confirmar.</p><label htmlFor="confirm-name">Nome do produto</label><input id="confirm-name" value={typed} onChange={e=>setTyped(e.target.value)} disabled={busy}/><div className="actions"><button className="danger-button" disabled={typed!==name||busy} onClick={remove}>{busy?'Excluindo...':'Confirmar exclusão'}</button><button className="secondary" disabled={busy} onClick={()=>{setConfirm(false);setTyped('');}}>Cancelar</button></div></>}</section>;
}
