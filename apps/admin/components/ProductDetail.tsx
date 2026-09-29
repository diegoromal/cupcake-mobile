'use client';
import { useCallback, useEffect, useState } from 'react';
import { adminApi, AdminApiError } from '@/lib/client/admin-api';
import type { Produto } from '@/lib/contracts';
import ProductForm from './ProductForm';import ProductImage from './ProductImage';import ProductPersonalizations from './ProductPersonalizations';import ProductStock from './ProductStock';import DeleteProductButton from './DeleteProductButton';
export default function ProductDetail({id}:{id:string}) {
  const [product,setProduct]=useState<Produto|null>(null);const [message,setMessage]=useState('');
  const load=useCallback(async()=>{setMessage('');try{setProduct(await adminApi<Produto>(`/api/admin/produtos/${id}`));}catch(e){setMessage(e instanceof AdminApiError&&e.status===404?'Produto não encontrado.':e instanceof Error?e.message:'Falha ao carregar produto.');}},[id]);
  useEffect(()=>{void load();},[load]);
  if(!product)return <section><h1>Produto</h1>{message?<p role="alert" className="error">{message} <button onClick={load}>Tentar novamente</button></p>:<p role="status">Carregando produto...</p>}</section>;
  return <div className="stack"><h1>{product.nome}</h1><ProductForm product={product} onSaved={setProduct}/><ProductImage id={id} image={product.imagem} onChange={imagem=>setProduct(p=>p?{...p,imagem}:p)}/><ProductPersonalizations id={id}/><ProductStock id={id}/><DeleteProductButton id={id} name={product.nome}/></div>;
}
