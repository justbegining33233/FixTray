import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getPlatformServiceFeeUsd } from '@/lib/platformFee';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload || payload.role !== 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customerId = payload.id;

    // Fetch all work orders for this customer that have an estimate or payment
    const workOrders = await prisma.workOrder.findMany({
      where: {
        customerId,
        OR: [
          { paymentStatus: 'paid' },
          { status: 'waiting-for-payment' },
          { estimatedCost: { not: null } },
        ],
      },
      include: {
        shop: {
          select: { shopName: true, address: true, phone: true },
        },
        vehicle: {
          select: { make: true, model: true, year: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const fixtrayFee = await getPlatformServiceFeeUsd();

    const payments = workOrders.map((wo) => {
      // Prefer quote subtotal; amountPaid already includes the FixTray fee after closeout.
      let serviceCost = 0;
      if (typeof wo.estimatedCost === 'number' && wo.estimatedCost > 0) {
        serviceCost = wo.estimatedCost;
      } else if (typeof wo.amountPaid === 'number' && wo.amountPaid > 0) {
        serviceCost = Math.max(0, Math.round((wo.amountPaid - fixtrayFee) * 100) / 100);
      }
      const totalDue = serviceCost > 0
        ? Math.round((serviceCost + fixtrayFee) * 100) / 100
        : 0;

      return {
        id: wo.id,
        status: wo.paymentStatus === 'paid' ? 'Paid' : 'Pending',
        workOrderStatus: wo.status,
        amount: totalDue,
        serviceCost,
        fixtrayFee,
        amountPaid: wo.amountPaid || 0,
        service: wo.issueDescription || 'Vehicle Service',
        shop: wo.shop?.shopName || 'Unknown Shop',
        shopAddress: wo.shop?.address || '',
        vehicle: wo.vehicle
          ? `${wo.vehicle.year} ${wo.vehicle.make} ${wo.vehicle.model}`
          : 'Unknown Vehicle',
        date: wo.createdAt.toISOString(),
        paidAt: wo.updatedAt.toISOString(),
        canPay: wo.status === 'waiting-for-payment' && wo.paymentStatus !== 'paid',
      };
    });

    const totalPaid = payments
      .filter((p) => p.status === 'Paid')
      .reduce((sum, p) => sum + p.amountPaid, 0);

    const totalPending = payments
      .filter((p) => p.status === 'Pending')
      .reduce((sum, p) => sum + p.amount, 0);

    return NextResponse.json({
      success: true,
      payments,
      summary: {
        totalPaid,
        totalPending,
        paidCount: payments.filter((p) => p.status === 'Paid').length,
        pendingCount: payments.filter((p) => p.status === 'Pending').length,
      },
    });
  } catch (error) {
    console.error('Customer payments error:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}
