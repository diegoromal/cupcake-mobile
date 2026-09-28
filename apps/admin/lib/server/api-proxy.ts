import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
const ACCESS = 'admin_access';
const REFRESH = 'admin_refresh';
const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// A API limita o arquivo a 10 MiB; o proxy reserva 1 MiB para o envelope multipart.
const MULTIPART_REQUEST_LIMIT = 11 * 1024 * 1024;
export function apiBase(): string {
  const value = process.env.API_BASE_URL;
  if (!value) throw new Error('API_BASE_URL não configurada');
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('API_BASE_URL inválida');
  return url.origin;
}
export function allowed(method: string, parts: string[]): boolean {
  if (parts.length === 1) return ['produtos','categorias','personalizacoes'].includes(parts[0]) && ['GET','POST'].includes(method);
  if (['categorias','personalizacoes'].includes(parts[0])) return parts.length === 2 && uuid.test(parts[1]) && ['GET','PATCH','DELETE'].includes(method);
  if (parts[0] !== 'produtos' || !uuid.test(parts[1])) return false;
  if (parts.length === 2) return ['GET','PATCH','DELETE'].includes(method);
  if (parts.length === 3) return (parts[2] === 'imagem' && ['POST','DELETE'].includes(method)) || (parts[2] === 'personalizacoes' && ['GET','POST'].includes(method));
  return parts.length === 4 && parts[2] === 'personalizacoes' && uuid.test(parts[3]) && method === 'DELETE';
}
export function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  return !!origin && origin === request.nextUrl.origin && request.headers.get('sec-fetch-site') !== 'cross-site';
}
export function setSession(response: NextResponse, access: string, refresh: string): void {
  response.cookies.set(ACCESS, access, { ...cookieOptions, maxAge: 15 * 60 });
  response.cookies.set(REFRESH, refresh, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 });
}
export function clearSession(response: NextResponse): void {
  response.cookies.set(ACCESS, '', { ...cookieOptions, maxAge: 0 });
  response.cookies.set(REFRESH, '', { ...cookieOptions, maxAge: 0 });
}
async function call(path: string, method: string, token: string, body?: ArrayBuffer, contentType?: string): Promise<Response> {
  const headers: Record<string,string> = { authorization: `Bearer ${token}` };
  if (contentType) headers['content-type'] = contentType;
  return fetch(`${apiBase()}${path}`, { method, headers, body, cache: 'no-store' });
}
export async function proxyAdmin(request: NextRequest, parts: string[]): Promise<NextResponse> {
  const method = request.method;
  if (!allowed(method, parts) || request.nextUrl.search) return NextResponse.json({ message: 'Rota não permitida.' }, { status: 404 });
  if (method !== 'GET' && !sameOrigin(request)) return NextResponse.json({ message: 'Origem não permitida.' }, { status: 403 });
  const contentType = request.headers.get('content-type') ?? '';
  const isImage = parts.at(-1) === 'imagem' && method === 'POST';
  if (method !== 'GET' && method !== 'DELETE' && !(isImage ? /^multipart\/form-data;\s*boundary=.+/i.test(contentType) : /^application\/json(?:;|$)/i.test(contentType))) return NextResponse.json({ message: 'Content-Type inválido.' }, { status: 415 });
  const path = `/admin/${parts.join('/')}`;
  let access = request.cookies.get(ACCESS)?.value;
  const refresh = request.cookies.get(REFRESH)?.value;
  const expired = () => { const result = NextResponse.json({ message: 'Sessão expirada.' }, { status: 401 }); clearSession(result); return result; };
  let refreshedAccess = false;
  try {
    if (!access) {
      if (!refresh) return expired();
      const refreshed = await fetch(`${apiBase()}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: refresh }), cache: 'no-store' });
      if (!refreshed.ok) return expired();
      const data: unknown = await refreshed.json();
      access = typeof data === 'object' && data !== null && 'accessToken' in data && typeof data.accessToken === 'string' ? data.accessToken : undefined;
      if (!access) return expired();
      refreshedAccess = true;
    }
    // Content-Length só permite rejeição antecipada; a API valida o tamanho real do arquivo.
    const length = request.headers.get('content-length');
    if (isImage && length !== null && /^\d+$/.test(length) && BigInt(length) > BigInt(MULTIPART_REQUEST_LIMIT)) return NextResponse.json({ message: 'Imagem excede o limite.' }, { status: 413 });
    // A cópia preserva boundary, filename e bytes; o envelope também tem limite local.
    const body = method === 'POST' || method === 'PATCH' ? await request.arrayBuffer() : undefined;
    if (isImage && body && body.byteLength > MULTIPART_REQUEST_LIMIT) return NextResponse.json({ message: 'Imagem excede o limite.' }, { status: 413 });
    let upstream = await call(path, method, access, body, contentType || undefined);
    if (upstream.status === 401 && refresh && !refreshedAccess) {
      const refreshed = await fetch(`${apiBase()}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: refresh }), cache: 'no-store' });
      if (!refreshed.ok) return expired();
      const data: unknown = await refreshed.json();
      access = typeof data === 'object' && data !== null && 'accessToken' in data && typeof data.accessToken === 'string' ? data.accessToken : undefined;
      if (!access) return expired();
      upstream = await call(path, method, access, body, contentType || undefined);
      refreshedAccess = true;
    }
    const result = await downstream(upstream);
    if (result.status === 401) clearSession(result);
    else if (refreshedAccess) result.cookies.set(ACCESS, access, { ...cookieOptions, maxAge: 15 * 60 });
    return result;
  } catch { return NextResponse.json({ message: 'API indisponível.' }, { status: 502 }); }
}
async function downstream(upstream: Response): Promise<NextResponse> {
  if (upstream.status === 204) return new NextResponse(null, { status: 204 });
  const contentType = upstream.headers.get('content-type') ?? '';
  const body = await upstream.arrayBuffer();
  return new NextResponse(body, { status: upstream.status, headers: { 'content-type': contentType.includes('application/json') ? 'application/json' : 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
}
