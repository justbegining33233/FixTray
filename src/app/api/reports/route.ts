/**
 * GET /api/reports?shopId=xxx&year=2026&month=2
 *
 * Returns live report data for a shop for the given month.
 * Also upserts a ShopMonthlyReport snapshot if the month is in the past (frozen).
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  // Only shop owners, managers, and admins may view financial reports
  if (!['shop', 'manager', 'admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const shopId = request.nextUrl.searchParams.get('shopId') || '';
  const yearParam  = request.nextUrl.searchParams.get('year');
  const monthParam = request.nextUrl.searchParams.get('month');

  if (!shopId) {
    return NextResponse.json({ error: 'shopId is required' }, { status: 400 });
  }

  // Prevent IDOR: non-admins can only query their own shop
  if (auth.role !== 'superadmin') {
    const callerShopId = auth.role === 'shop' ? auth.id : auth.shopId;
    if (!callerShopId || shopId !== callerShopId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  }

  // Determine month/year to report on
  const now   = new Date();
  const year  = yearParam  ? parseInt(yearParam)  : now.getFullYear();
  const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1; // 1-12

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd   = new Date(year, month, 1); // exclusive

  try {
    // If month is in the past and we already have a frozen snapshot, return that
    const isPast = monthEnd <= now;
    if (isPast) {
      const snapshot = await prisma.shopMonthlyReport.findUnique({
        where: { shopId_year_month: { shopId, year, month } },
      });
      if (snapshot?.frozenAt) {
        const revenueByMonth = await buildMonthlyTrend(shopId, year);
        const techPerformance = await buildTechPerformance(shopId, monthStart, monthEnd);
        return NextResponse.json({
          success: true,
          source: 'snapshot',
          report: {
            year, month,
            totalRevenue:  snapshot.totalRevenue,
            totalJobs:     snapshot.totalJobs,
            completedJobs: snapshot.completedJobs,
            pendingJobs:   snapshot.pendingJobs,
            avgJobValue:   snapshot.avgJobValue,
            topServices:   (() => { try { return JSON.parse(snapshot.topServicesJson); } catch { return []; } })(),
            revenueByMonth,
            techPerformance,
          },
        });
      }
    }

    // Live calculation
    const workOrders = await prisma.workOrder.findMany({
      where: {
        shopId,
        createdAt: { gte: monthStart, lt: monthEnd },
      },
      include: {
        assignedTo: { select: { firstName: true, lastName: true } },
      },
    });

    const totalJobs     = workOrders.length;
    const completedJobs = workOrders.filter(w => w.status === 'closed').length;
    const pendingJobs   = workOrders.filter(w => !['closed', 'denied-estimate'].includes(w.status)).length;

    // Revenue = sum of amountPaid where paymentStatus === 'paid'
    const totalRevenue = workOrders.reduce((sum, wo) => {
      return sum + (wo.paymentStatus === 'paid' && wo.amountPaid ? wo.amountPaid : 0);
    }, 0);

    const avgJobValue = completedJobs > 0 ? totalRevenue / completedJobs : 0;

    // Top services: parse issueDescription for service labels
    const serviceCount: Record<string, { count: number; revenue: number }> = {};
    for (const wo of workOrders) {
      const desc = wo.issueDescription || '';
      const name = desc.split(/[,\n]/)[0].replace(/\[Recurring\]/, '').trim().substring(0, 40) || 'Other';
      if (!serviceCount[name]) serviceCount[name] = { count: 0, revenue: 0 };
      serviceCount[name].count += 1;
      serviceCount[name].revenue += (wo.paymentStatus === 'paid' && wo.amountPaid ? wo.amountPaid : 0);
    }
    const topServices = Object.entries(serviceCount)
      .map(([service, { count, revenue }]) => ({ service, jobs: count, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Tech performance for this month
    const techPerformance = await buildTechPerformance(shopId, monthStart, monthEnd);

    // Monthly trend (last 6 months)
    const revenueByMonth = await buildMonthlyTrend(shopId, year);

    // Save snapshot if month just ended (auto-freeze)
    if (isPast) {
      await prisma.shopMonthlyReport.upsert({
        where:  { shopId_year_month: { shopId, year, month } },
        create: {
          shopId, year, month,
          totalRevenue, totalJobs, completedJobs, pendingJobs, avgJobValue,
          topServicesJson: JSON.stringify(topServices),
          frozenAt: now,
        },
        update: {
          totalRevenue, totalJobs, completedJobs, pendingJobs, avgJobValue,
          topServicesJson: JSON.stringify(topServices),
          frozenAt: now,
        },
      });
    }

    return NextResponse.json({
      success: true,
      source: 'live',
      report: {
        year, month,
        totalRevenue, totalJobs, completedJobs, pendingJobs, avgJobValue,
        topServices,
        revenueByMonth,
        techPerformance,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Reports API] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function buildMonthlyTrend(shopId: string, year: number) {
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const start = new Date(year, m - 1, 1);
    const end   = new Date(year, m, 1);
    const wos   = await prisma.workOrder.findMany({
      where: { shopId, createdAt: { gte: start, lt: end } },
      select: { amountPaid: true, paymentStatus: true },
    });
    const revenue = wos.reduce((sum, wo) =>
      sum + (wo.paymentStatus === 'paid' && wo.amountPaid ? wo.amountPaid : 0), 0
    );
    months.push({
      month: start.toLocaleString('default', { month: 'short' }),
      revenue,
      jobs: wos.length,
    });
  }
  return months;
}

async function buildTechPerformance(shopId: string, monthStart: Date, monthEnd: Date) {
  const techs = await prisma.tech.findMany({
    where: { shopId },
    include: {
      assignedWorkOrders: {
        where: { shopId, createdAt: { gte: monthStart, lt: monthEnd } },
        select: { amountPaid: true, paymentStatus: true, status: true },
      },
    },
  });

  return techs
    .filter(t => t.assignedWorkOrders.length > 0)
    .map(t => {
      const jobs    = t.assignedWorkOrders.length;
      const revenue = t.assignedWorkOrders.reduce((sum: number, wo: { amountPaid: number | null; paymentStatus: string; status: string }) =>
        sum + (wo.paymentStatus === 'paid' && wo.amountPaid ? wo.amountPaid : 0), 0
      );
      return {
        id:      t.id,
        name:    `${t.firstName} ${t.lastName}`,
        jobs,
        revenue,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}
