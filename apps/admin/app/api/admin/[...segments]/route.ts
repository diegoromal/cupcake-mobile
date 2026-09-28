import { NextRequest } from 'next/server';
import { proxyAdmin } from '@/lib/server/api-proxy';
type Context = { params: Promise<{ segments: string[] }> };
async function handle(request: NextRequest, context: Context) { return proxyAdmin(request, (await context.params).segments); }
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
