import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (auth.role !== 'customer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const response = body.response as string;

  if (response !== 'accepted' && response !== 'denied') {
    return NextResponse.json(
      { error: 'Invalid response. Must be "accepted" or "denied".' },
      { status: 400 }
    );
  }

  const workOrder = await prisma.workOrder.findUnique({
    where: { id },
    select: { id: true, customerId: true, shopId: true, status: true },
  });

  if (!workOrder) {
    return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
  }

  // Customer must own this work order
  if (workOrder.customerId !== auth.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Only allow responding to estimate-submitted work orders
  if (workOrder.status !== 'estimate-submitted') {
    return NextResponse.json({ error: 'No pending estimate to respond to' }, { status: 400 });
  }

  const newStatus = response === 'accepted' ? 'in-progress' : 'denied-estimate';
  const waStatus = response === 'accepted' ? 'signed' : 'declined';

  // Update work order status
  await prisma.workOrder.update({
    where: { id },
    data: { status: newStatus },
  });

  // Update WorkAuthorization if one exists
  const wa = await prisma.workAuthorization.findFirst({
    where: { workOrderId: id, status: 'pending' },
  });

  if (wa) {
    await prisma.workAuthorization.update({
      where: { id: wa.id },
      data: {
        status: waStatus,
        ...(response === 'accepted' ? { signedAt: new Date() } : {}),
      },
    });
  }

  // Notify the shop via a customer notification record (shop will see via status change)
  await prisma.notification.create({
    data: {
      customerId: workOrder.customerId!,
      type: 'estimate',
      title: `Estimate ${response === 'accepted' ? 'Accepted' : 'Denied'} by Customer`,
      message: `Customer has ${response === 'accepted' ? 'accepted' : 'denied'} the estimate for work order ${id}.`,
      workOrderId: id,
      deliveryMethod: 'in-app',
    },
  });

  return NextResponse.json({ success: true, newStatus });
}
