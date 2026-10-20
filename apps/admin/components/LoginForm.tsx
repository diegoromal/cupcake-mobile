'use client';
import { FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/client/admin-api';
export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState(''); const [senha, setSenha] = useState('');
  const [showPassword,setShowPassword] = useState(false);
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
    <h1>Entrar</h1><p>Acesse sua conta administrativa.</p>
    {error && <p id="login-error" className="error" role="alert" tabIndex={-1} ref={node => node?.focus()}>{error}</p>}
    <label htmlFor="email">E-mail</label><input id="email" type="email" autoComplete="username" required aria-describedby={error?'login-error':undefined} disabled={busy} value={email} onChange={e=>setEmail(e.target.value)} />
    <label htmlFor="senha">Senha</label><div className="password-field"><input id="senha" type={showPassword?'text':'password'} autoComplete="current-password" required aria-describedby={error?'login-error':undefined} disabled={busy} value={senha} onChange={e=>setSenha(e.target.value)} /><button type="button" aria-label={showPassword?'Ocultar senha':'Mostrar senha'} aria-pressed={showPassword} disabled={busy} onClick={()=>setShowPassword(value=>!value)}>{showPassword?'Ocultar':'Mostrar'}</button></div>
    <button disabled={busy||!email.trim()||!senha}>{busy ? 'Entrando...' : 'Entrar'}</button>
  </form>;
}
