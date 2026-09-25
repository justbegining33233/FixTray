import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { loadOfflineBundle } from '@/lib/offlineBundleLoad';
import logger from '@/lib/logger';

export const runtime = 'nodejs';

/** Tech and manager prep download. Same payload as /api/offline/bundle for those roles. */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== 'tech' && auth.role !== 'manager') {
    return NextResponse.json({ error: 'Technicians only' }, { status: 403 });
  }
  try {
    const bundle = await loadOfflineBundle(auth);
    if (!bundle) return NextResponse.json({ error: 'Tech not found' }, { status: 404 });
    return NextResponse.json({ ...bundle, techId: auth.id });
  } catch (error) {
    logger.error('Offline bundle failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to download jobs' }, { status: 500 });
  }
}
