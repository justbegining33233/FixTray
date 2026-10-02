import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { isPlatformEmailAccount } from '@/lib/platformEmailAccess';
import { readPlatformMail } from '@/lib/platformMailbox';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;
  if (!isPlatformEmailAccount(auth.username)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;
  const result = await readPlatformMail(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ email: result.data });
}
