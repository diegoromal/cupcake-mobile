'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/client/admin-api';
import type { Categoria, Produto } from '@/lib/contracts';
export default function ProductList() {
  const [products,setProducts] = useState<Produto[]|null>(null); const [categories,setCategories] = useState<Categoria[]|null>(null);
  const [error,setError] = useState(''); const [categoryError,setCategoryError] = useState('');
  const loadCategories = useCallback(async () => { setCategoryError(''); try { setCategories(await adminApi<Categoria[]>('/api/admin/categorias')); } catch { setCategoryError('Categorias indisponíveis.'); } }, []);
  const load = useCallback(async () => { setError(''); setProducts(null); try { setProducts(await adminApi<Produto[]>('/api/admin/produtos')); } catch(e) { setError(e instanceof Error ? e.message : 'Falha ao carregar produtos.'); } }, []);
  useEffect(() => { void load(); void loadCategories(); },[load,loadCategories]);
  return <section><div className="heading"><div><h1>Produtos / Cardápio</h1><p>Gerencie os produtos da loja.</p></div><Link className="button" href="/produtos/novo">+ Novo produto</Link></div>
    {error && <div className="error" role="alert">{error} <button onClick={load}>Tentar novamente</button></div>}
    {!error && products === null && <p role="status">Carregando produtos...</p>}
    {products?.length === 0 && <div className="card">Nenhum produto cadastrado.</div>}
    {categoryError && <p className="notice" role="status">{categoryError} <button onClick={loadCategories}>Tentar novamente</button></p>}
    {!!products?.length && <div className="card table-wrap"><table><thead><tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Imagem</th><th>Status</th><th>Ação</th></tr></thead><tbody>{products.map(p=><tr key={p.id}><td><strong>{p.nome}</strong></td><td>{categories ? categories.find(c=>c.id===p.categoriaId)?.nome ?? 'Categoria indisponível' : 'Categoria indisponível'}</td><td>R$ {p.precoAtual.replace('.',',')}</td><td><span className={`badge ${p.imagem?'badge-warning':'badge-muted'}`}>{p.imagem?'Com imagem':'Sem imagem'}</span></td><td><span className={`badge ${p.ativo?'badge-success':'badge-muted'}`}>{p.ativo?'Ativo':'Inativo'}</span></td><td><Link href={`/produtos/${p.id}`}>Ver detalhes →</Link></td></tr>)}</tbody></table></div>}
  </section>;
}
