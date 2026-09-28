'use client';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, AdminApiError } from '@/lib/client/admin-api';
import type { Categoria, Produto } from '@/lib/contracts';
import { emptyProduct, productPayload, ProductFields, validateProduct } from '@/lib/product-form';
export default function ProductForm({ product, onSaved }: { product?: Produto; onSaved?: (product: Produto)=>void }) {
  const router = useRouter();
  const [value,setValue] = useState<ProductFields>(product ? {categoriaId:product.categoriaId,nome:product.nome,descricao:product.descricao,precoAtual:product.precoAtual,ativo:product.ativo} : emptyProduct);
  const [categories,setCategories] = useState<Categoria[]|null>(null); const [categoryError,setCategoryError] = useState('');
  const [errors,setErrors] = useState<Record<string,string>>({}); const [message,setMessage] = useState(''); const [busy,setBusy] = useState(false);
  async function loadCategories() { setCategoryError(''); try { setCategories(await adminApi<Categoria[]>('/api/admin/categorias')); } catch { setCategoryError('Não foi possível carregar categorias.'); } }
  useEffect(() => { void loadCategories(); }, []);
  function change<K extends keyof ProductFields>(key:K, data:ProductFields[K]) { setValue(v=>({...v,[key]:data})); }
  async function submit(event:FormEvent) {
    event.preventDefault(); setMessage('');
    const nextErrors = validateProduct(value,categories?.map(c=>c.id) ?? []); setErrors(nextErrors);
    if (Object.keys(nextErrors).length) { document.getElementById('form-errors')?.focus(); return; }
    const original = product ? {categoriaId:product.categoriaId,nome:product.nome,descricao:product.descricao,precoAtual:product.precoAtual,ativo:product.ativo} : undefined;
    const payload = productPayload(value,original);
    if (product && !Object.keys(payload).length) { setMessage('Nenhuma alteração para salvar.'); return; }
    setBusy(true);
    try { const saved = await adminApi<Produto>(product ? `/api/admin/produtos/${product.id}` : '/api/admin/produtos', {method: product?'PATCH':'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
      if (product) { setMessage('Produto salvo.'); onSaved?.(saved); } else router.push(`/produtos/${saved.id}`);
    } catch(e) { const status = e instanceof AdminApiError ? e.status : 0; if (status===404) void loadCategories(); setMessage(status===404 ? 'Produto ou categoria não encontrado. Escolha uma categoria disponível e tente novamente.' : status===409 ? 'Conflito ao salvar. Atualize os dados e tente novamente.' : e instanceof Error ? e.message : 'Falha ao salvar.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="card form" noValidate aria-busy={busy}>
    <h2>{product?'Editar produto':'Novo produto'}</h2>
    {!!Object.keys(errors).length && <p id="form-errors" className="error" role="alert" tabIndex={-1}>Corrija os campos indicados.</p>}
    {message && <p role="status" className="notice">{message}</p>}
    <label htmlFor="categoria">Categoria</label>
    {categories===null && !categoryError && <p role="status">Carregando categorias...</p>}
    {categoryError && <p className="error" role="alert">{categoryError} <button type="button" onClick={loadCategories}>Tentar novamente</button></p>}
    {product && categories && !categories.some(c=>c.id===product.categoriaId) && <p className="error" role="alert">A categoria deste produto não está mais disponível. Escolha outra categoria antes de salvar.</p>}
    <select id="categoria" value={value.categoriaId} onChange={e=>change('categoriaId',e.target.value)} aria-describedby={errors.categoriaId?'categoria-error':undefined} disabled={busy||!categories}><option value="">Selecione</option>{categories?.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select>{errors.categoriaId && <small id="categoria-error" className="error">{errors.categoriaId}</small>}
    <label htmlFor="nome">Nome</label><input id="nome" value={value.nome} onChange={e=>change('nome',e.target.value)} aria-describedby={errors.nome?'nome-error':undefined} disabled={busy}/>{errors.nome && <small id="nome-error" className="error">{errors.nome}</small>}
    <label htmlFor="descricao">Descrição</label><textarea id="descricao" value={value.descricao??''} onChange={e=>change('descricao',e.target.value)} disabled={busy}/>
    <label htmlFor="preco">Preço atual (R$)</label><input id="preco" inputMode="decimal" placeholder="0.00" value={value.precoAtual} onChange={e=>change('precoAtual',e.target.value)} aria-describedby={errors.precoAtual?'preco-error':undefined} disabled={busy}/>{errors.precoAtual && <small id="preco-error" className="error">{errors.precoAtual}</small>}
    <label className="check"><input type="checkbox" checked={value.ativo} onChange={e=>change('ativo',e.target.checked)} disabled={busy}/> Ativo</label>
    <button disabled={busy||!categories}>{busy?'Salvando...':product?'Salvar alterações':'Criar produto'}</button>
  </form>;
}
