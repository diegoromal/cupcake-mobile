import { NextRequest, NextResponse } from 'next/server';
import { apiBase, sameOrigin, setSession } from '@/lib/server/api-proxy';
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ message: 'Origem não permitida.' }, { status: 403 });
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ message: 'Dados inválidos.' }, { status: 400 }); }
  if (typeof input !== 'object' || input === null || !('email' in input) || !('senha' in input) || typeof input.email !== 'string' || typeof input.senha !== 'string') return NextResponse.json({ message: 'Dados inválidos.' }, { status: 400 });
  try {
    const login = await fetch(`${apiBase()}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: input.email, senha: input.senha }), cache: 'no-store' });
    if (!login.ok) return NextResponse.json({ message: 'Credenciais inválidas ou acesso indisponível.' }, { status: login.status === 401 ? 401 : 502 });
    const tokens: unknown = await login.json();
    if (typeof tokens !== 'object' || tokens === null || !('accessToken' in tokens) || !('refreshToken' in tokens) || typeof tokens.accessToken !== 'string' || typeof tokens.refreshToken !== 'string') throw new Error('Resposta inválida');
    const verified = await fetch(`${apiBase()}/admin/produtos`, { headers: { authorization: `Bearer ${tokens.accessToken}` }, cache: 'no-store' });
    if (verified.status === 403) return NextResponse.json({ message: 'Acesso permitido somente a administradores.' }, { status: 403 });
    if (!verified.ok) return NextResponse.json({ message: 'Não foi possível confirmar o acesso administrativo.' }, { status: 502 });
    const response = NextResponse.json({ ok: true });
    setSession(response, tokens.accessToken, tokens.refreshToken);
    return response;
  } catch { return NextResponse.json({ message: 'API indisponível.' }, { status: 502 }); }
}
