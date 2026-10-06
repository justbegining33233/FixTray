import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { booksAccess, shopIdForBooks } from '@/lib/books/access';
import { intuitConfig } from '@/lib/books/qbo';
import { readQboConnection } from '@/lib/books/qboStore';

export const dynamic = 'force-dynamic';

/** GET /api/shop/quickbooks/status — connection and map, never tokens or client secrets. */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'accountant']);
  if (auth instanceof NextResponse) return auth;
  const access = booksAccess(auth.role);
  if (!access.quickBooks) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const shopId = shopIdForBooks(auth);
  if (!shopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const connection = await readQboConnection(shopId);
  const configured = intuitConfig();
  return NextResponse.json({
    connected: connection.connected,
    realmId: connection.realmId,
    mapSaved: connection.mapSaved,
    qbMap: connection.mapSaved ? connection.map : { sales: '', payments: '', refunds: '', labor: '', parts: '', tax: '' },
    lastSyncAt: connection.lastSyncAt ? connection.lastSyncAt.toISOString() : null,
    lastSyncStatus: connection.lastSyncStatus,
    configured: configured.ok,
    missing: configured.ok ? [] : configured.missing,
  });
}
