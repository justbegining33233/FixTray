import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { loyaltyPointsFromOrders } from '@/lib/rewardPayload';
import { workOrderTitle } from '@/lib/workOrderMetrics';

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['customer']);
  if (auth instanceof NextResponse) return auth;

  try {
    const customerId = auth.id;
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch completed work orders
    const workOrders = await prisma.workOrder.findMany({
      where: { customerId },
      select: {
        id: true,
        status: true,
        amountPaid: true,
        estimatedCost: true,
        createdAt: true,
        completedAt: true,
        issueDescription: true,
        vehicleType: true,
        shop: { select: { shopName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const completed = workOrders.filter(w =>
      ['closed', 'completed', 'Completed'].includes(w.status)
    );
    const recentCompleted = completed.filter(w => w.createdAt >= ninetyDaysAgo);

    // Fetch reviews left by customer
    const reviews = await prisma.review.findMany({
      where: { customerId },
      select: { rating: true, createdAt: true },
    });

    // Calculate metrics
    const totalSpent = completed.reduce((sum, w) => sum + (w.amountPaid || w.estimatedCost || 0), 0);
    const last90Spent = recentCompleted.reduce((sum, w) => sum + (w.amountPaid || w.estimatedCost || 0), 0);
    const avgRating = reviews.length
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null;
    const loyaltyPoints = loyaltyPointsFromOrders(completed);
    const last30Orders = workOrders.filter(w => w.createdAt >= thirtyDaysAgo).length;
    const pointsToReward = Math.max(0, 200 - loyaltyPoints);

    // Build insight cards
    const insights = [
      {
        id: 'total-spent',
        metric: 'Total Spent (All Time)',
        value: `$${totalSpent.toFixed(2)}`,
        trend: totalSpent > 0 ? ' Active customer' : ' No spend yet',
        color: '#22c55e',
        description: `You have spent a total of $${totalSpent.toFixed(2)} across ${completed.length} completed service${completed.length !== 1 ? 's' : ''}.`,
        href: '/customer/insights/total-spent',
      },
      {
        id: 'last-90-days',
        metric: 'Spending  Last 90 Days',
        value: `$${last90Spent.toFixed(2)}`,
        trend: last90Spent > 0 ? ' Recent activity' : ' No recent spend',
        color: '#e5332a',
        description: `You have completed ${recentCompleted.length} service${recentCompleted.length !== 1 ? 's' : ''} in the last 90 days totalling $${last90Spent.toFixed(2)}.`,
        href: '/customer/insights/last-90-days',
      },
      {
        id: 'loyalty-points',
        metric: 'Loyalty Points',
        value: `${loyaltyPoints} pts`,
        trend: loyaltyPoints >= 200 ? ' Reward available' : ' Keep going',
        color: '#a855f7',
        description: `You earn 1 point for each dollar spent. You are ${pointsToReward} points away from your next reward.`,
        href: '/customer/insights/loyalty-points',
      },
      ...(avgRating
        ? [{
            id: 'avg-rating',
            metric: 'Average Rating Given',
            value: `${avgRating} / 5`,
            trend: parseFloat(avgRating) >= 4 ? ' Satisfied customer' : ' Room for improvement',
            color: '#f59e0b',
            description: `Based on ${reviews.length} review${reviews.length !== 1 ? 's' : ''} you have left. Your feedback helps shops improve.`,
            href: '/customer/insights/avg-rating',
          }]
        : []),
    ];

    // Summary stats
    const summary = {
      totalSpent,
      servicesCompleted: completed.length,
      averageRating: avgRating ? parseFloat(avgRating) : null,
      loyaltyPoints,
      last30Days: last30Orders,
    };

    const breakdown = completed.slice(0, 20).map((order) => ({
      id: order.id,
      service: workOrderTitle(order),
      shop: order.shop?.shopName || 'Shop',
      amount: order.amountPaid || order.estimatedCost || 0,
      date: (order.completedAt || order.createdAt).toISOString(),
    }));

    return NextResponse.json({ insights, summary, breakdown });
  } catch (error) {
    console.error('Error fetching customer insights:', error);
    return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 });
  }
}

