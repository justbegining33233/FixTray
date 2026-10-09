import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { booksAccess, shopIdForBooks } from '@/lib/books/access';
import { maySettlePlatformFee } from '@/lib/staffMoneyAccess';
import { loadShopYearDrill } from '@/lib/books/loadDrill';
import { hideShopRevenue } from '@/lib/books/shopDrill';
import { findShopJob, loadShopBooks, saveQbMap } from '@/lib/books/loadShopBooks';
import { hideManagerFeeOwed, hideManagerShopRevenue, inPersonFeeInvoice, planAllocatedReversal, planDeposit, usdToCents } from '@/lib/books/money';
import { createFeeSettlementCheckout } from '@/lib/feeSettlementCheckout';
import { sendEmail } from '@/lib/emailService';
import { ensureOpeningBalance, writeAudit, writeBooksEntries } from '@/lib/books/persist';
import { partMoveAudit, partValue, pickStockPart, preparePartMove } from '@/lib/books/parts';

function processorId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const id = value.trim();
  return /^(dp_|re_|ch_|pi_)[A-Za-z0-9]+$/.test(id) ? id : null;
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'manager', 'accountant']);
  if (auth instanceof NextResponse) return auth;
  if (!booksAccess(auth.role).shopLedger) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const shopId = shopIdForBooks(auth);
  if (!shopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const url = new URL(request.url);
  if (url.searchParams.get('view') === 'drill') {
    const requested = Number(url.searchParams.get('year'));
    const drill = await loadShopYearDrill(shopId, Number.isInteger(requested) ? requested : null);
    return NextResponse.json(booksAccess(auth.role).shopRevenue ? drill : hideShopRevenue(drill));
  }
  const month = url.searchParams.get('month');
  const books = await loadShopBooks(shopId, month);
  if (!booksAccess(auth.role).shopRevenue) {
    const hidden = hideManagerShopRevenue(books);
    return NextResponse.json({
      ...hidden,
      tickets: [],
      inventory: books.inventory.map((item) => ({ ...item, unitCostCents: 0, sellUnitCents: 0 })),
      reversals: books.reversals.map((row) => ({ ...row, amountCents: 0 })),
      fixtrayOwed: hideManagerFeeOwed(hidden.fixtrayOwed),
    });
  }
  return NextResponse.json(books);
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'manager']);
  if (auth instanceof NextResponse) return auth;
  const access = booksAccess(auth.role);
  if (!access.shopLedger) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const shopId = shopIdForBooks(auth);
  if (!shopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const action = String((body as { action?: string }).action || '');
  const at = new Date().toISOString();

  if (action === 'create-invoice') {
    if (auth.role !== 'shop') return NextResponse.json({ error: 'Only the owner can create an invoice for a paid job.' }, { status: 403 });
    const workOrderId = String((body as { workOrderId?: string }).workOrderId || '');
    const order = await prisma.workOrder.findFirst({ where: { id: workOrderId, shopId } });
    if (!order) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    const history = await prisma.statusHistory.findFirst({
      where: { workOrderId, toStatus: 'waiting-for-payment' },
      select: { id: true },
    });
    if (!history) {
      await prisma.statusHistory.create({
        data: {
          workOrderId,
          fromStatus: order.status || 'completed',
          toStatus: 'waiting-for-payment',
          reason: 'Invoice created for a paid job that had no invoice',
        },
      });
    }
    const description = `Invoice for work order ${workOrderId}`;
    const link = await prisma.paymentLink.findFirst({
      where: { workOrderId, description: { startsWith: 'Invoice for work order' } },
      select: { id: true },
    });
    if (!link) {
      await prisma.paymentLink.create({
        data: {
          shopId,
          workOrderId,
          customerId: order.customerId,
          token: crypto.randomBytes(24).toString('hex'),
          amount: order.estimatedCost || 0,
          description,
          status: order.paymentStatus === 'paid' ? 'paid' : 'pending',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    } else if (order.paymentStatus === 'paid') {
      await prisma.paymentLink.updateMany({
        where: { workOrderId, status: 'pending' },
        data: { status: 'paid', paidAt: new Date() },
      });
    }
    return NextResponse.json({ ok: true, workOrderId, description });
  }

  if (action === 'mark-paid-links') {
    if (auth.role !== 'shop') return NextResponse.json({ error: 'Only the owner can mark paid invoice links.' }, { status: 403 });
    const [orders, pending] = await Promise.all([
      prisma.workOrder.findMany({
        where: { shopId, paymentStatus: 'paid' },
        select: { id: true },
      }),
      prisma.paymentLink.findMany({
        where: { shopId, status: 'pending', description: { startsWith: 'Invoice for work order' } },
        select: { id: true, workOrderId: true },
      }),
    ]);
    const paidIds = new Set(orders.map((order) => order.id));
    const ids = pending.filter((link) => link.workOrderId && paidIds.has(link.workOrderId)).map((link) => link.id);
    if (ids.length > 0) {
      await prisma.paymentLink.updateMany({
        where: { id: { in: ids } },
        data: { status: 'paid', paidAt: new Date() },
      });
    }
    return NextResponse.json({ ok: true, marked: ids.length });
  }

  if (action === 'deposit') {
    const workOrderId = String((body as { workOrderId?: string }).workOrderId || '');
    const job = await findShopJob(shopId, workOrderId);
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    const planned = planDeposit({
      workOrderId,
      shopId,
      amountCents: Number((body as { amountCents?: number }).amountCents),
      depositAt: String((body as { depositAt?: string }).depositAt || ''),
      actorId: auth.id,
      at,
      shopReceivedCents: job.shopReceivedCents,
    });
    if (!planned.ok) return NextResponse.json({ error: planned.error }, { status: 400 });
    await writeBooksEntries({ shopId, workOrderId, entries: [planned.entry], audit: planned.audit });
    return NextResponse.json({ ok: true, audit: planned.audit });
  }

  if (action === 'chargeback') {
    const workOrderId = String((body as { workOrderId?: string }).workOrderId || '');
    const sourceId = processorId((body as { sourceId?: string }).sourceId);
    if (!sourceId) {
      return NextResponse.json({ error: 'A Stripe dispute, refund, charge, or payment id is required' }, { status: 400 });
    }
    const job = await findShopJob(shopId, workOrderId);
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    const appliesTo = (body as { appliesTo?: string }).appliesTo === 'fee' ? 'fee' : 'job';
    const status = (body as { status?: string }).status === 'open' ? 'open' : 'posted';
    const planned = planAllocatedReversal({
      kind: 'chargeback',
      amountCents: Number((body as { amountCents?: number }).amountCents),
      jobRemainingCents: appliesTo === 'fee' ? 0 : job.shopReceivedCents,
      feeRemainingCents: appliesTo === 'job' ? 0 : job.platformFeeCents,
      appliesTo,
      status,
      sourceId,
      workOrderId,
      shopId,
      actorId: auth.id,
      at,
    });
    if (!planned.ok) return NextResponse.json({ error: planned.error }, { status: 400 });
    await ensureOpeningBalance({ shopId, job, actorId: auth.id, at });
    await writeBooksEntries({ shopId, workOrderId, entries: planned.entries, audit: planned.audit });
    if (status === 'posted') {
      const nextReceived = Math.max(0, job.shopReceivedCents + planned.shopDeltaCents);
      const nextFee = Math.max(0, job.platformFeeCents + planned.feeDeltaCents);
      const fullyReversed = nextReceived === 0 && planned.shopDeltaCents < 0;
      await prisma.workOrder.update({
        where: { id: workOrderId },
        data: {
          amountPaid: (nextReceived + nextFee) / 100,
          paymentStatus: nextReceived === job.jobCents && job.jobCents > 0
            ? 'paid'
            : nextReceived > 0
              ? 'pending'
              : fullyReversed
                ? 'refunded'
                : 'unpaid',
        },
      });
    }
    return NextResponse.json({ ok: true, audit: planned.audit, shopDeltaCents: planned.shopDeltaCents, feeDeltaCents: planned.feeDeltaCents });
  }

  if (action === 'qb-map') {
    const map = await saveQbMap(shopId, (body as { map?: Record<string, unknown> }).map || {});
    await writeAudit({
      actorId: auth.id,
      at,
      action: 'books.qb_map',
      targetType: 'integration',
      targetId: shopId,
      shopId,
      details: 'QuickBooks account map saved',
    });
    return NextResponse.json({ ok: true, qbMap: map });
  }

  if (action === 'part') {
    if (!access.parts) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const itemId = String((body as { itemId?: string }).itemId || '');
    const kind = String((body as { kind?: string }).kind || '');
    if (kind !== 'use' && kind !== 'return' && kind !== 'adjust') {
      return NextResponse.json({ error: 'Unknown part action' }, { status: 400 });
    }
    const stock = await prisma.inventoryStock.findMany({
      where: { shopId },
      select: { id: true, itemName: true, sku: true, quantity: true },
    });
    const picked = pickStockPart(
      stock.map((row) => ({ id: row.id, name: row.itemName, sku: row.sku, onHand: row.quantity })),
      itemId,
    );
    if (!picked.ok) return NextResponse.json({ error: picked.error }, { status: 400 });
    const item = await prisma.inventoryStock.findFirst({ where: { id: picked.part.id, shopId } });
    if (!item) return NextResponse.json({ error: 'Part not found' }, { status: 404 });
    const moved = preparePartMove({
      kind,
      qty: Number((body as { qty?: number }).qty),
      reason: typeof (body as { reason?: string }).reason === 'string' ? (body as { reason: string }).reason : undefined,
      onHand: item.quantity,
    });
    if (!moved.ok) return NextResponse.json({ error: moved.error }, { status: 400 });
    await prisma.inventoryStock.update({ where: { id: item.id }, data: { quantity: moved.onHand } });
    const audit = partMoveAudit({
      itemId: item.id,
      shopId,
      kind,
      delta: moved.delta,
      onHand: moved.onHand,
      reason: (body as { reason?: string }).reason,
      actorId: auth.id,
      at,
    });
    await writeAudit(audit);
    return NextResponse.json({
      ok: true,
      onHand: moved.onHand,
      value: partValue(moved.onHand, usdToCents(item.unitCost), usdToCents(item.sellingPrice)),
      audit,
    });
  }

  if (action === 'fee-invoice' || action === 'pay-fixtray') {
    if (!maySettlePlatformFee(auth.role)) {
      return NextResponse.json({ error: 'Only the shop owner can settle the FixTray fee.' }, { status: 403 });
    }
    const books = await loadShopBooks(shopId);
    const owed = books.fixtrayOwed.week;
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { email: true, shopName: true },
    });
    const invoice = inPersonFeeInvoice({
      shopName: shop?.shopName || 'Shop',
      weekLabel: books.fixtrayOwed.weekLabel,
      owed,
    });
    if (action === 'fee-invoice') {
      if (owed.owedCents <= 0) {
        return NextResponse.json({ error: 'There is no FixTray fee to invoice this week.' }, { status: 400 });
      }
      const sent = shop?.email
        ? await sendEmail({
          to: shop.email,
          subject: invoice.subject,
          html: `<p>${invoice.text.replace(/\n/g, '<br>')}</p>`,
          from: 'FixTray Support <support@fixtray.app>',
          shopId,
        })
        : false;
      return NextResponse.json({
        ok: true,
        sent,
        owedCents: owed.owedCents,
        invoice,
        feeDeductedFromShop: false,
      });
    }
    const session = await createFeeSettlementCheckout({
      shopId,
      shopEmail: shop?.email,
      owedCents: owed.owedCents,
      weekLabel: books.fixtrayOwed.weekLabel,
      appUrl: request.nextUrl.origin,
    });
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });
    return NextResponse.json({ ok: true, url: session.url, owedCents: owed.owedCents });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
