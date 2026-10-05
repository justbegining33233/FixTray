import { NextRequest, NextResponse } from 'next/server';
import { pageViewSummary } from '@/lib/pageViews';
import { requireVisitViewer } from '@/lib/visitAccess';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
