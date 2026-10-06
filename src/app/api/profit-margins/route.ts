import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';
import { jobProfit, reorderAlerts, techProductivity } from '@/lib/books/floor';

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role === 'manager') {
    return NextResponse.json({ error: 'Shop income is not available to managers.' }, { status: 403 });
  }
  const shopId = auth.role === 'shop' ? auth.id : (auth as any).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get('days') || 30);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const orders = await prisma.workOrder.findMany({
    where: {
      shopId,
      status: { in: ['closed', 'completed'] },
      completedAt: { gte: since },
    },
    include: {
      assignedTo: { select: { firstName: true, lastName: true, hourlyRate: true } },
      timeEntries: true,
      customer: { select: { firstName: true, lastName: true } },
    },
    orderBy: { completedAt: 'desc' },
  });

  const results = orders.map(wo => {
    const revenueCents = Math.round((wo.estimatedCost || 0) * 100);
    const laborMinutes = Math.round(wo.timeEntries.reduce((sum, te) => sum + (te.hoursWorked || 0), 0) * 60);
    const partsCostCents = wo.partsUsed ? (() => {
      const parts = wo.partsUsed as unknown;
      if (!Array.isArray(parts)) return 0;
      return parts.reduce((sum: number, p: { cost?: number }) => sum + Math.round((p.cost || 0) * 100), 0);
    })() : 0;
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
      customer: `${wo.customer.firstName} ${wo.customer.lastName}`,
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
  const revenueAll = results.reduce((sum, row) => sum + row.revenue, 0);
  const [clocks, billed, stock] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { shopId, clockIn: { gte: since } },
      select: { techId: true, hoursWorked: true, clockIn: true, clockOut: true },
    }),
    prisma.workOrderTimeEntry.findMany({
      where: { shopId, clockIn: { gte: since } },
      select: { techId: true, hoursSpent: true },
    }),
    prisma.inventoryItem.findMany({
      where: { shopId },
      select: { id: true, name: true, sku: true, quantity: true, reorderPoint: true, price: true, costCents: true },
    }),
  ]);
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
  });
}
