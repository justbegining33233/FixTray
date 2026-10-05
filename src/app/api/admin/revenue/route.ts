import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { canViewPlatformRevenue } from '@/lib/platformRevenue';
import { centsToDollars, loadFeeMovements, reportZone } from '@/lib/books/storedFeeReport';
import { addDays, dayKey, mondayKey } from '@/lib/books/periods';
import { platformFeeYear, type FeeMovement } from '@/lib/books/money';

function inWindow(movement: FeeMovement, zone: string, fromKey: string, untilKey?: string): boolean {
  const key = dayKey(new Date(movement.at), zone);
  if (key < fromKey) return false;
  if (untilKey && key >= untilKey) return false;
  return true;
}

function collectedCents(rows: FeeMovement[]): number {
  return platformFeeYear(rows).collectedCents;
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;

  if (!canViewPlatformRevenue(auth)) {
    return NextResponse.json({ error: 'Platform revenue is limited to platform staff.' }, { status: 403 });
  }

  try {
    const now = new Date();
    const zone = await reportZone();
    const movements = await loadFeeMovements();
    const todayKey = dayKey(now, zone);
    const monthKey = todayKey.slice(0, 7);
    const lastMonthKey = addDays(`${monthKey}-01`, -1).slice(0, 7);
    const threeMonthStart = addDays(`${lastMonthKey}-01`, -1).slice(0, 7);
    const weekStart = mondayKey(todayKey);
    const weekEnd = addDays(weekStart, 7);
    const allFees = platformFeeYear(movements);
    const todayRows = movements.filter((row) => dayKey(new Date(row.at), zone) === todayKey);
    const weekRows = movements.filter((row) => inWindow(row, zone, weekStart, weekEnd));
    const monthRows = movements.filter((row) => dayKey(new Date(row.at), zone).startsWith(monthKey));
    const lastMonthRows = movements.filter((row) => dayKey(new Date(row.at), zone).startsWith(lastMonthKey));
    const last3Rows = movements.filter((row) => dayKey(new Date(row.at), zone).slice(0, 7) >= threeMonthStart);

    const paidWorkOrders = await prisma.workOrder.findMany({
      where: { paymentStatus: 'paid' },
      select: {
        id: true,
        createdAt: true,
        shop: { select: { id: true, shopName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const shopNames = new Map<string, string>();
    for (const order of paidWorkOrders) {
      if (order.shop?.id) shopNames.set(order.shop.id, order.shop.shopName || 'Shop');
    }

    const dailyFeesTrend: number[] = [];
    const dailyPaidOrdersTrend: number[] = [];
    const dailyNetTrend: number[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const key = addDays(todayKey, -i);
      const dayRows = movements.filter((row) => dayKey(new Date(row.at), zone) === key);
      dailyFeesTrend.push(centsToDollars(collectedCents(dayRows)));
      dailyNetTrend.push(centsToDollars(platformFeeYear(dayRows).netCents));
      dailyPaidOrdersTrend.push(paidWorkOrders.filter((order) => dayKey(order.createdAt, zone) === key).length);
    }

    const feesByShopMap: Record<string, { shopId: string; shopName: string; count: number; fees: number }> = {};
    for (const row of movements) {
      if (row.kind !== 'collected' && row.kind !== 'settled') continue;
      const shopId = row.shopId || 'unknown';
      if (!feesByShopMap[shopId]) {
        feesByShopMap[shopId] = {
          shopId,
          shopName: shopNames.get(shopId) || 'Shop',
          count: 0,
          fees: 0,
        };
      }
      feesByShopMap[shopId].count += 1;
      feesByShopMap[shopId].fees += centsToDollars(row.feeCents);
    }
    const feesByShop = Object.values(feesByShopMap).sort((a, b) => b.fees - a.fees);

    const recentTransactions = movements
      .slice()
      .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
      .slice(0, 10)
      .map((row) => ({
        id: row.id,
        shopName: shopNames.get(row.shopId) || 'Shop',
        kind: row.kind,
        description: row.workOrderId,
        fee: centsToDollars(row.kind === 'refund' || row.kind === 'chargeback' ? -row.feeCents : row.feeCents),
        date: row.at,
      }));

    const feesThisMonth = centsToDollars(collectedCents(monthRows));
    const feesLastMonth = centsToDollars(collectedCents(lastMonthRows));
    const momGrowth = feesLastMonth > 0
      ? Number((((feesThisMonth - feesLastMonth) / feesLastMonth) * 100).toFixed(1))
      : (feesThisMonth > 0 ? 100 : 0);

    return NextResponse.json({
      success: true,
      generatedAt: now.toISOString(),
      shopBayRevenueIncluded: false,
      timeZone: zone,
      workOrderFees: {
        feesOwed: centsToDollars(allFees.owedCents),
        feesRefunded: centsToDollars(allFees.refundedCents),
        feesAccrued: centsToDollars(allFees.accruedCents),
        netFees: centsToDollars(allFees.netCents),
        totalFees: centsToDollars(allFees.collectedCents),
        feesToday: centsToDollars(collectedCents(todayRows)),
        feesThisWeek: centsToDollars(collectedCents(weekRows)),
        feesThisMonth,
        feesLastMonth,
        feesLast3Months: centsToDollars(collectedCents(last3Rows)),
        momGrowth,
        totalPaidWorkOrders: paidWorkOrders.length,
        dailyFeesTrend,
        dailyPaidOrdersTrend,
        dailyNetTrend,
        feesByShop,
        recentTransactions,
      },
      stripeLinks: {
        dashboard: 'https://dashboard.stripe.com',
        payments: 'https://dashboard.stripe.com/payments',
        payouts: 'https://dashboard.stripe.com/payouts',
        balances: 'https://dashboard.stripe.com/balance/overview',
      },
    });
  } catch (error) {
    console.error('Error fetching revenue data:', error);
    return NextResponse.json({ error: 'Failed to fetch revenue data' }, { status: 500 });
  }
}
