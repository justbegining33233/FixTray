/**
 * Load a year of books into the drill-down reports.
 * Fee rows keep the cents stored at checkout. Shop timezone is not a column;
 * the report uses PlatformConfig.timezone, otherwise America/New_York.
 */

import prisma from '@/lib/prisma';
import { feeEventFromBooksRow, buildFeeYear, type FeeYearReport } from '@/lib/books/feeDrill';
import { punchMinutes } from '@/lib/books/shopDrill';
import {
  booksPaymentMethod,
  buildShopYear,
  parsePartAudit,
  type ShopFixtrayFee,
  type ShopYearReport,
} from '@/lib/books/shopDrill';
import { usdToCents } from '@/lib/books/money';
import { currentYear, reportTimeZone, zonedDayStart, dayKey } from '@/lib/books/periods';
import { shopTimeZone } from '@/lib/books/loadTruth';

async function reportZone(): Promise<string> {
  try {
    const config = await prisma.platformConfig.findUnique({ where: { id: 'global' }, select: { timezone: true } });
    return reportTimeZone(config?.timezone);
  } catch {
    return reportTimeZone(null);
  }
}

function yearWindow(year: number, timeZone: string): { start: Date; end: Date } {
  return {
    start: zonedDayStart(`${year}-01-01`, timeZone),
    end: zonedDayStart(`${year + 1}-01-01`, timeZone),
  };
}

export async function loadFeeYearDrill(yearInput?: number | null, now = new Date()): Promise<FeeYearReport> {
  const timeZone = await reportZone();
  const year = Number.isInteger(yearInput) && (yearInput as number) >= 2000 && (yearInput as number) <= 2100
    ? (yearInput as number)
    : currentYear(timeZone, now);
  const { start, end } = yearWindow(year, timeZone);
  const entries = await prisma.booksEntry.findMany({
    where: { createdAt: { gte: start, lt: end }, appliesTo: 'fee' },
    select: {
      id: true,
      shopId: true,
      workOrderId: true,
      kind: true,
      appliesTo: true,
      amountCents: true,
      status: true,
      note: true,
      createdAt: true,
      shop: { select: { shopName: true } },
    },
  });
  return buildFeeYear({
    year,
    timeZone,
    events: entries.flatMap((entry) => {
      const event = feeEventFromBooksRow({ ...entry, shopName: entry.shop?.shopName || entry.shopId });
      return event ? [event] : [];
    }),
  });
}

function personName(person: { firstName?: string | null; lastName?: string | null } | null | undefined, id: string): string {
  const name = `${person?.firstName || ''} ${person?.lastName || ''}`.trim();
  return name || id;
}

export async function loadShopYearDrill(shopId: string, yearInput?: number | null, now = new Date()): Promise<ShopYearReport> {
  const timeZone = await shopTimeZone(shopId);
  const year = Number.isInteger(yearInput) && (yearInput as number) >= 2000 && (yearInput as number) <= 2100
    ? (yearInput as number)
    : currentYear(timeZone, now);
  const { start, end } = yearWindow(year, timeZone);
  const [entries, invoices, links, audits, orders, staffRows, workRows] = await Promise.all([
    prisma.booksEntry.findMany({
      where: { shopId, createdAt: { gte: start, lt: end } },
    }),
    prisma.statusHistory.findMany({
      where: { toStatus: 'waiting-for-payment', createdAt: { gte: start, lt: end }, workOrder: { shopId } },
      select: { workOrderId: true, createdAt: true, workOrder: { select: { estimatedCost: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.paymentLink.findMany({
      where: {
        shopId,
        createdAt: { gte: start, lt: end },
        description: { startsWith: 'Invoice for work order' },
      },
      select: { workOrderId: true, createdAt: true },
    }),
    prisma.auditLog.findMany({
      where: { shopId, createdAt: { gte: start, lt: end }, action: { startsWith: 'parts.' } },
      select: { id: true, action: true, details: true, createdAt: true },
    }),
    prisma.purchaseOrder.findMany({
      where: { shopId, createdAt: { gte: start, lt: end } },
      include: { items: true },
    }),
    prisma.timeEntry.findMany({
      where: {
        shopId,
        clockIn: { lt: end },
        OR: [{ clockOut: null }, { clockOut: { gte: start } }],
      },
      select: {
        id: true,
        techId: true,
        clockIn: true,
        clockOut: true,
        hoursWorked: true,
        breakDuration: true,
        tech: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.workOrderTimeEntry.findMany({
      where: {
        shopId,
        clockIn: { lt: end },
        OR: [{ clockOut: null }, { clockOut: { gte: start } }],
      },
      select: {
        id: true,
        techId: true,
        clockIn: true,
        clockOut: true,
        hoursSpent: true,
        tech: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  const quoteByOrder = new Map<string, number>();
  for (const row of invoices) {
    if (!quoteByOrder.has(row.workOrderId)) quoteByOrder.set(row.workOrderId, usdToCents(row.workOrder.estimatedCost));
  }
  const linkOrders = [...new Set(links.map((link) => link.workOrderId).filter((id): id is string => Boolean(id)))]
    .filter((id) => !quoteByOrder.has(id));
  if (linkOrders.length > 0) {
    const jobs = await prisma.workOrder.findMany({
      where: { id: { in: linkOrders } },
      select: { id: true, estimatedCost: true },
    });
    for (const job of jobs) quoteByOrder.set(job.id, usdToCents(job.estimatedCost));
  }

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

  const depositIds = new Set(entries.filter((entry) => entry.kind === 'deposit' && entry.status !== 'open').map((entry) => entry.workOrderId));
  const firstPayment = new Map<string, { at: string; cents: number }>();
  for (const entry of entries) {
    if (entry.appliesTo !== 'job') continue;
    if (entry.kind !== 'card_payment' && entry.kind !== 'job_payment') continue;
    if (entry.status === 'open') continue;
    const at = entry.createdAt.toISOString();
    const prior = firstPayment.get(entry.workOrderId);
    if (!prior || at < prior.at) firstPayment.set(entry.workOrderId, { at, cents: 0 });
  }
  for (const entry of entries) {
    if (entry.appliesTo !== 'job') continue;
    if (entry.kind !== 'card_payment' && entry.kind !== 'job_payment') continue;
    if (entry.status === 'open') continue;
    const slot = firstPayment.get(entry.workOrderId);
    if (slot) slot.cents += entry.amountCents;
  }

  let stockSnapshots: Array<{ day: string; valueCents: number }> = [];
  try {
    const snaps = await prisma.inventoryValueSnapshot.findMany({
      where: { shopId, asOf: { gte: start, lt: end } },
      select: { asOf: true, valueCents: true },
    });
    const byDay = new Map<string, number>();
    for (const snap of snaps) {
      const key = dayKey(snap.asOf, timeZone);
      byDay.set(key, (byDay.get(key) || 0) + snap.valueCents);
    }
    stockSnapshots = [...byDay.entries()].map(([day, valueCents]) => ({ day, valueCents }));
  } catch {
    stockSnapshots = [];
  }

  return buildShopYear({
    year,
    timeZone,
    invoices: [...invoiceAt.entries()].map(([workOrderId, at]) => ({
      workOrderId,
      at,
      cents: quoteByOrder.get(workOrderId) || 0,
    })),
    payments: entries.flatMap((entry) => {
      const method = booksPaymentMethod(entry.kind, entry.note, entry.appliesTo);
      if (!method || entry.status === 'open') return [];
      return [{
        id: entry.id,
        workOrderId: entry.workOrderId,
        at: entry.createdAt.toISOString(),
        cents: entry.amountCents,
        method,
      }];
    }),
    fixtray: entries.flatMap((entry): ShopFixtrayFee[] => {
      if (entry.appliesTo !== 'fee' || entry.status === 'open') return [];
      if (entry.kind === 'fee_settlement') {
        return [{ id: entry.id, workOrderId: entry.workOrderId, at: entry.createdAt.toISOString(), cents: entry.amountCents, kind: 'settlement' }];
      }
      if (entry.kind === 'job_payment' && !String(entry.note || '').toLowerCase().includes('opening balance')) {
        return [{ id: entry.id, workOrderId: entry.workOrderId, at: entry.createdAt.toISOString(), cents: entry.amountCents, kind: 'in_person' }];
      }
      return [];
    }),
    deposits: entries.flatMap((entry) => {
      if (entry.kind !== 'deposit' || entry.status === 'open') return [];
      const at = entry.depositAt ? entry.depositAt.toISOString() : entry.createdAt.toISOString();
      const jobPayments = entries.filter((row) => row.workOrderId === entry.workOrderId && row.appliesTo === 'job' && (row.kind === 'card_payment' || row.kind === 'job_payment') && row.status !== 'open');
      const received = jobPayments.reduce((sum, row) => sum + row.amountCents, 0);
      return [{
        id: entry.id,
        workOrderId: entry.workOrderId,
        at,
        cents: entry.amountCents,
        matched: received > 0 && entry.amountCents === received,
      }];
    }),
    missingDeposits: [...firstPayment.entries()]
      .filter(([workOrderId]) => !depositIds.has(workOrderId))
      .map(([workOrderId, payment]) => ({ workOrderId, at: payment.at, cents: payment.cents })),
    parts: audits.flatMap((row) => {
      const parsed = parsePartAudit(row.action, row.details);
      if (!parsed) return [];
      return [{ id: row.id, at: row.createdAt.toISOString(), kind: parsed.kind, qty: parsed.qty }];
    }),
    purchases: orders.flatMap((order) => order.items.map((item) => {
      const unitCostCents = usdToCents(item.unitCost);
      return {
        id: item.id,
        at: order.createdAt.toISOString(),
        vendor: order.vendor?.trim() || 'Unknown vendor',
        item: item.itemName,
        qty: item.quantity,
        unitCostCents,
        totalCents: item.quantity * unitCostCents,
      };
    })),
    staffPunches: staffRows.map((row) => ({
      personId: row.techId,
      personName: personName(row.tech, row.techId),
      start: row.clockIn.toISOString(),
      end: (row.clockOut || now).toISOString(),
      totalMinutes: punchMinutes({
        clockIn: row.clockIn,
        clockOut: row.clockOut,
        hoursWorked: row.hoursWorked,
        breakMinutes: row.breakDuration,
      }, now),
    })),
    workPunches: workRows.map((row) => {
      const end = row.clockOut || now;
      const minutes = row.clockOut && typeof row.hoursSpent === 'number' && row.hoursSpent >= 0
        ? Math.round(row.hoursSpent * 60)
        : punchMinutes({ clockIn: row.clockIn, clockOut: row.clockOut }, now);
      return {
        personId: row.techId,
        personName: personName(row.tech, row.techId),
        start: row.clockIn.toISOString(),
        end: end.toISOString(),
        totalMinutes: minutes,
      };
    }),
    stockSnapshots,
  });
}
