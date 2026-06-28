import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import crypto from 'crypto';

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
      issueDescription: true,
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

  // Update work order status to estimate-submitted
  await prisma.workOrder.update({
    where: { id },
    data: { status: 'estimate-submitted' },
  });

  // Create WorkAuthorization record (one per work order; skip if pending one exists)
  const existingWA = await prisma.workAuthorization.findFirst({
    where: { workOrderId: id, status: 'pending' },
  });

  if (!existingWA) {
    const token = crypto.randomBytes(24).toString('hex');
    const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    await prisma.workAuthorization.create({
      data: {
        shopId: workOrder.shopId,
        workOrderId: id,
        customerId: workOrder.customerId ?? null,
        authToken: token,
        estimateTotal: workOrder.estimatedCost ?? null,
        workSummary: String(workOrder.issueDescription ?? '').slice(0, 1000),
        expiresAt: expiry,
        status: 'pending',
      },
    });
  }

  // Notify customer
  if (workOrder.customerId) {
    await prisma.notification.create({
      data: {
        customerId: workOrder.customerId,
        type: 'estimate',
        title: 'Estimate Ready for Review',
        message: `An estimate is ready for your review. Visit My Estimates to accept or deny.`,
        workOrderId: id,
        deliveryMethod: 'in-app',
      },
    });
  }

  return NextResponse.json({ success: true, message: 'Estimate submitted to customer' });
}
