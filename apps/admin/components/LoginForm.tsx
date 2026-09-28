'use client';
import { FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/client/admin-api';
export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState(''); const [senha, setSenha] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError(''); setBusy(true);
    try { await adminApi('/api/session/login', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({email,senha}) }); router.replace('/produtos'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível entrar.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <form onSubmit={submit} className="card form" aria-busy={busy}>
    <h1>Administração</h1><p>Acesse com sua conta de administrador.</p>
    {error && <p className="error" role="alert" tabIndex={-1} ref={node => node?.focus()}>{error}</p>}
    <label htmlFor="email">E-mail</label><input id="email" type="email" autoComplete="username" required disabled={busy} value={email} onChange={e=>setEmail(e.target.value)} />
    <label htmlFor="senha">Senha</label><input id="senha" type="password" autoComplete="current-password" required disabled={busy} value={senha} onChange={e=>setSenha(e.target.value)} />
    <button disabled={busy}>{busy ? 'Entrando...' : 'Entrar'}</button>
  </form>;
}
