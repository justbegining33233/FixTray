import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';

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

  const settings = await prisma.shopSettings.findUnique({ where: { shopId } });
  const _markup = settings?.inventoryMarkup || 0.3;

  const results = orders.map(wo => {
    const revenue = wo.estimatedCost || 0;
    // Estimate labor cost from time entries
    const laborHours = wo.timeEntries.reduce((sum, te) => sum + (te.hoursWorked || 0), 0);
    const laborRate = wo.assignedTo?.hourlyRate || 0;
    const laborCost = laborHours * laborRate;
    // Estimate parts cost from markup (partsUsed is a Json? field — already parsed by Prisma)
    const partsCost = wo.partsUsed ? (() => {
      const parts = wo.partsUsed as unknown;
      return Array.isArray(parts) ? parts.reduce((sum: number, p: { cost?: number; price?: number }) => sum + (p.cost || p.price || 0), 0) : 0;
    })() : 0;
    const totalCost = laborCost + partsCost;
    const grossProfit = revenue - totalCost;
    const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    return {
      id: wo.id,
      customer: `${wo.customer.firstName} ${wo.customer.lastName}`,
      tech: wo.assignedTo ? `${wo.assignedTo.firstName} ${wo.assignedTo.lastName}` : 'Unassigned',
      completedAt: wo.completedAt,
      revenue,
      laborCost: Math.round(laborCost * 100) / 100,
      partsCost: Math.round(partsCost * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      margin: Math.round(margin * 10) / 10,
      laborHours: Math.round(laborHours * 10) / 10,
    };
  });

  const totals = results.reduce((acc, r) => ({
    revenue: acc.revenue + r.revenue,
    cost: acc.cost + r.totalCost,
    profit: acc.profit + r.grossProfit,
  }), { revenue: 0, cost: 0, profit: 0 });

  return NextResponse.json({
    orders: results,
    summary: {
      count: results.length,
      totalRevenue: Math.round(totals.revenue * 100) / 100,
      totalCost: Math.round(totals.cost * 100) / 100,
      totalProfit: Math.round(totals.profit * 100) / 100,
      avgMargin: totals.revenue > 0 ? Math.round((totals.profit / totals.revenue) * 1000) / 10 : 0,
    },
  });
}
