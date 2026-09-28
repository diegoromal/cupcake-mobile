import { NextRequest, NextResponse } from 'next/server';
import { clearSession, sameOrigin } from '@/lib/server/api-proxy';
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ message: 'Origem não permitida.' }, { status: 403 });
  const response = new NextResponse(null, { status: 204 });
  clearSession(response);
  return response;
}
