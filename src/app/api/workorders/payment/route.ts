import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import logger from '@/lib/logger';
import { validateCsrf } from '@/lib/csrf';
import { FIXTRAY_SERVICE_FEE } from '@/lib/constants';

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  // Only shops/managers/admins can record payments
  if (!['shop', 'manager', 'admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    if (!request.headers.get('authorization')) {
      const ok = await validateCsrf(request);
      if (!ok) return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
    }
    const { workOrderId, amount } = await request.json();

    const workOrder = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
    if (!workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }

    const payment = Number(amount);
    if (!Number.isFinite(payment) || payment <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const totalPaid = (workOrder.amountPaid || 0) + payment;

    // Auto-close if fully paid (estimate + FixTray $5 service fee)
    const est = workOrder.estimate as Record<string, unknown> | null;
    const estimateAmount = Number(est?.amount) || workOrder.estimatedCost || 0;
    let status = workOrder.status;
    if (totalPaid >= (estimateAmount + FIXTRAY_SERVICE_FEE) && status === 'waiting-for-payment') {
      status = 'closed';
    }

    const updated = await prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        amountPaid: totalPaid,
        paymentStatus: totalPaid >= (estimateAmount + FIXTRAY_SERVICE_FEE) ? 'paid' : 'pending',
        status,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error recording payment:', error);
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  }
}
