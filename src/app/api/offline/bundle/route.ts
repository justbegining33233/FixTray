import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { loadOfflineBundle } from '@/lib/offlineBundleLoad';
import logger from '@/lib/logger';

export const runtime = 'nodejs';

/** Role-scoped cache. Payments, secrets, and other users' records are omitted. */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const bundle = await loadOfflineBundle(auth);
    if (!bundle) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    return NextResponse.json(bundle);
  } catch (error) {
    logger.error('Offline bundle failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to download offline data' }, { status: 500 });
  }
}
