import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { getSettings } from '@/lib/platform-settings';

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;

  if (!auth.isOwner) {
    return NextResponse.json({ error: 'Only FixTray Owner can access platform revenue.' }, { status: 403 });
  }

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const feePerWorkOrder = (getSettings().serviceFee || 500) / 100;

    const [paidWorkOrders, revenueThisMonth, revenueLastMonth, revenueLast3Months] = await Promise.all([
      prisma.workOrder.findMany({
        where: { paymentStatus: 'paid' },
        select: {
          id: true,
          amountPaid: true,
          createdAt: true,
          issueDescription: true,
          shop: { select: { id: true, shopName: true } },
          customer: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.workOrder.aggregate({
        _sum: { amountPaid: true },
        where: { paymentStatus: 'paid', createdAt: { gte: startOfThisMonth } },
      }),
      prisma.workOrder.aggregate({
        _sum: { amountPaid: true },
        where: { paymentStatus: 'paid', createdAt: { gte: startOfLastMonth, lt: startOfThisMonth } },
      }),
      prisma.workOrder.aggregate({
        _sum: { amountPaid: true },
        where: { paymentStatus: 'paid', createdAt: { gte: threeMonthsAgo } },
      }),
    ]);

    const totalWorkOrderRevenue = paidWorkOrders.reduce((sum, wo) => sum + (wo.amountPaid || 0), 0);
    const paidTodayCount = paidWorkOrders.filter((wo) => wo.createdAt >= todayStart).length;
    const paidWeekCount = paidWorkOrders.filter((wo) => wo.createdAt >= weekAgo).length;
    const paidThisMonthCount = paidWorkOrders.filter((wo) => wo.createdAt >= startOfThisMonth).length;
    const paidLastMonthCount = paidWorkOrders.filter((wo) => wo.createdAt >= startOfLastMonth && wo.createdAt < startOfThisMonth).length;

    const dailyFeesTrend: number[] = [];
    const dailyPaidOrdersTrend: number[] = [];
    const dailyRevenueTrend: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(now.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayPaidWorkOrders = paidWorkOrders.filter((wo) => wo.createdAt >= dayStart && wo.createdAt <= dayEnd);
      const dayRevenue = dayPaidWorkOrders.reduce((sum, wo) => sum + (wo.amountPaid || 0), 0);

      dailyPaidOrdersTrend.push(dayPaidWorkOrders.length);
      dailyFeesTrend.push(dayPaidWorkOrders.length * feePerWorkOrder);
      dailyRevenueTrend.push(dayRevenue);
    }

    const totalWorkOrderFees = paidWorkOrders.length * feePerWorkOrder;
    const workOrderFeesToday = paidTodayCount * feePerWorkOrder;
    const workOrderFeesThisWeek = paidWeekCount * feePerWorkOrder;
    const workOrderFeesThisMonth = paidThisMonthCount * feePerWorkOrder;
    const workOrderFeesLastMonth = paidLastMonthCount * feePerWorkOrder;
    const workOrderFeesLast3Months = (paidWorkOrders.filter((wo) => wo.createdAt >= threeMonthsAgo).length) * feePerWorkOrder;
    const momGrowth = workOrderFeesLastMonth > 0
      ? Number((((workOrderFeesThisMonth - workOrderFeesLastMonth) / workOrderFeesLastMonth) * 100).toFixed(1))
      : (workOrderFeesThisMonth > 0 ? 100 : 0);

    const feesByShopMap: Record<string, { shopId: string; shopName: string; count: number; fees: number; totalRevenue: number }> = {};
    for (const wo of paidWorkOrders) {
      const shopId = wo.shop?.id || 'unknown';
      const shopName = wo.shop?.shopName || 'Unknown Shop';
      if (!feesByShopMap[shopId]) {
        feesByShopMap[shopId] = { shopId, shopName, count: 0, fees: 0, totalRevenue: 0 };
      }
      feesByShopMap[shopId].count++;
      feesByShopMap[shopId].fees += feePerWorkOrder;
      feesByShopMap[shopId].totalRevenue += wo.amountPaid || 0;
    }

    const feesByShop = Object.values(feesByShopMap).sort((a, b) => b.fees - a.fees);

    const recentWorkOrderFees = paidWorkOrders.slice(0, 10).map((wo) => ({
      id: wo.id,
      shopName: wo.shop?.shopName || 'Unknown',
      customerName: wo.customer ? `${wo.customer.firstName} ${wo.customer.lastName}` : 'Unknown',
      description: wo.issueDescription || 'Service',
      amountPaid: wo.amountPaid || 0,
      fee: feePerWorkOrder,
      date: wo.createdAt,
    }));

    const currentMonthRevenue = revenueThisMonth._sum.amountPaid || 0;
    const lastMonthRevenue = revenueLastMonth._sum.amountPaid || 0;

    return NextResponse.json({
      success: true,
      generatedAt: now.toISOString(),
      revenue: {
        totals: {
          grossRevenue: totalWorkOrderRevenue,
          netRevenue: totalWorkOrderFees,
        },
      },
      liveMetrics: {
        revenueTrend: dailyFeesTrend,
        momGrowth: `${momGrowth >= 0 ? '+' : ''}${momGrowth}%`,
        revenueThisMonth: currentMonthRevenue,
        revenueLastMonth: lastMonthRevenue,
        revenueLast3Months: revenueLast3Months._sum.amountPaid || 0,
      },
      workOrderFees: {
        feePerWorkOrder,
        totalFees: totalWorkOrderFees,
        feesToday: workOrderFeesToday,
        feesThisWeek: workOrderFeesThisWeek,
        feesThisMonth: workOrderFeesThisMonth,
        feesLastMonth: workOrderFeesLastMonth,
        feesLast3Months: workOrderFeesLast3Months,
        momGrowth,
        totalPaidWorkOrders: paidWorkOrders.length,
        paidWorkOrdersToday: paidTodayCount,
        paidWorkOrdersThisWeek: paidWeekCount,
        paidWorkOrdersThisMonth: paidThisMonthCount,
        totalWorkOrderRevenue,
        thisMonthWorkOrderRevenue: currentMonthRevenue,
        lastMonthWorkOrderRevenue: lastMonthRevenue,
        averageTicket: paidWorkOrders.length > 0 ? totalWorkOrderRevenue / paidWorkOrders.length : 0,
        dailyFeesTrend,
        dailyPaidOrdersTrend,
        dailyRevenueTrend,
        feesByShop,
        recentTransactions: recentWorkOrderFees,
      },
      stripeLinks: {
        dashboard: 'https://dashboard.stripe.com',
        payments: 'https://dashboard.stripe.com/payments',
        billing: 'https://dashboard.stripe.com/billing/overview',
        payouts: 'https://dashboard.stripe.com/payouts',
        balances: 'https://dashboard.stripe.com/balance/overview',
      },
      ranges: {
        todayStart: todayStart.toISOString(),
        weekAgo: weekAgo.toISOString(),
        thisMonthStart: startOfThisMonth.toISOString(),
        lastMonthStart: startOfLastMonth.toISOString(),
        nextMonthStart: startOfNextMonth.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching revenue data:', error);
    return NextResponse.json({ error: 'Failed to fetch revenue data' }, { status: 500 });
  }
}
