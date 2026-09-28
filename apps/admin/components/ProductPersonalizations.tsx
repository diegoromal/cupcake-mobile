'use client';
import { useCallback, useEffect, useState } from 'react';
import { adminApi, AdminApiError } from '@/lib/client/admin-api';
import type { Personalizacao } from '@/lib/contracts';
export default function ProductPersonalizations({id}:{id:string}) {
  const [all,setAll]=useState<Personalizacao[]|null>(null);const [linked,setLinked]=useState<Personalizacao[]|null>(null);const [selected,setSelected]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  const load=useCallback(async()=>{setMessage('');try {const [a,l]=await Promise.all([adminApi<Personalizacao[]>('/api/admin/personalizacoes'),adminApi<Personalizacao[]>(`/api/admin/produtos/${id}/personalizacoes`)]);setAll(a);setLinked(l);}catch(e){setMessage(e instanceof Error?e.message:'Falha ao carregar personalizações.');}},[id]);
  useEffect(()=>{void load();},[load]);
  function error(e:unknown){const status=e instanceof AdminApiError?e.status:0;setMessage(status===404?'Produto, personalização ou vínculo não encontrado.':status===409?'Personalização já vinculada ou conflito de alteração.':e instanceof Error?e.message:'Falha na operação.');}
  async function link(){if(!selected)return;setBusy(true);setMessage('');try{await adminApi(`/api/admin/produtos/${id}/personalizacoes`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({personalizacaoId:selected})});setSelected('');await load();setMessage('Personalização vinculada.');}catch(e){error(e);}finally{setBusy(false);}}
  async function unlink(pid:string){setBusy(true);setMessage('');try{await adminApi(`/api/admin/produtos/${id}/personalizacoes/${pid}`,{method:'DELETE'});await load();setMessage('Personalização desvinculada.');}catch(e){error(e);}finally{setBusy(false);}}
  const choices=all?.filter(p=>!linked?.some(l=>l.id===p.id))??[];
  return <section className="card"><h2>Personalizações</h2>{(!all||!linked)&&!message&&<p role="status">Carregando personalizações...</p>}{message&&<p className="notice" role="status">{message}</p>}{(!all||!linked)&&<button onClick={load}>Tentar novamente</button>}
    {linked?.length===0&&<p>Nenhuma personalização vinculada.</p>}
    {!!linked?.length&&<ul className="linked">{linked.map(p=><li key={p.id}><span><strong>{p.nome}</strong> · {p.disponibilidade?'Disponível':'Indisponível'} · Ajuste R$ {p.ajusteValor??'0.00'}</span><button className="secondary" disabled={busy} onClick={()=>unlink(p.id)} aria-label={`Desvincular ${p.nome}`}>Desvincular</button></li>)}</ul>}
    <label htmlFor="personalizacao">Vincular personalização</label><select id="personalizacao" value={selected} onChange={e=>setSelected(e.target.value)} disabled={busy||!all}><option value="">Selecione</option>{choices.map(p=><option key={p.id} value={p.id}>{p.nome} — {p.disponibilidade?'Disponível':'Indisponível'} — R$ {p.ajusteValor??'0.00'}</option>)}</select><button onClick={link} disabled={!selected||busy}>Vincular</button>
  </section>;
}
