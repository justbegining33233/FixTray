import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

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

    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    const hasValidStart = !!startDate && !Number.isNaN(startDate.getTime());
    const hasValidEnd = !!endDate && !Number.isNaN(endDate.getTime());

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

    if (hasValidStart || hasValidEnd) {
      where.createdAt = {
        ...(hasValidStart ? { gte: startDate } : {}),
        ...(hasValidEnd ? { lte: endDate } : {}),
      };
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

    // Revenue from closed orders.
    const totalRevenue = closedOrders.reduce((sum, wo) => {
      const est = wo.estimate as Record<string, unknown> | null;
      return sum + (Number(est?.amount) || wo.estimatedCost || 0);
    }, 0);
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

    closedOrders.forEach((wo) => {
      const day = new Date(wo.updatedAt).toISOString().slice(0, 10);
      const est = wo.estimate as Record<string, unknown> | null;
      const revenue = Number(est?.amount) || wo.estimatedCost || 0;
      revenueByDate[day] = (revenueByDate[day] || 0) + revenue;

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

    return NextResponse.json({
      summary: {
        totalOrders: workOrders.length,
        completedJobs: closedOrders.length,
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
    });
  } catch (error) {
    console.error('Error calculating analytics:', error);
    return NextResponse.json({ error: 'Failed to calculate analytics' }, { status: 500 });
  }
}
