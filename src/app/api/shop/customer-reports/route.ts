import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = verifyToken(token);
    if (!decoded || !['shop', 'manager', 'admin'].includes(decoded.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');
    // Data isolation: the requested shopId must belong to the authenticated user
    // (admins/superadmins can query any shop)
    if (decoded.role !== 'superadmin' && shopId && shopId !== decoded.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const days = parseInt(searchParams.get('days') || '90');
    if (!shopId) return NextResponse.json({ error: 'shopId required' }, { status: 400 });

    // Verify caller owns or belongs to this shop (prevent IDOR)
    if (decoded.role !== 'superadmin') {
      const callerShopId = decoded.role === 'shop' ? decoded.id : decoded.shopId;
      if (!callerShopId || shopId !== callerShopId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // All work orders for this shop
    const workOrders = await prisma.workOrder.findMany({
      where: { shopId },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // New customers in period
    const newCustomers = workOrders.filter(wo => new Date(wo.createdAt) >= since);
    const uniqueNewCustomerIds = [...new Set(newCustomers.map(wo => wo.customerId))];

    // All-time unique customers
    const allCustomerIds = [...new Set(workOrders.map(wo => wo.customerId))];

    // Returning customers (more than 1 work order total)
    const orderCountByCustomer: Record<string, number> = {};
    workOrders.forEach(wo => {
      orderCountByCustomer[wo.customerId] = (orderCountByCustomer[wo.customerId] || 0) + 1;
    });
    const returningCount = Object.values(orderCountByCustomer).filter(c => c > 1).length;

    // Top customers by job count
    const customerMap: Record<string, { id: string; name: string; email: string; jobCount: number; totalSpent: number; lastVisit: string }> = {};
    workOrders.forEach(wo => {
      if (!customerMap[wo.customerId]) {
        customerMap[wo.customerId] = {
          id: wo.customerId,
          name: `${wo.customer.firstName} ${wo.customer.lastName}`,
          email: wo.customer.email,
          jobCount: 0,
          totalSpent: 0,
          lastVisit: wo.createdAt.toISOString(),
        };
      }
      customerMap[wo.customerId].jobCount += 1;
      customerMap[wo.customerId].totalSpent += wo.amountPaid || wo.estimatedCost || 0;
      if (new Date(wo.createdAt) > new Date(customerMap[wo.customerId].lastVisit)) {
        customerMap[wo.customerId].lastVisit = wo.createdAt.toISOString();
      }
    });

    const topCustomers = Object.values(customerMap)
      .sort((a, b) => b.jobCount - a.jobCount)
      .slice(0, 10);

    // Acquisition over time (monthly)
    const monthlyAcquisition: Record<string, number> = {};
    const firstVisitByCustomer: Record<string, string> = {};
    workOrders.forEach(wo => {
      if (!firstVisitByCustomer[wo.customerId] || new Date(wo.createdAt) < new Date(firstVisitByCustomer[wo.customerId])) {
        firstVisitByCustomer[wo.customerId] = wo.createdAt.toISOString();
      }
    });
    Object.values(firstVisitByCustomer).forEach(date => {
      const key = date.slice(0, 7); // YYYY-MM
      monthlyAcquisition[key] = (monthlyAcquisition[key] || 0) + 1;
    });

    const acquisitionChart = Object.entries(monthlyAcquisition)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, count]) => ({ month, count }));

    // Retention rate (customers who came back within 90 days)
    const retentionRate = allCustomerIds.length > 0
      ? Math.round((returningCount / allCustomerIds.length) * 100)
      : 0;

    return NextResponse.json({
      summary: {
        totalCustomers: allCustomerIds.length,
        newCustomers: uniqueNewCustomerIds.length,
        returningCustomers: returningCount,
        retentionRate,
        avgJobsPerCustomer: allCustomerIds.length > 0
          ? (workOrders.length / allCustomerIds.length).toFixed(1)
          : '0',
        periodDays: days,
      },
      topCustomers,
      acquisitionChart,
    });
  } catch (error) {
    console.error('Customer report error:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
