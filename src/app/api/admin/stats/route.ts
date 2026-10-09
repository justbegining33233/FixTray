import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { headlinePaidMonth } from '@/lib/platformRevenue';
import { managedUserTotal } from '@/lib/platformUserCensus';
import { countApprovedShops, isApprovedShop } from '@/lib/shopCensus';

function formatCurrency(value: number) {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const trendWindowStart = new Date(now);
    trendWindowStart.setDate(trendWindowStart.getDate() - 6);
    trendWindowStart.setHours(0, 0, 0, 0);

    const weekStarts = Array.from({ length: 4 }, (_, index) => {
      const weekStart = new Date(startOfWeek);
      weekStart.setDate(startOfWeek.getDate() - (3 - index) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      return { weekStart, weekEnd, label: `W${index + 1}` };
    });
    const oldestWeekStart = weekStarts[0].weekStart;

    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const [
      shopStatusRows,
      pendingShops,
      totalJobs,
      paidWorkOrders,
      recentWorkOrders,
      pageViews,
      recentErrorLogs,
      weeklyNewClients,
      newClientsLast3Months,
      paidWorkOrdersLast3Months,
      reviewsCount,
      avgRating,
      revenueLastMonth,
      paidWorkOrdersForTrend,
      approvedShopsForWeeklyTrend,
      activeRefreshSessions,
      customerCount,
      shopMemberCount,
      shopCount,
      staffCount,
    ] = await Promise.all([
      prisma.shop.findMany({ select: { status: true } }),
      prisma.shop.count({ where: { status: 'pending' } }),
      prisma.workOrder.count(),
      prisma.workOrder.findMany({ where: { paymentStatus: 'paid' }, select: { amountPaid: true, createdAt: true } }),
      prisma.workOrder.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { firstName: true, lastName: true } },
          shop: { select: { shopName: true } },
        },
      }),
      prisma.pageView.count(),
      prisma.activityLog.count({
        where: {
          createdAt: { gte: thirtyDaysAgo },
          severity: { in: ['error', 'critical'] },
        },
      }),
      prisma.shop.findMany({
        where: { createdAt: { gte: startOfWeek, lte: endOfWeek } },
        select: { createdAt: true },
      }),
      prisma.shop.count({ where: { createdAt: { gte: threeMonthsAgo } } }),
      prisma.workOrder.findMany({
        where: { paymentStatus: 'paid', createdAt: { gte: threeMonthsAgo } },
        select: { amountPaid: true },
      }),
      prisma.review.count(),
      prisma.review.aggregate({ _avg: { rating: true } }),
      prisma.workOrder.aggregate({
        _sum: { amountPaid: true },
        where: { paymentStatus: 'paid', createdAt: { gte: startOfLastMonth, lt: startOfThisMonth } },
      }),
      prisma.workOrder.findMany({
        where: {
          paymentStatus: 'paid',
          createdAt: { gte: trendWindowStart, lte: now },
        },
        select: { amountPaid: true, createdAt: true },
      }),
      prisma.shop.findMany({
        where: {
          createdAt: { gte: oldestWeekStart, lte: endOfWeek },
        },
        select: { createdAt: true, status: true },
      }),
      prisma.refreshToken.findMany({
        where: {
          revoked: false,
          expiresAt: { gt: now },
        },
        select: {
          adminId: true,
          metadata: true,
        },
      }),
      prisma.customer.count(),
      prisma.tech.count(),
      prisma.shop.count(),
      prisma.admin.count(),
    ]);

    const activeUserOwnerKeys = new Set<string>();
    for (const session of activeRefreshSessions) {
      if (session.adminId) {
        activeUserOwnerKeys.add(`admin:${session.adminId}`);
        continue;
      }
      try {
        const meta = session.metadata ? JSON.parse(session.metadata) as { customerId?: string; shopId?: string; techId?: string } : {};
        if (meta.customerId) activeUserOwnerKeys.add(`customer:${meta.customerId}`);
        if (meta.shopId) activeUserOwnerKeys.add(`shop:${meta.shopId}`);
        if (meta.techId) activeUserOwnerKeys.add(`tech:${meta.techId}`);
      } catch {
        // ignore malformed metadata
      }
    }
    const activeUsers = activeUserOwnerKeys.size;
    const approvedShopCount = countApprovedShops(shopStatusRows);
    const allShops = shopCount;

    const totalRevenue = paidWorkOrders.reduce((sum, wo) => sum + (wo.amountPaid || 0), 0);
    const totalIncomeLast3Months = paidWorkOrdersLast3Months.reduce((sum, wo) => sum + (wo.amountPaid || 0), 0);

    const headline = headlinePaidMonth(paidWorkOrders, now);
    const currentMonthRevenue = headline.revenue;
    const lastMonthRevenue = revenueLastMonth._sum.amountPaid || 0;
    const revenueChangeLabel = headline.changeLabel;

    const recentActivity = recentWorkOrders.map((wo) => ({
      type: 'workorder',
      action: 'Work Order Created',
      details: `${wo.customer.firstName} ${wo.customer.lastName} at ${wo.shop.shopName}`,
      time: wo.createdAt.toISOString(),
    }));

    const clientsByDay = [0, 0, 0, 0, 0, 0, 0];
    weeklyNewClients.forEach((shop) => {
      clientsByDay[new Date(shop.createdAt).getDay()]++;
    });

    const revenueTrend = [0, 0, 0, 0, 0, 0, 0];
    for (const wo of paidWorkOrdersForTrend) {
      const d = new Date(wo.createdAt);
      d.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((d.getTime() - trendWindowStart.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 7) {
        revenueTrend[diffDays] += wo.amountPaid || 0;
      }
    }

    const weeklyCounts = [0, 0, 0, 0];
    for (const shop of approvedShopsForWeeklyTrend) {
      if (!isApprovedShop(shop)) continue;
      const created = shop.createdAt;
      for (let i = 0; i < weekStarts.length; i++) {
        if (created >= weekStarts[i].weekStart && created <= weekStarts[i].weekEnd) {
          weeklyCounts[i] += 1;
          break;
        }
      }
    }
    const weeklyConversionTrend = weekStarts.map((w, i) => ({ label: w.label, value: weeklyCounts[i] }));

    const conversionBase = pendingShops + approvedShopCount;
    const conversionRateRaw = conversionBase > 0 ? (approvedShopCount / conversionBase) * 100 : 0;
    const systemHealth = recentErrorLogs === 0 ? 100 : null;

    return NextResponse.json({
      totalRevenue: formatCurrency(totalRevenue),
      totalRevenueRaw: totalRevenue,
      totalShops: allShops,
      allShops,
      approvedShops: approvedShopCount,
      totalJobs,
      activeUsers,
      pendingShops,
      systemHealth,
      totalUsers: managedUserTotal({
        customers: customerCount,
        shopMembers: shopMemberCount,
        shops: shopCount,
        staff: staffCount,
      }),
      monthlyRevenue: formatCurrency(currentMonthRevenue),
      revenueMonthLabel: headline.label,
      recentActivity,
      weeklyOverview: {
        weekStart: startOfWeek.toISOString(),
        weekEnd: endOfWeek.toISOString(),
        newClientsByDay: clientsByDay,
        totalNewClientsThisWeek: weeklyNewClients.length,
      },
      threeMonthAverages: {
        avgNewClientsPerMonth: Math.round(newClientsLast3Months / 3),
        avgJobIncomePerMonth: formatCurrency(totalIncomeLast3Months / 3),
        churnRate: 'Unavailable',
        churnRateRaw: 0,
        totalClientsLast3Months: newClientsLast3Months,
        totalJobIncomeLast3Months: formatCurrency(totalIncomeLast3Months),
      },
      liveMetrics: {
        revenueTrend,
        revenueGrowth: revenueChangeLabel,
        monthOverMonthGrowth: revenueChangeLabel,
        revenueMonthLabel: headline.label,
        currentMonthRevenue,
        lastMonthRevenue,
        avgRating: avgRating._avg.rating?.toFixed(1) || '0.0',
        reviewsCount,
        websiteVisits: pageViews,
        totalShopsEver: allShops,
        conversionRate: `${conversionRateRaw.toFixed(1)}%`,
        weeklyConversionTrend,
      },
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json({ error: 'Failed to fetch admin stats' }, { status: 500 });
  }
}
