import { NextRequest, NextResponse } from 'next/server';
import { requireQuickBooksOwner } from '@/lib/books/qboOwner';
import { loadShopBooks, loadShopLabor } from '@/lib/books/loadShopBooks';
import { writeAudit } from '@/lib/books/persist';
import { buildQboSyncBatch, postQboSyncBatch, qboAudit, syncMatchesLedger } from '@/lib/books/qbo';
import { readQboConnection, saveQboSyncResult } from '@/lib/books/qboStore';
import { accessTokenFor } from '@/lib/books/qboSession';

export const dynamic = 'force-dynamic';

/**
 * POST /api/shop/quickbooks/sync { month: "YYYY-MM" }
 * Pushes shop sales, payments, refunds, and labor. Refuses a dirty month.
 * The platform fee is not in the payload.
 */
export async function POST(request: NextRequest) {
  const owner = requireQuickBooksOwner(request);
  if (owner instanceof NextResponse) return owner;
  const body = await request.json().catch(() => null);
  const month = body && typeof body === 'object' ? String((body as { month?: unknown }).month || '') : '';
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Choose a month to sync' }, { status: 400 });
  }

  const books = await loadShopBooks(owner.shopId, month);
  if (!books.monthClose.readyToSync) {
    const at = new Date().toISOString();
    await writeAudit(qboAudit({
      actorId: owner.auth.id,
      at,
      shopId: owner.shopId,
      action: 'books.quickbooks_sync',
      details: `blocked; ${books.monthClose.warnings.join('; ')}; fee excluded`,
    }));
    return NextResponse.json({
      blocked: true,
      warnings: books.monthClose.warnings,
      copy: books.copy,
    }, { status: 409 });
  }

  const connection = await readQboConnection(owner.shopId);
  if (!connection.connected) {
    return NextResponse.json({ error: 'Connect QuickBooks Online first' }, { status: 400 });
  }
  if (!connection.mapSaved) {
    return NextResponse.json({ error: 'Map QuickBooks accounts before syncing' }, { status: 400 });
  }

  const labor = await loadShopLabor(owner.shopId, month);
  const batch = buildQboSyncBatch({
    shopId: owner.shopId,
    month,
    jobs: books.ledger.jobs,
    reversals: books.reversals,
    labor,
    parts: books.tickets.map((ticket) => ({ workOrderId: ticket.workOrderId, amountCents: ticket.partCents })),
    tax: books.tickets.map((ticket) => ({ workOrderId: ticket.workOrderId, taxCents: ticket.taxCents })),
    map: connection.map,
    close: books.monthClose,
  });
  if (!batch.ok) {
    return NextResponse.json({ blocked: true, warnings: batch.warnings, copy: batch.copy }, { status: 409 });
  }
  if (!syncMatchesLedger(batch.totals, books.ledger)) {
    return NextResponse.json({ error: 'Sync totals do not match the shop ledger' }, { status: 409 });
  }

  const access = await accessTokenFor(owner.shopId);
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });

  const pushed = await postQboSyncBatch({
    apiHost: access.apiHost,
    realmId: access.realmId,
    accessToken: access.token,
    requests: batch.requests,
    alreadyPosted: connection.posted,
  });
  const at = new Date().toISOString();
  await saveQboSyncResult(owner.shopId, {
    posted: pushed.posted,
    status: pushed.ok ? 'ok' : 'error',
    syncedAt: new Date(at),
  });
  await writeAudit(qboAudit({
    actorId: owner.auth.id,
    at,
    shopId: owner.shopId,
    action: 'books.quickbooks_sync',
    details: pushed.ok
      ? `synced ${batch.requests.length} entities; net shop ${batch.totals.netShopCents} cents; fee excluded`
      : `sync failed after ${Object.keys(pushed.posted).length} entities; fee excluded`,
  }));
  if (!pushed.ok) return NextResponse.json({ error: pushed.error }, { status: 502 });
  return NextResponse.json({
    ok: true,
    synced: batch.requests.length,
    totals: batch.totals,
    copy: batch.copy,
  });
}
