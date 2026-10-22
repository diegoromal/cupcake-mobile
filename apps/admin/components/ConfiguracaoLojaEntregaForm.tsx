'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi, AdminApiError } from '@/lib/client/admin-api';
import type { ConfiguracaoLojaEntrega } from '@/lib/contracts';

const path = '/api/admin/configuracao-loja-entrega';
const empty: ConfiguracaoLojaEntrega = { latitudeLoja:'', longitudeLoja:'', raioMaximoAtendimento:'', taxaBase:'', valorPorQuilometro:'' };
const labels: Record<keyof ConfiguracaoLojaEntrega,string> = {
  latitudeLoja:'Latitude da loja', longitudeLoja:'Longitude da loja', raioMaximoAtendimento:'Raio máximo (km)',
  taxaBase:'Taxa base (R$)', valorPorQuilometro:'Valor por km (R$)',
};

function valid(value: ConfiguracaoLojaEntrega): boolean {
  const decimal = (text: string, scale: number, digits: number) => new RegExp(`^\\d{1,${digits}}(?:\\.\\d{1,${scale}})?$`).test(text);
  const coordinate = (text: string, max: number) => /^-?\d{1,3}(?:\.\d{1,6})?$/.test(text) && Number(text) >= -max && Number(text) <= max;
  return coordinate(value.latitudeLoja,90) && coordinate(value.longitudeLoja,180) &&
    decimal(value.raioMaximoAtendimento,3,7) && decimal(value.taxaBase,2,10) && decimal(value.valorPorQuilometro,2,10);
}

function isConfiguration(value: unknown): value is ConfiguracaoLojaEntrega {
  return typeof value === 'object' && value !== null &&
    (Object.keys(labels) as Array<keyof ConfiguracaoLojaEntrega>).every(key => typeof (value as Record<string,unknown>)[key] === 'string');
}

export default function ConfiguracaoLojaEntregaForm() {
  const [value,setValue] = useState<ConfiguracaoLojaEntrega>(empty);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const [exists,setExists] = useState(false);
  const mounted = useRef(true);
  const lock = useRef(false);
  const load = useCallback(async () => {
    setLoading(true); setMessage('');
    try { const result=await adminApi<unknown>(path); if(!isConfiguration(result)) throw new Error('Resposta inválida da API.'); if(mounted.current){setValue(result);setExists(true);} }
    catch(error) { if(mounted.current) { if(error instanceof AdminApiError && error.status===404){setValue(empty);setExists(false);}else setMessage(error instanceof Error?error.message:'Falha ao consultar configuração.'); } }
    finally { if(mounted.current) setLoading(false); }
  },[]);
  useEffect(()=>{mounted.current=true;void load();return ()=>{mounted.current=false;};},[load]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(lock.current) return;
    if(!valid(value)){setMessage('Confira os valores e a precisão de cada campo.');document.getElementById('config-error')?.focus();return;}
    lock.current=true;setBusy(true);setMessage('');
    try { const saved=await adminApi<unknown>(path,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(value)});if(!isConfiguration(saved)) throw new Error('Resposta inválida da API.');if(mounted.current){setValue(saved);setExists(true);setMessage('Configuração salva.');} }
    catch(error){if(mounted.current)setMessage(error instanceof Error?error.message:'Falha ao salvar configuração.');}
    finally {lock.current=false;if(mounted.current)setBusy(false);}
  }
  return <section className="card"><h1>Configuração de entrega</h1>
    {loading?<p role="status">Carregando configuração…</p>:<form onSubmit={save} className="form" aria-busy={busy} noValidate>
      {!exists&&<p role="status">Nenhuma configuração cadastrada.</p>}
      {message&&<p id="config-error" tabIndex={-1} role={message.endsWith('salva.')?'status':'alert'} className={message.endsWith('salva.')?'notice':'error'}>{message}</p>}
      {(Object.keys(labels) as Array<keyof ConfiguracaoLojaEntrega>).map(key=><div key={key}>
        <label htmlFor={key}>{labels[key]}</label>
        <input id={key} inputMode="decimal" value={value[key]} disabled={busy} onChange={event=>setValue(current=>({...current,[key]:event.target.value}))}/>
      </div>)}
      <div className="form-actions"><button type="submit" disabled={busy}>{busy?'Salvando…':'Salvar configuração'}</button><button type="button" className="secondary" disabled={busy} onClick={()=>void load()}>Recarregar</button></div>
    </form>}
  </section>;
}
