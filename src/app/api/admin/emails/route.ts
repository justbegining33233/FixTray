import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { isPlatformEmailAccount } from '@/lib/platformEmailAccess';
import { listRecentPlatformMail, sendPlatformMail } from '@/lib/platformMailbox';
import { rateLimit, rateLimitConfigs } from '@/lib/rateLimit';

function requireMailbox(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;
  if (!isPlatformEmailAccount(auth.username)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return auth;
}

export async function GET(request: NextRequest) {
  const auth = requireMailbox(request);
  if (auth instanceof NextResponse) return auth;

  const result = await listRecentPlatformMail(20);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ emails: result.data });
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(rateLimitConfigs.strict)(request);
  if (limited) return limited;

  const auth = requireMailbox(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const result = await sendPlatformMail({
    from: body?.from,
    to: body?.to,
    subject: body?.subject,
    text: body?.text,
    requestId: body?.requestId,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ id: result.data.id });
}
