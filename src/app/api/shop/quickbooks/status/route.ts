import { NextRequest, NextResponse } from 'next/server';
import { requireQuickBooksOwner } from '@/lib/books/qboOwner';
import { intuitConfig } from '@/lib/books/qbo';
import { readQboConnection } from '@/lib/books/qboStore';

export const dynamic = 'force-dynamic';

/** GET /api/shop/quickbooks/status — connection and map, never tokens or client secrets. */
export async function GET(request: NextRequest) {
  const owner = requireQuickBooksOwner(request);
  if (owner instanceof NextResponse) return owner;
  const connection = await readQboConnection(owner.shopId);
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
