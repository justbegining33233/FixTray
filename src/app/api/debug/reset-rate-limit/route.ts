import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { resetRateLimit, getRateLimitStatus } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  // Block debug endpoints entirely in production
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const identifier = body?.identifier || body?.ip || body?.username;
    if (!identifier) {
      return NextResponse.json({ error: 'identifier required (ip or username)' }, { status: 400 });
    }

    resetRateLimit(identifier);
    const status = getRateLimitStatus(identifier);
    return NextResponse.json({ success: true, identifier, status });
  } catch {
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
