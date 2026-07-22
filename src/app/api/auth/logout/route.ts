import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import prisma from '@/lib/prisma';
import { validateCsrf } from '@/lib/csrf';

export async function POST(request: NextRequest) {
  try {
    // Validate CSRF for logout
    const ok = await validateCsrf(request);
    if (!ok) return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });

    const id = request.cookies.get('refresh_id')?.value;
    if (id) await prisma.refreshToken.delete({ where: { id } }).catch(() => {});

    const response = NextResponse.json({ ok: true });
    response.cookies.delete('sos_auth');
    response.cookies.delete('refresh_id');
    response.cookies.delete('refresh_sig');
    response.cookies.delete('refresh_token');
    response.cookies.delete('csrf_token');
    return response;
  } catch (error) {
    logger.error('Logout error', error);
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}
