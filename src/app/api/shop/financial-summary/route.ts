import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole, AuthUser } from '@/lib/auth';
import { shopJobReceiptCents } from '@/lib/books/money';
import { addDays, dayKey, mondayKey, zonedDayStart } from '@/lib/books/periods';
import { reportZone } from '@/lib/books/storedFeeReport';
import { loadShopFacts } from '@/lib/books/loadTruth';
import { outstandingArDollars } from '@/lib/outstandingBalance';

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'manager', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const user = auth as AuthUser;
  const { searchParams } = new URL(request.url);
  // For shop/manager use their own shopId; admins may query any shop via ?shopId=
  const shopId = user.role === 'admin'
    ? searchParams.get('shopId')
    : (user.shopId ?? user.id);

  if (!shopId) {
    return NextResponse.json({ error: 'Shop ID is required' }, { status: 400 });
  }

  // Managers keep outstanding bills for closeout. Shop income stays off this response.
  if (user.role === 'manager') {
    try {
      const outstandingInvoices = outstandingArDollars(await loadShopFacts(shopId));
      return NextResponse.json({
        summary: {
          outstandingInvoices,
        },
      });
    } catch (error) {
      console.error('Error fetching outstanding invoices:', error);
      return NextResponse.json({ error: 'Failed to fetch financial summary' }, { status: 500 });
    }
  }

  try {
    const zone = await reportZone();
    const todayKey = dayKey(new Date(), zone);
    const startOfToday = zonedDayStart(todayKey, zone);
    const startOfWeek = zonedDayStart(mondayKey(todayKey), zone);
    const startOfMonth = zonedDayStart(`${todayKey.slice(0, 7)}-01`, zone);
    const startOfTomorrow = zonedDayStart(addDays(todayKey, 1), zone);

    const rangeStart = startOfWeek < startOfMonth ? startOfWeek : startOfMonth;
    const [closedOrders, facts] = await Promise.all([
      prisma.workOrder.findMany({
        where: { shopId, status: 'closed', updatedAt: { gte: rangeStart } },
        select: { amountPaid: true, estimatedCost: true, paymentStatus: true, updatedAt: true },
      }),
      loadShopFacts(shopId),
    ]);

    const receipt = (order: { amountPaid: number | null; estimatedCost: number | null; paymentStatus: string | null }) =>
      shopJobReceiptCents(order) / 100;
    const sumSince = (from: Date, until?: Date) => closedOrders.reduce((sum, order) => {
      if (!order.updatedAt || order.updatedAt < from) return sum;
      if (until && order.updatedAt >= until) return sum;
      return sum + receipt(order);
    }, 0);

    const summary = {
      todayRevenue: sumSince(startOfToday, startOfTomorrow),
      weeklyRevenue: sumSince(startOfWeek),
      monthlyRevenue: sumSince(startOfMonth),
      outstandingInvoices: outstandingArDollars(facts),
      revenueVisible: true,
    };

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error fetching financial summary:', error);
    return NextResponse.json({ error: 'Failed to fetch financial summary' }, { status: 500 });
  }
}