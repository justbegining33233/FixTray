import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { applyTechOfflineOp, type OfflineDb } from '@/lib/techOfflineApply';
import logger from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== 'tech' && auth.role !== 'manager') {
    return NextResponse.json({ error: 'Technicians only' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const ops = Array.isArray(body?.ops) ? body.ops : null;
    if (!ops) return NextResponse.json({ error: 'ops array is required' }, { status: 400 });
    if (ops.length > 40) return NextResponse.json({ error: 'Too many operations' }, { status: 400 });

    const results = [];
    for (const op of ops) {
      try {
        results.push(await applyTechOfflineOp(prisma as unknown as OfflineDb, auth, op));
      } catch (error) {
        logger.error('Offline sync op failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        results.push({
          idempotencyKey: typeof op?.idempotencyKey === 'string' ? op.idempotencyKey : '',
          kind: typeof op?.kind === 'string' ? op.kind : '',
          status: 'rejected',
          message: 'Sync failed. It will be retried.',
        });
      }
    }
    return NextResponse.json({ results });
  } catch (error) {
    logger.error('Offline sync request failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
