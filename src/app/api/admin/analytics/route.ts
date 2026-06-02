import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // Run all queries in parallel for performance
    const [
      totalWorkOrders,
      statusCounts,
      totalShops,
      totalTechs,
      totalCustomers,
      recentWorkOrders,
      recentActivities,
    ] = await Promise.all([
      prisma.workOrder.count(),
      prisma.workOrder.groupBy({ by: ['status'], _count: { status: true } }),
      prisma.shop.count({ where: { status: 'approved' } }),
      prisma.tech.count(),
      prisma.customer.count(),
      // Fetch the last 6 months of work orders for trend data
      prisma.workOrder.findMany({
        where: { createdAt: { gte: sixMonthsAgo } },
        select: { createdAt: true, status: true, amountPaid: true, paymentStatus: true, assignedTo: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.activityLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, action: true, user: true, details: true, type: true, severity: true, createdAt: true },
      }),
    ]);

    // Build monthly buckets for the last 6 months
    const monthBuckets: Record<string, { jobs: number; revenue: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthBuckets[`${d.getFullYear()}-${d.getMonth()}`] = { jobs: 0, revenue: 0 };
    }

    for (const wo of recentWorkOrders) {
      const key = `${wo.createdAt.getFullYear()}-${wo.createdAt.getMonth()}`;
      if (key in monthBuckets) {
        monthBuckets[key].jobs += 1;
        if (wo.paymentStatus === 'paid' && wo.amountPaid) {
          monthBuckets[key].revenue += wo.amountPaid;
        }
      }
    }

    // Also count all paid work orders for total revenue (not just last 6 months)
    const allPaidRevenue = await prisma.workOrder.aggregate({
      _sum: { amountPaid: true },
      where: { paymentStatus: 'paid' },
    });
    const grandTotalRevenue = allPaidRevenue._sum.amountPaid ?? 0;

    const revenue = Object.entries(monthBuckets).map(([key, val]) => {
      const [, month] = key.split('-').map(Number);
      return { month: MONTH_NAMES[month], amount: val.revenue };
    });

    const monthlyTrends = Object.entries(monthBuckets).map(([key, val]) => {
      const [, month] = key.split('-').map(Number);
      return { month: MONTH_NAMES[month], jobs: val.jobs, revenue: val.revenue };
    });

    // Status distribution
    const statusDistribution = statusCounts.map(s => ({
      status: s.status.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      count: s._count.status,
    }));

    const completedWorkOrders = statusCounts.find(s => s.status === 'closed')?._count?.status ?? 0;
    const pendingWorkOrders = statusCounts.find(s => s.status === 'pending')?._count?.status ?? 0;
    const inProgressWorkOrders = statusCounts.find(s => s.status === 'in-progress')?._count?.status ?? 0;

    return NextResponse.json({
      // Summary KPIs
      totalWorkOrders,
      completedWorkOrders,
      pendingWorkOrders,
      inProgressWorkOrders,
      totalRevenue: grandTotalRevenue,
      totalShops,
      totalTechs,
      totalCustomers,
      // Chart data
      revenue,
      monthlyTrends,
      statusDistribution,
      // Activity
      recentActivities,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Admin/Analytics] DB error:', msg);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
