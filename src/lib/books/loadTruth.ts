import prisma from '@/lib/prisma';
import { reportTimeZone } from '@/lib/books/periods';
import { usdToCents } from '@/lib/books/money';
import { partsSellCents, readSalesTaxSnapshot } from '@/lib/books/shopTax';
import { isInvoicedJobStatus } from '@/lib/books/jobStatus';
import { payMethodFromNote, type ShopJobFacts, type ShopMoneyEvent } from '@/lib/books/truth';

export async function shopTimeZone(shopId: string): Promise<string> {
  try {
    const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { timezone: true } });
    return reportTimeZone(shop?.timezone);
  } catch {
    return reportTimeZone(null);
  }
}

/** Shop jobs, invoices, and job payments. Fee rows are not shop money. */
export async function loadShopFacts(shopId: string): Promise<ShopJobFacts[]> {
  const [orders, entries, invoices, links] = await Promise.all([
    prisma.workOrder.findMany({
      where: { shopId },
      select: {
        id: true,
        customerId: true,
        status: true,
        paymentStatus: true,
        completedAt: true,
        estimatedCost: true,
        createdAt: true,
        partsUsed: true,
        completion: true,
      },
    }),
    prisma.booksEntry.findMany({
      where: { shopId, appliesTo: 'job', status: { not: 'open' } },
      select: {
        id: true,
        workOrderId: true,
        kind: true,
        amountCents: true,
        note: true,
        createdAt: true,
        depositAt: true,
      },
    }),
    prisma.statusHistory.findMany({
      where: { toStatus: 'waiting-for-payment', workOrder: { shopId } },
      select: { workOrderId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.paymentLink.findMany({
      where: { shopId, description: { startsWith: 'Invoice for work order' } },
      select: { workOrderId: true, createdAt: true },
    }),
  ]);

  const invoiceAt = new Map<string, string>();
  for (const row of invoices) {
    const at = row.createdAt.toISOString();
    const prior = invoiceAt.get(row.workOrderId);
    if (!prior || at < prior) invoiceAt.set(row.workOrderId, at);
  }
  for (const link of links) {
    if (!link.workOrderId) continue;
    const at = link.createdAt.toISOString();
    const prior = invoiceAt.get(link.workOrderId);
    if (!prior || at < prior) invoiceAt.set(link.workOrderId, at);
  }

  const eventsByOrder = new Map<string, ShopMoneyEvent[]>();
  const add = (workOrderId: string, event: ShopMoneyEvent) => {
    const list = eventsByOrder.get(workOrderId) || [];
    list.push(event);
    eventsByOrder.set(workOrderId, list);
  };
  for (const [workOrderId, at] of invoiceAt) {
    const order = orders.find((row) => row.id === workOrderId);
    add(workOrderId, {
      id: `invoice:${workOrderId}`,
      workOrderId,
      at,
      kind: 'invoice',
      cents: usdToCents(order?.estimatedCost),
    });
  }
  for (const entry of entries) {
    const at = (entry.depositAt || entry.createdAt).toISOString();
    if (entry.kind === 'card_payment' || entry.kind === 'job_payment') {
      add(entry.workOrderId, {
        id: entry.id,
        workOrderId: entry.workOrderId,
        at: entry.createdAt.toISOString(),
        kind: 'payment',
        cents: entry.amountCents,
        method: entry.kind === 'card_payment' ? 'card' : payMethodFromNote(entry.note),
      });
    } else if (entry.kind === 'refund') {
      add(entry.workOrderId, { id: entry.id, workOrderId: entry.workOrderId, at, kind: 'refund', cents: entry.amountCents });
    } else if (entry.kind === 'chargeback') {
      add(entry.workOrderId, { id: entry.id, workOrderId: entry.workOrderId, at, kind: 'chargeback', cents: entry.amountCents });
    } else if (entry.kind === 'deposit') {
      add(entry.workOrderId, {
        id: entry.id,
        workOrderId: entry.workOrderId,
        at,
        kind: 'deposit',
        cents: entry.amountCents,
        note: entry.note,
      });
    }
  }

  return orders.map((order) => {
    const events = eventsByOrder.get(order.id) || [];
    const marked = invoiceAt.get(order.id) || null;
    const amount = usdToCents(order.estimatedCost);
    const statusInvoiced = isInvoicedJobStatus(order.status) || String(order.paymentStatus || '').toLowerCase() === 'paid';
    const invoiced = amount > 0 && (Boolean(marked) || statusInvoiced);
    const at = marked || (order.completedAt ? order.completedAt.toISOString() : order.createdAt.toISOString());
    if (invoiced && !events.some((event) => event.kind === 'invoice')) {
      events.unshift({
        id: `invoice:${order.id}`,
        workOrderId: order.id,
        at,
        kind: 'invoice',
        cents: amount,
      });
    }
    return {
      id: order.id,
      customerId: order.customerId,
      status: order.status,
      completedAt: order.completedAt ? order.completedAt.toISOString() : null,
      invoiceCents: invoiced ? amount : null,
      invoiceRecorded: Boolean(marked),
      invoiceAt: invoiced ? at : null,
      partsSellCents: partsSellCents(order.partsUsed),
      salesTax: readSalesTaxSnapshot(order.completion),
      events,
    };
  });
}
