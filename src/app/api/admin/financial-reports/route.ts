import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { platformFeeForPaidOrders } from '@/lib/platformFees';
import { getPlatformConfig } from '@/lib/platformConfig';

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

    // Get monthly revenue for last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyRevenue = await prisma.workOrder.groupBy({
      by: ['createdAt'],
      where: {
        paymentStatus: 'paid',
        createdAt: {
          gte: sixMonthsAgo,
        },
      },
      _sum: {
        amountPaid: true,
      },
    });

    const paidCountByMonth: { [key: string]: number } = {};
    for (const wo of workOrders) {
      if (wo.createdAt < sixMonthsAgo) continue;
      const date = new Date(wo.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      paidCountByMonth[monthKey] = (paidCountByMonth[monthKey] || 0) + 1;
    }

    // Group by month
    const monthlyData: { [key: string]: { revenue: number; count: number } } = {};
    monthlyRevenue.forEach((item) => {
      const date = new Date(item.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const bucket = monthlyData[monthKey] || { revenue: 0, count: 0 };
      bucket.revenue += item._sum?.amountPaid || 0;
      bucket.count = paidCountByMonth[monthKey] || 0;
      monthlyData[monthKey] = bucket;
    });

    // Format monthly data
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedMonthlyData = Object.entries(monthlyData).map(([key, bucket]) => {
      const [year, month] = key.split('-');
      const monthName = months[parseInt(month) - 1];
      const payouts = bucket.revenue;
      const fees = platformFeeForPaidOrders(bucket.count, serviceFeeCents);
      
      return {
        month: `${monthName} ${year}`,
        revenue: `$${bucket.revenue.toFixed(2)}`,
        payouts: `$${payouts.toFixed(2)}`,
        fees: `$${fees.toFixed(2)}`,
      };
    }).slice(-6); // Last 6 months

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
