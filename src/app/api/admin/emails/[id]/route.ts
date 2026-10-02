import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { isPlatformEmailAccount } from '@/lib/platformEmailAccess';
import { readReceivedSupportMail } from '@/lib/platformMailbox';
import { readRememberedSupportMail } from '@/lib/supportInboxStore';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;
  if (!isPlatformEmailAccount(auth.username)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;
  const result = await readReceivedSupportMail(id);
  if (result.ok) return NextResponse.json({ email: result.data });
  const stored = await readRememberedSupportMail(id);
  if (stored) return NextResponse.json({ email: stored });
  return NextResponse.json({ error: result.error }, { status: result.status });
}
