import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { platformFeeForPaidOrders } from '@/lib/platformFees';
import { getPlatformConfig } from '@/lib/platformConfig';
import { paidMonths } from '@/lib/platformRevenue';

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;

  // Enforce Neon-only DB: fail fast if DATABASE_URL is missing
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not configured ΓÇö set it to your Neon connection string');
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  }

  try {
    // Get all work orders with payment info
    const workOrders = await prisma.workOrder.findMany({
      where: {
        paymentStatus: 'paid',
      },
      include: {
        shop: {
          select: {
            shopName: true,
          },
        },
      },
    });

    const platformConfig = await getPlatformConfig();
    const serviceFeeCents = platformConfig?.serviceFee;

    // Calculate total revenue from work orders
    const totalRevenue = workOrders.reduce((sum, wo) => sum + (wo.amountPaid || 0), 0);
    
    // Same per-paid-order service fee the revenue page uses. Shop payout stays the gross job payment.
    const platformFees = platformFeeForPaidOrders(workOrders.length, serviceFeeCents);
    
    const totalPayouts = totalRevenue;

    // Get pending work orders for pending payouts
    const pendingWorkOrders = await prisma.workOrder.findMany({
      where: {
        paymentStatus: 'pending',
      },
    });
    const pendingPayouts = pendingWorkOrders.reduce((sum, wo) => sum + (wo.amountPaid || 0), 0);

    // Calculate average transaction
    const averageTransaction = workOrders.length > 0 ? totalRevenue / workOrders.length : 0;

    const formattedMonthlyData = paidMonths(workOrders).slice(-6).map((bucket) => {
      const fees = platformFeeForPaidOrders(bucket.count, serviceFeeCents);
      return {
        month: bucket.label,
        revenue: `$${bucket.revenue.toFixed(2)}`,
        payouts: `$${bucket.revenue.toFixed(2)}`,
        fees: `$${fees.toFixed(2)}`,
      };
    });

    // Get top earning shops
    const shopRevenue = await prisma.workOrder.groupBy({
      by: ['shopId'],
      where: {
        paymentStatus: 'paid',
        shopId: { not: '' }, // Not empty string
      },
      _sum: {
        amountPaid: true,
      },
      orderBy: {
        _sum: {
          amountPaid: 'desc',
        },
      },
      take: 5,
    });

    // Get shop names and format data
    const topEarningShops = await Promise.all(
      shopRevenue.map(async (item) => {
        const shop = await prisma.shop.findUnique({
          where: { id: item.shopId as string },
          select: { shopName: true },
        });
        
        const revenue = item._sum?.amountPaid || 0;
        const paidForShop = workOrders.filter((wo) => wo.shopId === item.shopId).length;
        const fees = platformFeeForPaidOrders(paidForShop, serviceFeeCents);
        const payout = revenue;
        
        return {
          name: shop?.shopName || 'Unknown Shop',
          revenue: `$${revenue.toFixed(2)}`,
          fees: `$${fees.toFixed(2)}`,
          payout: `$${payout.toFixed(2)}`,
        };
      })
    );

    return NextResponse.json({
      totalRevenue: `$${totalRevenue.toFixed(2)}`,
      totalPayouts: `$${totalPayouts.toFixed(2)}`,
      platformFees: `$${platformFees.toFixed(2)}`,
      pendingPayouts: `$${pendingPayouts.toFixed(2)}`,
      averageTransaction: `$${averageTransaction.toFixed(2)}`,
      transactionCount: workOrders.length,
      monthlyData: formattedMonthlyData,
      topEarningShops,
    });
  } catch (error) {
    console.error('Error fetching financial reports:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
