'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/client/admin-api';
export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  async function logout() {
    if (submitting.current) return;
    submitting.current = true;
    setError(''); setBusy(true);
    try { await adminApi('/api/session/logout', { method: 'POST' }); router.push('/login'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível sair.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <>
    <button className="secondary" disabled={busy} onClick={logout}>{busy ? 'Saindo...' : 'Sair'}</button>
    {error && <p className="error" role="alert">{error}</p>}
  </>;
}
