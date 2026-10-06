import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { dayKey, shopDateSpan } from '@/lib/books/periods';
import { loadShopFacts, shopTimeZone } from '@/lib/books/loadTruth';
import { rangeSnapshot } from '@/lib/books/truth';

export async function GET(request: NextRequest) {
  // Require authenticated role for analytics.
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (auth.role !== 'superadmin' && auth.role !== 'shop' && auth.role !== 'manager') {
    return NextResponse.json({ error: 'Unauthorized - Superadmin, Shop, or Manager access only' }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const requestedShopId = url.searchParams.get('shopId') || undefined;
    const startDateParam = url.searchParams.get('startDate');
    const endDateParam = url.searchParams.get('endDate');

    const shopZoneId = auth.role === 'shop' ? (auth.shopId || auth.id) : auth.role === 'manager' ? auth.shopId : requestedShopId;
    const zone = shopZoneId ? await shopTimeZone(shopZoneId) : 'America/New_York';
    const hasDay = (value: string | null) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
    const span = hasDay(startDateParam) && hasDay(endDateParam)
      ? shopDateSpan(startDateParam as string, endDateParam as string, zone)
      : null;

    // Build where clause with strict auth-scoping.
    // Shop and manager roles are always locked to their own shop.
    const where: Record<string, unknown> = {};

    if (auth.role === 'shop') {
      where.shopId = auth.shopId || auth.id;
    } else if (auth.role === 'manager') {
      if (!auth.shopId) {
        return NextResponse.json({ error: 'Manager account has no shop scope' }, { status: 400 });
      }
      where.shopId = auth.shopId;
    } else if (requestedShopId) {
      where.shopId = requestedShopId;
    }

    if (span) {
      where.OR = [
        { completedAt: { gte: span.start, lt: span.end } },
        { createdAt: { gte: span.start, lt: span.end } },
      ];
    }

    const workOrders = await prisma.workOrder.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Calculate summary stats
    const closedOrders = workOrders.filter(wo => wo.status === 'closed');
    const inProgressOrders = workOrders.filter(wo => wo.status === 'in-progress');
    const pendingOrders = workOrders.filter(wo => wo.status === 'pending');

    const scopedShop = typeof where.shopId === 'string' ? where.shopId : '';
    const facts = scopedShop ? await loadShopFacts(scopedShop) : [];
    const snap = span && facts.length >= 0
      ? rangeSnapshot(facts, span.start, span.end, zone)
      : null;
    const totalRevenue = snap ? snap.revenueCents / 100 : closedOrders.reduce((sum, wo) => sum + (wo.estimatedCost || 0), 0);
    const completedInRange = snap ? snap.completedCount : closedOrders.length;
    const averageJobValue = closedOrders.length > 0 ? totalRevenue / closedOrders.length : 0;

    // Completion time
    const completionTimes = closedOrders
      .filter(wo => wo.createdAt && wo.updatedAt)
      .map(wo => {
        const created = new Date(wo.createdAt).getTime();
        const updated = new Date(wo.updatedAt).getTime();
        return (updated - created) / (1000 * 60 * 60);
      });
    const avgCompletionTime = completionTimes.length > 0 
      ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length 
      : 0;

    const uniqueCustomers = new Set(workOrders.map((wo) => wo.customerId).filter(Boolean)).size;

    // Tech performance
    const techPerformance: Record<string, { completed: number; totalRevenue: number; avgTime: number }> = {};
    closedOrders.forEach(wo => {
      const techName = wo.assignedTo ? `${wo.assignedTo.firstName} ${wo.assignedTo.lastName}` : 'Unassigned';
      if (!techPerformance[techName]) {
        techPerformance[techName] = { completed: 0, totalRevenue: 0, avgTime: 0 };
      }
      techPerformance[techName].completed++;
      const est = wo.estimate as Record<string, unknown> | null;
      techPerformance[techName].totalRevenue += Number(est?.amount) || wo.estimatedCost || 0;
    });

    // Calculate average time per tech
    Object.keys(techPerformance).forEach(tech => {
      const techOrders = closedOrders.filter(wo => {
        const name = wo.assignedTo ? `${wo.assignedTo.firstName} ${wo.assignedTo.lastName}` : 'Unassigned';
        return name === tech;
      });
      const times = techOrders
        .filter(wo => wo.createdAt && wo.updatedAt)
        .map(wo => {
          const created = new Date(wo.createdAt).getTime();
          const updated = new Date(wo.updatedAt).getTime();
          return (updated - created) / (1000 * 60 * 60);
        });
      techPerformance[tech].avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    });

    // SLA compliance - use dueDate as promised completion.
    const slaCompliant = closedOrders.filter(wo => {
      if (!wo.dueDate) return false;
      const promised = new Date(wo.dueDate).getTime();
      const actual = new Date(wo.updatedAt).getTime();
      return actual <= promised;
    }).length;

    // Build chart data by day.
    const revenueByDate: Record<string, number> = {};
    const completionByDate: Record<string, { sum: number; count: number }> = {};

    if (snap) {
      for (const job of facts) {
        for (const event of job.events) {
          if (event.kind !== 'payment' && event.kind !== 'refund' && event.kind !== 'chargeback') continue;
          const when = new Date(event.at);
          if (span && (when < span.start || when >= span.end)) continue;
          const day = dayKey(when, zone);
          const signed = event.kind === 'payment' ? event.cents : -event.cents;
          revenueByDate[day] = (revenueByDate[day] || 0) + signed / 100;
        }
      }
    }
    closedOrders.forEach((wo) => {
      const day = dayKey(new Date(wo.completedAt || wo.updatedAt), zone);

      const created = new Date(wo.createdAt).getTime();
      const updated = new Date(wo.updatedAt).getTime();
      const hours = (updated - created) / (1000 * 60 * 60);
      if (!completionByDate[day]) completionByDate[day] = { sum: 0, count: 0 };
      completionByDate[day].sum += hours;
      completionByDate[day].count += 1;
    });

    const revenueChart = Object.entries(revenueByDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({ date, revenue: Number(revenue.toFixed(2)) }));

    const completionChart = Object.entries(completionByDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({ date, hours: Number((stats.sum / stats.count).toFixed(2)) }));

    const techPerformanceChart = Object.entries(techPerformance).map(([name, stats]) => ({
      name,
      completed: stats.completed,
      revenue: Number(stats.totalRevenue.toFixed(2)),
      avgTime: Number(stats.avgTime.toFixed(2)),
    }));

    const payload = {
      summary: {
        totalOrders: workOrders.length,
        completedJobs: completedInRange,
        inProgressOrders: inProgressOrders.length,
        pendingOrders: pendingOrders.length,
        totalRevenue,
        averageJobValue,
        avgCompletionTime: Number(avgCompletionTime.toFixed(1)),
        uniqueCustomers,
        slaCompliance: closedOrders.length > 0 ? ((slaCompliant / closedOrders.length) * 100).toFixed(1) : 'N/A',
      },
      charts: {
        revenue: revenueChart,
        completion: completionChart,
        techPerformance: techPerformanceChart,
      },
      techPerformance: techPerformanceChart,
      completionTimeDistribution: {
        under24h: completionTimes.filter(t => t < 24).length,
        under48h: completionTimes.filter(t => t >= 24 && t < 48).length,
        under1week: completionTimes.filter(t => t >= 48 && t < 168).length,
        over1week: completionTimes.filter(t => t >= 168).length,
      }
    };
    if (auth.role === 'manager') {
      payload.summary.totalRevenue = 0;
      payload.summary.averageJobValue = 0;
      payload.charts.revenue = [];
      payload.charts.techPerformance = payload.charts.techPerformance.map((row) => ({ ...row, revenue: 0 }));
      payload.techPerformance = payload.techPerformance.map((row) => ({ ...row, revenue: 0 }));
    }
    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error calculating analytics:', error);
    return NextResponse.json({ error: 'Failed to calculate analytics' }, { status: 500 });
  }
}
