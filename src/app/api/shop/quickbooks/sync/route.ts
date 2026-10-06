import { NextRequest, NextResponse } from 'next/server';
import { requireQuickBooksOwner } from '@/lib/books/qboOwner';
import prisma from '@/lib/prisma';
import { loadShopBooks } from '@/lib/books/loadShopBooks';
import { writeAudit } from '@/lib/books/persist';
import { qboAudit } from '@/lib/books/qbo';
import { lockedMonths, readQboConnection, saveQboSyncResult } from '@/lib/books/qboStore';
import { loadShopFacts, shopTimeZone } from '@/lib/books/loadTruth';
import { shopDateSpan } from '@/lib/books/periods';
import { buildQboBooksPush, postQboEntities, qboTotalsMatchBooks, reconcileShopMonth } from '@/lib/books/qboPush';
import { bankDepositEvents } from '@/lib/books/statements';
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
  if (lockedMonths(connection.settings).includes(month)) {
    return NextResponse.json({ error: `Month ${month} is locked after a clean sync`, locked: true }, { status: 409 });
  }
  const zone = await shopTimeZone(owner.shopId);
  const [year, mon] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const span = shopDateSpan(`${month}-01`, `${month}-${String(lastDay).padStart(2, '0')}`, zone);
  const mismatches = reconcileShopMonth({ jobs: await loadShopFacts(owner.shopId), start: span.start, end: span.end });
  if (mismatches.length > 0) {
    return NextResponse.json({
      blocked: true,
      mismatches,
      warnings: mismatches.map((row) => `${row.workOrderId || row.billId}: ${row.reason}`),
    }, { status: 409 });
  }
  if (!connection.connected) {
    return NextResponse.json({ error: 'Connect QuickBooks Online first' }, { status: 400 });
  }
  if (!connection.mapSaved) {
    return NextResponse.json({ error: 'Map QuickBooks accounts before syncing' }, { status: 400 });
  }

  const facts = await loadShopFacts(owner.shopId);
  const customerIds = [...new Set(facts.map((job) => job.customerId).filter((id): id is string => Boolean(id)))];
  const [customers, vendors, items, bills, billPayments, deposits, clocks] = await Promise.all([
    prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, firstName: true, lastName: true } }),
    prisma.vendor.findMany({ where: { shopId: owner.shopId }, select: { id: true, name: true } }),
    prisma.inventoryItem.findMany({ where: { shopId: owner.shopId }, select: { id: true, name: true } }),
    prisma.vendorBill.findMany({
      where: { shopId: owner.shopId, billDate: { gte: span.start, lt: span.end } },
      include: { lines: true },
    }),
    prisma.billPayment.findMany({ where: { shopId: owner.shopId, paidAt: { gte: span.start, lt: span.end } } }),
    prisma.bankDeposit.findMany({ where: { shopId: owner.shopId, depositedAt: { gte: span.start, lt: span.end } } }),
    prisma.timeEntry.findMany({
      where: { shopId: owner.shopId, clockOut: { not: null }, clockIn: { gte: span.start, lt: span.end } },
      include: { tech: { select: { firstName: true, lastName: true, hourlyRate: true } } },
    }),
  ]);
  let batch: ReturnType<typeof buildQboBooksPush>;
  try {
    batch = buildQboBooksPush({
      shopId: owner.shopId,
      month,
      jobs: facts,
      start: span.start,
      end: span.end,
      customers: customers.map((row) => ({ id: row.id, name: `${row.firstName} ${row.lastName}`.trim() })),
      vendors: vendors.map((row) => ({ id: row.id, name: row.name })),
      items: items.map((row) => ({ id: row.id, name: row.name, kind: 'part' as const })),
      bills: bills.map((row) => ({
        id: row.id,
        vendorId: row.vendorId,
        date: row.billDate.toISOString(),
        dueDate: row.dueDate.toISOString(),
        amountCents: row.lines.reduce((sum, line) => sum + line.amountCents, 0),
        itemId: row.lines[0]?.inventoryItemId || null,
      })),
      billPayments: billPayments.map((row) => ({
        id: row.id,
        billId: row.billId,
        date: row.paidAt.toISOString(),
        amountCents: row.amountCents,
      })),
      deposits: (deposits.length > 0
        ? deposits.map((row) => ({
          id: row.id,
          date: row.depositedAt.toISOString(),
          amountCents: row.amountCents,
          workOrderIds: row.workOrderIds,
        }))
        : bankDepositEvents(facts).map((row) => ({
          id: row.id,
          date: row.at,
          amountCents: row.cents,
          workOrderIds: [row.workOrderId],
        }))
      ),
      time: clocks.filter((row) => row.clockOut && (row.hoursWorked || 0) > 0 && row.tech.hourlyRate > 0).map((row) => ({
        id: row.id,
        personName: `${row.tech.firstName} ${row.tech.lastName}`.trim(),
        date: row.clockIn.toISOString(),
        minutes: Math.round((row.hoursWorked || 0) * 60),
        hourlyRateCents: Math.round(row.tech.hourlyRate * 100),
      })),
      map: { ...connection.map },
      alreadyPosted: connection.posted,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'QuickBooks payload was rejected';
    return NextResponse.json({ error: message }, { status: 409 });
  }
  if (!batch.ok) return NextResponse.json({ blocked: true, error: batch.error, mismatches: batch.mismatches }, { status: 409 });
  if (!qboTotalsMatchBooks(batch.totals, batch.books)) {
    return NextResponse.json({ error: 'Sync totals do not match the shop books' }, { status: 409 });
  }

  const access = await accessTokenFor(owner.shopId);
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });

  const pushed = await postQboEntities({
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
    lockMonth: pushed.ok ? month : null,
  });
  await writeAudit(qboAudit({
    actorId: owner.auth.id,
    at,
    shopId: owner.shopId,
    action: 'books.quickbooks_sync',
    details: pushed.ok
      ? `synced ${batch.requests.length} entities; shop revenue ${batch.totals.revenueCents} cents; fee excluded`
      : `sync failed after ${Object.keys(pushed.posted).length} entities; fee excluded`,
  }));
  if (!pushed.ok) return NextResponse.json({ error: pushed.error }, { status: 502 });
  return NextResponse.json({
    ok: true,
    synced: batch.requests.length,
    totals: batch.totals,
    copy: books.copy,
  });
}
