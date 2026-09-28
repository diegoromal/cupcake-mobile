export class AdminApiError extends Error {
  constructor(public status: number, message: string, public network = false) { super(message); }
}
export async function adminApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!path.startsWith('/api/admin/') && !path.startsWith('/api/session/')) throw new Error('Endpoint inválido');
  let response: Response;
  try { response = await fetch(path, { ...options, credentials: 'same-origin', cache: 'no-store' }); }
  catch { throw new AdminApiError(0, 'Falha de rede. Tente novamente.', true); }
  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string' ? data.message : `API respondeu ${response.status}.`;
    // A biblioteca HTTP não está dentro de um componente com useRouter.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (response.status === 401 && path.startsWith('/api/admin/')) window.location.href = '/login?expired=1';
    throw new AdminApiError(response.status, message);
  }
  return data as T;
}
