import { NextRequest, NextResponse } from 'next/server';
import { clientIpFromRequest, pageViewSummary, recordPageView } from '@/lib/pageViews';
import { requireVisitViewer } from '@/lib/visitAccess';

export const dynamic = 'force-dynamic';

/** Records a page view. The browser sends the path; the address is hashed here. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const record = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const result = await recordPageView({
    path: record.path,
    userAgent: request.headers.get('user-agent'),
    ip: clientIpFromRequest(request),
    sessionId: record.sessionId,
    referrer: record.referrer,
  });
  if (!result.ok) {
    const error = result.status === 429
      ? 'Too many requests'
      : result.status === 400
        ? 'Invalid page view'
        : 'Failed to track page view';
    return NextResponse.json({ error }, { status: result.status });
  }
  return NextResponse.json({ success: true });
}

/** Visit totals. Same login as the visits page. */
export async function GET(request: NextRequest) {
  const auth = requireVisitViewer(request);
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(await pageViewSummary());
  } catch {
    console.error('Failed to load page views');
    return NextResponse.json({ error: 'Failed to load page views' }, { status: 500 });
  }
}
