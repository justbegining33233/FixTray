import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { slaComplianceRate as computeSlaComplianceRate } from '@/lib/slaMetrics';
import { allocateTechRevenue } from '@/lib/books/floor';
import { addDays, dayKey, shopDateSpan } from '@/lib/books/periods';
import { shopTimeZone } from '@/lib/books/loadTruth';
import { civilInRange } from '@/lib/books/truth';
import { operatingShopWhere } from '@/lib/shopAccountStatus';

// GET /api/analytics/employee-performance ΓÇö cross-shop tech performance stats
export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get('days') || '30'), 365);

    // Determine which shops to include
    let shopIds: string[] = [];
    if (auth.role === 'superadmin') {
      const shopIdParam = searchParams.get('shopId');
      if (shopIdParam) {
        shopIds = [shopIdParam];
      } else {
        const allShops = await prisma.shop.findMany({ where: operatingShopWhere(), select: { id: true } });
        shopIds = allShops.map(s => s.id);
      }
    } else if (auth.role === 'shop') {
      // Multi-shop owner: find all shops with same email
      const currentShop = await prisma.shop.findUnique({ where: { id: auth.id }, select: { email: true } });
      if (currentShop) {
        const owned = await prisma.shop.findMany({ where: { AND: [{ email: currentShop.email }, operatingShopWhere()] }, select: { id: true } });
        shopIds = owned.map(s => s.id);
      }
    } else {
      shopIds = auth.shopId ? [auth.shopId] : [];
    }

    if (shopIds.length === 0) {
      return NextResponse.json({ techPerformance: [] });
    }
    const zone = shopIds.length === 1 ? await shopTimeZone(shopIds[0]) : 'America/New_York';
    const endDay = dayKey(new Date(), zone);
    const startDay = addDays(endDay, -(days - 1));
    const span = shopDateSpan(startDay, endDay, zone);
    const since = new Date(span.start.getTime() - 24 * 60 * 60 * 1000);

    // Fetch all techs across those shops
    const techs = await prisma.tech.findMany({
      where: { shopId: { in: shopIds } },
      select: { id: true, firstName: true, lastName: true, shopId: true, shop: { select: { shopName: true } } },
    });

    // Fetch completed work orders
    const workOrders = await prisma.workOrder.findMany({
      where: {
        shopId: { in: shopIds },
        assignedTechId: { not: null },
        createdAt: { gte: since },
      },
      select: {
        assignedTechId: true,
        shopId: true,
        status: true,
        createdAt: true,
        completedAt: true,
        dueDate: true,
        amountPaid: true,
        estimatedCost: true,
      },
    });

    // Fetch time entries for hours worked
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        shopId: { in: shopIds },
        clockIn: { gte: since },
        clockOut: { not: null },
      },
      select: { techId: true, hoursWorked: true },
    });

    const hoursMap = new Map<string, number>();
    for (const te of timeEntries) {
      hoursMap.set(te.techId, (hoursMap.get(te.techId) || 0) + (te.hoursWorked || 0));
    }

    // Aggregate per-tech
    const techMap = new Map<string, {
      name: string; shopName: string; shopId: string;
      completed: number; total: number; onTime: number; withDueDate: number; revenue: number;
    }>();

    for (const tech of techs) {
      techMap.set(tech.id, {
        name: `${tech.firstName} ${tech.lastName}`,
        shopName: tech.shop.shopName,
        shopId: tech.shopId,
        completed: 0, total: 0, onTime: 0, withDueDate: 0, revenue: 0,
      });
    }

    for (const wo of workOrders) {
      if (!wo.assignedTechId) continue;
      const entry = techMap.get(wo.assignedTechId);
      if (!entry) continue;
      entry.total++;
      if (['closed', 'completed', 'Completed'].includes(wo.status)) {
        entry.completed++;
        if (wo.dueDate && wo.completedAt) {
          entry.withDueDate++;
          if (new Date(wo.completedAt) <= new Date(wo.dueDate)) entry.onTime++;
        }
      }
    }

    const paymentRows = await prisma.booksEntry.findMany({
      where: {
        shopId: { in: shopIds },
        appliesTo: 'job',
        kind: { in: ['card_payment', 'job_payment'] },
        status: { not: 'open' },
        createdAt: { gte: since, lt: span.end },
      },
      select: { workOrderId: true, amountCents: true, createdAt: true },
    });
    const inPeriod = paymentRows.filter((row) => civilInRange(row.createdAt.toISOString(), span.start, span.end, zone));
    const paymentOrders = inPeriod.length === 0 ? [] : await prisma.workOrder.findMany({
      where: { id: { in: [...new Set(inPeriod.map((row) => row.workOrderId))] } },
      select: { id: true, assignedTechId: true },
    });
    const techByOrder = new Map(paymentOrders.map((order) => [order.id, order.assignedTechId]));
    const revenueByTech = new Map(allocateTechRevenue(inPeriod.map((row) => ({
      techId: techByOrder.get(row.workOrderId),
      cents: row.amountCents,
    }))).map((row) => [row.techId, row.revenueCents]));

    const techPerformance = Array.from(techMap.entries()).map(([techId, data]) => ({
      techId,
      name: data.name,
      shopName: data.shopName,
      shopId: data.shopId,
      totalJobs: data.total,
      completedJobs: data.completed,
      completionRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      slaComplianceRate: computeSlaComplianceRate(data.onTime, data.withDueDate),
      revenue: Math.round((revenueByTech.get(techId) || 0)) / 100,
      hoursWorked: Math.round((hoursMap.get(techId) || 0) * 10) / 10,
      revenuePerHour: (hoursMap.get(techId) || 0) > 0
        ? Math.round(((revenueByTech.get(techId) || 0) / 100) / (hoursMap.get(techId) || 1) * 100) / 100
        : 0,
    })).sort((a, b) => b.completedJobs - a.completedJobs);

    const visible = auth.role === 'manager'
      ? techPerformance.map(({ revenue: _revenue, revenuePerHour: _revenuePerHour, ...row }) => row)
      : techPerformance;
    return NextResponse.json({
      period: { days, since: since.toISOString() },
      shopsIncluded: shopIds.length,
      techPerformance: visible,
    });
  } catch (error) {
    console.error('Error fetching employee performance:', error);
    return NextResponse.json({ error: 'Failed to fetch performance data' }, { status: 500 });
  }
}
