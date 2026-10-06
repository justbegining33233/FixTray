import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';
import { allocateTechRevenue, closedJobLaborMinutes, jobProfit, partsCostFromUsage, reorderAlerts, techProductivity } from '@/lib/books/floor';
import { usdToCents } from '@/lib/books/money';
import { addDays, dayKey, shopDateSpan } from '@/lib/books/periods';
import { loadShopFacts, shopTimeZone } from '@/lib/books/loadTruth';
import { civilInRange, rangeSnapshot } from '@/lib/books/truth';

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role === 'manager' || (auth.role !== 'shop' && auth.role !== 'accountant' && auth.role !== 'admin' && auth.role !== 'superadmin')) {
    return NextResponse.json({ error: 'Shop income is not available to managers.' }, { status: 403 });
  }
  const shopId = auth.role === 'shop' ? auth.id : (auth as any).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get('days') || 30);
  const zone = await shopTimeZone(shopId);
  const endDay = dayKey(new Date(), zone);
  const startDay = addDays(endDay, -(Math.max(1, days) - 1));
  const span = shopDateSpan(startDay, endDay, zone);
  const since = span.start;
  const facts = await loadShopFacts(shopId);
  const snap = rangeSnapshot(facts, span.start, span.end, zone);
  const paidByJob = new Map<string, number>();
  for (const job of facts) {
    let paid = 0;
    for (const event of job.events) {
      if (event.kind !== 'payment' || !civilInRange(event.at, span.start, span.end, zone)) continue;
      paid += Math.round(event.cents);
    }
    if (paid > 0) paidByJob.set(job.id, paid);
  }

  const paidIds = [...paidByJob.keys()];
  const orders = paidIds.length === 0 ? [] : await prisma.workOrder.findMany({
    where: { shopId, id: { in: paidIds } },
    include: {
      assignedTo: { select: { id: true, firstName: true, lastName: true, hourlyRate: true } },
      workOrderTimeEntries: { select: { clockIn: true, clockOut: true, hoursSpent: true } },
      customer: { select: { firstName: true, lastName: true } },
    },
    orderBy: { completedAt: 'desc' },
  });
  const [items, stockRows] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { shopId },
      select: { id: true, sku: true, costCents: true, name: true, quantity: true, reorderPoint: true, price: true },
    }),
    prisma.inventoryStock.findMany({
      where: { shopId },
      select: { id: true, sku: true, unitCost: true },
    }),
  ]);
  const catalog = [
    ...stockRows.map((item) => ({ id: item.id, sku: item.sku, costCents: usdToCents(item.unitCost) })),
    ...items.map((item) => ({ id: item.id, sku: item.sku, costCents: item.costCents })),
  ];

  const results = orders.map(wo => {
    const revenueCents = paidByJob.get(wo.id) || 0;
    const laborMinutes = closedJobLaborMinutes(wo.workOrderTimeEntries);
    const partsCostCents = partsCostFromUsage({ partsUsed: wo.partsUsed, catalog });
    const rateCents = wo.assignedTo && wo.assignedTo.hourlyRate > 0 ? Math.round(wo.assignedTo.hourlyRate * 100) : null;
    const profit = jobProfit({
      workOrderId: wo.id,
      revenueCents,
      partsCostCents,
      laborMinutes,
      hourlyRateCents: rateCents,
    });
    const revenue = revenueCents / 100;
    const laborCost = profit.laborCostCents / 100;
    const partsCost = profit.partsCostCents / 100;
    const totalCost = laborCost + partsCost;
    const grossProfit = profit.profitCents == null ? null : profit.profitCents / 100;
    const margin = profit.profitCents == null || revenue <= 0 ? null : (profit.profitCents / revenueCents) * 100;

    return {
      id: wo.id,
      customer: wo.customer ? `${wo.customer.firstName} ${wo.customer.lastName}` : 'Unknown',
      tech: wo.assignedTo ? `${wo.assignedTo.firstName} ${wo.assignedTo.lastName}` : 'Unassigned',
      completedAt: wo.completedAt,
      revenue,
      laborCost: Math.round(laborCost * 100) / 100,
      partsCost: Math.round(partsCost * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      grossProfit: grossProfit == null ? null : Math.round(grossProfit * 100) / 100,
      margin: margin == null ? null : Math.round(margin * 10) / 10,
      laborHours: Math.round(laborMinutes / 6) / 10,
      rateNote: profit.rateNote,
    };
  });

  const priced = results.filter((row) => row.grossProfit != null);
  const totals = priced.reduce((acc, r) => ({
    revenue: acc.revenue + r.revenue,
    cost: acc.cost + r.totalCost,
    profit: acc.profit + (r.grossProfit || 0),
  }), { revenue: 0, cost: 0, profit: 0 });
  const revenueAll = snap.revenueCents / 100;
  const [clocks, billed] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { shopId, clockIn: { gte: since }, clockOut: { not: null } },
      select: { techId: true, hoursWorked: true, clockIn: true, clockOut: true },
    }),
    prisma.workOrderTimeEntry.findMany({
      where: { shopId, clockIn: { gte: since } },
      select: { techId: true, hoursSpent: true },
    }),
  ]);
  const stock = items;
  const productivity = techProductivity([
    ...clocks.map((row) => ({
      personId: row.techId,
      clockedMinutes: Math.round((row.hoursWorked || 0) * 60),
      billedMinutes: 0,
    })),
    ...billed.map((row) => ({
      personId: row.techId,
      clockedMinutes: 0,
      billedMinutes: Math.round((row.hoursSpent || 0) * 60),
    })),
  ]);
  const reorder = reorderAlerts(stock.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    reorderPoint: item.reorderPoint,
    workOrderIds: orders
      .filter((order) => {
        const blob = JSON.stringify(order.partsUsed || '');
        return blob.includes(item.id) || (item.sku ? blob.includes(item.sku) : false);
      })
      .map((order) => order.id),
  })));
  const partMargins = stock.map((item) => ({
    id: item.id,
    name: item.name,
    costCents: item.costCents,
    sellCents: Math.round((item.price || 0) * 100),
  }));

  return NextResponse.json({
    orders: results,
    summary: {
      count: results.length,
      totalRevenue: Math.round(revenueAll * 100) / 100,
      totalCost: Math.round(totals.cost * 100) / 100,
      totalProfit: Math.round(totals.profit * 100) / 100,
      avgMargin: totals.revenue > 0 ? Math.round((totals.profit / totals.revenue) * 1000) / 10 : 0,
      ratesMissing: results.filter((row) => row.rateNote).length,
    },
    productivity,
    reorder,
    partMargins,
    techRevenue: allocateTechRevenue(orders.map((order) => ({
      techId: order.assignedTo?.id || null,
      cents: paidByJob.get(order.id) || 0,
    }))),
    basis: 'Shop payments in these dates. The FixTray fee is not included.',
    from: startDay,
    to: endDay,
  });
}
