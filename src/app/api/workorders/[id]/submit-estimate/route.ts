import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const allowedRoles = ['shop', 'tech', 'manager', 'superadmin'];
  if (!allowedRoles.includes(auth.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;

  const workOrder = await prisma.workOrder.findUnique({
    where: { id },
    select: {
      id: true,
      shopId: true,
      customerId: true,
      status: true,
      estimatedCost: true,
      estimate: true,
    },
  });

  if (!workOrder) {
    return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
  }

  // Verify shop ownership
  const shopId = auth.role === 'shop' ? auth.id : auth.shopId;
  if (auth.role !== 'superadmin' && workOrder.shopId !== shopId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Require estimate data before submitting
  if (!workOrder.estimatedCost && !workOrder.estimate) {
    return NextResponse.json(
      { error: 'No estimate data found. Save line items first.' },
      { status: 400 }
    );
  }

  // Update work order status to estimate-submitted.
  // A pending authorization is not created here. Customer accept + signature does that.
  await prisma.workOrder.update({
    where: { id },
    data: { status: 'estimate-submitted' },
  });

  await prisma.workAuthorization.deleteMany({
    where: { workOrderId: id, status: 'pending' },
  });

  // Notify customer
  if (workOrder.customerId) {
    await prisma.notification.create({
      data: {
        customerId: workOrder.customerId,
        type: 'estimate',
        title: 'Estimate Ready for Review',
        message: `An estimate is ready for your review. Visit My Estimates to accept or deny and sign.`,
        workOrderId: id,
        deliveryMethod: 'in-app',
      },
    });
  }

  return NextResponse.json({ success: true, message: 'Estimate submitted to customer' });
}
