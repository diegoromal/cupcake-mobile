'use client';
import { useEffect, useState } from 'react';
import { adminApi, AdminApiError } from '@/lib/client/admin-api';
export default function ProductImage({id, image, onChange}:{id:string;image:string|null;onChange:(image:string|null)=>void}) {
  const [file,setFile] = useState<File|null>(null); const [preview,setPreview] = useState(''); const [busy,setBusy] = useState(false); const [message,setMessage] = useState('');
  useEffect(() => { if (!file) { setPreview(''); return; } const url=URL.createObjectURL(file); setPreview(url); return ()=>URL.revokeObjectURL(url); },[file]);
  function select(next:File|null) { setMessage(''); if (!next) {setFile(null);return;} if (!['image/jpeg','image/png','image/webp'].includes(next.type)) {setFile(null);setMessage('Use JPEG, PNG ou WebP.');return;} if (next.size>10*1024*1024) {setFile(null);setMessage('Imagem deve ter até 10 MiB.');return;} setFile(next); }
  function failure(error:unknown) { const status=error instanceof AdminApiError?error.status:0; setMessage(({400:'Imagem inválida.',404:'Produto não encontrado.',409:'Imagem alterada por outra operação. Recarregue e tente novamente.',413:'Imagem excede o limite.',503:'Armazenamento indisponível.'} as Record<number,string>)[status] ?? (error instanceof Error?error.message:'Falha na imagem.')); }
  async function upload() { if (!file) return; setBusy(true);setMessage('Enviando...'); const body=new FormData();body.append('imagem',file,file.name); try {const result=await adminApi<{id:string;imagem:string}>(`/api/admin/produtos/${id}/imagem`,{method:'POST',body});onChange(result.imagem);setMessage('Imagem enviada.');} catch(e){failure(e);} finally{setBusy(false);} }
  async function remove() {setBusy(true);setMessage('');try{await adminApi(`/api/admin/produtos/${id}/imagem`,{method:'DELETE'});onChange(null);setFile(null);setMessage('Imagem removida.');}catch(e){failure(e);}finally{setBusy(false);}}
  return <section className="card"><h2>Imagem</h2><p>{image?'Com imagem':'Sem imagem'}</p><p>A prévia local mostra somente o arquivo selecionado nesta sessão.</p>
    <label htmlFor="imagem">Selecionar imagem (JPEG, PNG ou WebP, até 10 MiB)</label><input id="imagem" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>select(e.target.files?.[0]??null)} disabled={busy}/>
    {/* A prévia blob é local e não passa pelo otimizador de imagens. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {preview && <img className="preview" src={preview} alt="Prévia local da imagem selecionada" />}
    <div className="actions"><button onClick={upload} disabled={!file||busy}>{busy?'Enviando...':image?'Substituir imagem':'Enviar imagem'}</button><button className="secondary" onClick={remove} disabled={!image||busy}>Remover imagem</button></div>
    {message && <p role="status" className="notice">{message}</p>}
  </section>;
}
