export class AdminApiError extends Error {
  constructor(public status: number, message: string, public network = false, public detail = false) { super(message); }
}
function apiMessage(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('message' in data)) return null;
  const { message } = data;
  if (typeof message === 'string') return message.trim() || null;
  if (Array.isArray(message)) return message.filter((entry): entry is string => typeof entry === 'string' && !!entry.trim()).map(entry => entry.trim()).join('; ') || null;
  return null;
}
export async function adminApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!path.startsWith('/api/admin/') && !path.startsWith('/api/session/')) throw new Error('Endpoint inválido');
  let response: Response;
  try { response = await fetch(path, { ...options, credentials: 'same-origin', cache: 'no-store' }); }
  catch { throw new AdminApiError(0, 'Falha de rede. Tente novamente.', true); }
  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = apiMessage(data);
    // A biblioteca HTTP não está dentro de um componente com useRouter.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (response.status === 401 && path.startsWith('/api/admin/')) window.location.href = '/login?expired=1';
    throw new AdminApiError(response.status, detail ?? `API respondeu ${response.status}.`, false, detail !== null);
  }
  return data as T;
}
