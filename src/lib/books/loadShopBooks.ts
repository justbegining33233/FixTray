import prisma from '@/lib/prisma';
import { ensureProductionColumns } from '@/lib/ensureProductionColumns';
import { qbAccounts, SHOP_PAID_IN_FULL_COPY, QUICKBOOKS_OWNS_BOOKS_COPY, type QbLabor, type QbMap } from '@/lib/books/quickbooks';
import { QBO_SYNC_COPY } from '@/lib/books/qbo';
import { minutesFromHours } from '@/lib/books/clocks';
import { payableHours } from '@/lib/timesheetPeriod';
import {
  assembleShopJobs,
  centsToUsd,
  feeMovements,
  inMonth,
  inPersonFeeOwed,
  inPersonOwedReport,
  monthClose,
  platformFeeYear,
  shopLedger,
  shopReport,
  usdToCents,
  utcWeekRange,
  type BooksRow,
  type OrderInput,
} from '@/lib/books/money';
import { bpsFromPercent, linesFromWorkOrder, ticketPreview, ticketWasInvoiced } from '@/lib/books/parts';

function monthRange(month: string): { gte: Date; lt: Date } | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [year, mon] = month.split('-').map(Number);
  return {
    gte: new Date(Date.UTC(year, mon - 1, 1)),
    lt: new Date(Date.UTC(year, mon, 1)),
  };
}

async function savedQbMap(shopId: string): Promise<QbMap> {
  const config = await prisma.integrationConfig.findUnique({
    where: { shopId_provider: { shopId, provider: 'quickbooks' } },
    select: { settings: true },
  });
  if (!config?.settings) return qbAccounts(null);
  try {
    const parsed = JSON.parse(config.settings) as { qbMap?: Record<string, unknown> };
    return qbAccounts(parsed.qbMap || null);
  } catch {
    return qbAccounts(null);
  }
}

export async function saveQbMap(shopId: string, map: Record<string, unknown>): Promise<QbMap> {
  await ensureProductionColumns();
  const clean = qbAccounts(map);
  const existing = await prisma.integrationConfig.findUnique({
    where: { shopId_provider: { shopId, provider: 'quickbooks' } },
    select: { settings: true },
  });
  let settings: Record<string, unknown> = {};
  if (existing?.settings) {
    try {
      const parsed = JSON.parse(existing.settings) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') settings = parsed;
    } catch {
      settings = {};
    }
  }
  settings.qbMap = clean;
  const payload = JSON.stringify(settings);
  if (existing) {
    await prisma.integrationConfig.update({
      where: { shopId_provider: { shopId, provider: 'quickbooks' } },
      data: { settings: payload },
    });
  } else {
    await prisma.integrationConfig.create({
      data: { shopId, provider: 'quickbooks', enabled: false, settings: payload },
    });
  }
  return clean;
}

export async function loadShopLabor(shopId: string, month?: string | null): Promise<QbLabor[]> {
  const entries = await prisma.timeEntry.findMany({
    where: { shopId },
    select: { techId: true, clockIn: true, clockOut: true, hoursWorked: true, tech: { select: { hourlyRate: true } } },
  });
  const filtered = month ? entries.filter((entry) => inMonth(entry.clockIn, month)) : entries;
  const grouped = new Map<string, { entries: typeof filtered; rate: number }>();
  for (const entry of filtered) {
    const current = grouped.get(entry.techId) || { entries: [], rate: entry.tech?.hourlyRate || 0 };
    current.entries.push(entry);
    if (entry.tech?.hourlyRate) current.rate = entry.tech.hourlyRate;
    grouped.set(entry.techId, current);
  }
  return [...grouped.entries()].map(([personId, group]) => {
    const hours = payableHours(group.entries, { clockedIn: group.entries.some((entry) => !entry.clockOut) });
    return {
      personId,
      minutes: minutesFromHours(hours),
      hourlyRateCents: usdToCents(group.rate),
    };
  });
}

export async function loadShopBooks(shopId: string, month?: string | null) {
  await ensureProductionColumns();
  const range = month ? monthRange(month) : null;
  const orders = await prisma.workOrder.findMany({
    where: { shopId, ...(range ? { createdAt: range } : {}) },
    select: {
      id: true,
      shopId: true,
      estimatedCost: true,
      amountPaid: true,
      paymentStatus: true,
      status: true,
      createdAt: true,
      estimate: true,
      partsUsed: true,
      techLabor: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  const ids = orders.map((order) => order.id);
  const entries = ids.length === 0
    ? []
    : await prisma.booksEntry.findMany({
      where: { workOrderId: { in: ids } },
      orderBy: { createdAt: 'asc' },
    });
  const orderInputs: OrderInput[] = orders.map((order) => ({
    id: order.id,
    shopId: order.shopId,
    estimatedCost: order.estimatedCost,
    amountPaid: order.amountPaid,
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt,
  }));
  const booksRows: BooksRow[] = entries.map((entry) => ({
    id: entry.id,
    workOrderId: entry.workOrderId,
    shopId: entry.shopId,
    kind: entry.kind,
    appliesTo: entry.appliesTo,
    amountCents: entry.amountCents,
    status: entry.status,
    sourceId: entry.sourceId,
    depositAt: entry.depositAt,
    createdAt: entry.createdAt,
  }));
  const jobs = assembleShopJobs(orderInputs, booksRows);
  const ledger = shopLedger(jobs);
  const report = shopReport(ledger);
  const close = monthClose(jobs);
  const taxRule = await prisma.taxRule.findFirst({
    where: { shopId, active: true },
    orderBy: { updatedAt: 'desc' },
  });
  const rule = {
    rateBps: bpsFromPercent(taxRule?.rate || 0),
    appliesToLabor: taxRule?.appliesToLabor === true,
    appliesToParts: taxRule ? taxRule.appliesToParts !== false : true,
    appliesToShopFees: taxRule?.appliesToFees === true,
  };
  const tickets = orders.map((order) => {
    const job = jobs.find((item) => item.id === order.id);
    const lines = linesFromWorkOrder({
      estimate: order.estimate,
      partsUsed: order.partsUsed,
      techLabor: order.techLabor,
    });
    return {
      workOrderId: order.id,
      partCents: lines.filter((line) => line.kind === 'part').reduce((sum, line) => sum + line.amountCents, 0),
      ...ticketPreview({
        lines,
        rule,
        paidJobCents: job?.shopReceivedCents || 0,
        standing: job?.standing || 'unpaid',
        storedEstimateCents: order.estimatedCost != null ? usdToCents(order.estimatedCost) : null,
        invoiced: ticketWasInvoiced(order.status, order.paymentStatus),
      }),
    };
  });
  const stock = await prisma.inventoryStock.findMany({
    where: { shopId },
    orderBy: { itemName: 'asc' },
    select: { id: true, itemName: true, sku: true, quantity: true, unitCost: true, sellingPrice: true },
  });
  return {
    copy: SHOP_PAID_IN_FULL_COPY,
    quickBooksOwnsBooks: QUICKBOOKS_OWNS_BOOKS_COPY,
    quickBooksSync: QBO_SYNC_COPY,
    month: month || null,
    ledger,
    report,
    monthClose: close,
    tickets,
    inventory: stock.map((item) => ({
      id: item.id,
      name: item.itemName,
      sku: item.sku,
      onHand: item.quantity,
      unitCostCents: usdToCents(item.unitCost),
      sellUnitCents: usdToCents(item.sellingPrice),
    })),
    qbMap: await savedQbMap(shopId),
    reversals: booksRows
      .filter((row) => row.kind === 'refund' || row.kind === 'chargeback')
      .map((row) => ({
        id: row.id,
        workOrderId: row.workOrderId,
        appliesTo: row.appliesTo === 'fee' ? 'fee' as const : 'job' as const,
        kind: row.kind === 'chargeback' ? 'chargeback' as const : 'refund' as const,
        amountCents: row.amountCents,
        at: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt || ''),
        status: row.status,
      })),
    feeYearExcluded: true,
    shopReceivedUsd: centsToUsd(ledger.shopReceivedCents),
    fixtrayOwed: {
      ...inPersonFeeOwed(booksRows),
      week: inPersonFeeOwed(booksRows, utcWeekRange(new Date())),
      weekLabel: utcWeekRange(new Date()).label,
    },
  };
}

export async function loadPlatformFeeYear(month?: string | null) {
  await ensureProductionColumns();
  const range = month ? monthRange(month) : null;
  const orders = await prisma.workOrder.findMany({
    where: range ? { createdAt: range } : {},
    select: {
      id: true,
      shopId: true,
      estimatedCost: true,
      amountPaid: true,
      paymentStatus: true,
      createdAt: true,
      shop: { select: { shopName: true } },
    },
  });
  const ids = orders.map((order) => order.id);
  const entries = ids.length === 0
    ? []
    : await prisma.booksEntry.findMany({ where: { workOrderId: { in: ids } } });
  const filteredOrders = orders.filter((order) => !month || inMonth(order.createdAt, month));
  const year = platformFeeYear(feeMovements(filteredOrders, entries.map((entry) => ({
    id: entry.id,
    workOrderId: entry.workOrderId,
    kind: entry.kind,
    appliesTo: entry.appliesTo,
    amountCents: entry.amountCents,
    status: entry.status,
    sourceId: entry.sourceId,
    note: entry.note,
    createdAt: entry.createdAt,
  }))));
  const names = new Map(orders.map((order) => [order.shopId, order.shop?.shopName || order.shopId]));
  const owedRows = entries.map((entry) => ({
    id: entry.id,
    workOrderId: entry.workOrderId,
    shopId: entry.shopId,
    kind: entry.kind,
    appliesTo: entry.appliesTo,
    amountCents: entry.amountCents,
    status: entry.status,
    createdAt: entry.createdAt,
  }));
  const week = utcWeekRange(new Date());
  const owedReport = inPersonOwedReport(
    orders.map((order) => ({ id: order.id, shopId: order.shopId })),
    owedRows,
    week,
  );
  const owedByShop = new Map(owedReport.byShop.map((shop) => [shop.shopId, shop]));
  const seen = new Set(year.perShop.map((row) => row.shopId));
  const perShop = [
    ...year.perShop.map((row) => {
      const owed = owedByShop.get(row.shopId);
      return {
        ...row,
        shopName: names.get(row.shopId) || row.shopId,
        inPersonOwedCents: owed?.owedCents || 0,
        inPersonLines: (owed?.lines || []).map((line) => ({
          workOrderId: line.workOrderId,
          feeCents: line.feeCents,
          at: line.at,
        })),
      };
    }),
    ...owedReport.byShop
      .filter((shop) => !seen.has(shop.shopId) && shop.lines.length > 0)
      .map((shop) => ({
        shopId: shop.shopId,
        shopName: names.get(shop.shopId) || shop.shopId,
        collectedCents: 0,
        refundedCents: 0,
        netCents: 0,
        inPersonOwedCents: shop.owedCents,
        inPersonLines: shop.lines.map((line) => ({
          workOrderId: line.workOrderId,
          feeCents: line.feeCents,
          at: line.at,
        })),
        })),
  ].sort((a, b) => a.shopId.localeCompare(b.shopId));
  return {
    ...year,
    perShop,
    inPersonOwedCents: owedReport.owedCents,
    inPersonLines: owedReport.lines.map((line) => ({
      shopId: line.shopId,
      shopName: names.get(line.shopId) || line.shopId,
      workOrderId: line.workOrderId,
      feeCents: line.feeCents,
      at: line.at,
    })),
    weekLabel: week.label,
    shopRevenueIncluded: false,
  };
}

export async function findShopJob(shopId: string, workOrderId: string) {
  const loaded = await loadShopBooks(shopId);
  return loaded.ledger.jobs.find((job) => job.id === workOrderId) || null;
}
