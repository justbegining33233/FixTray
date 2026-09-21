import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import crypto from 'crypto';
import { closeoutTransition } from '@/lib/workOrderCloseout';

const CLOSEOUT_ROLES = new Set(['shop', 'manager', 'admin', 'superadmin']);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!CLOSEOUT_ROLES.has(auth.role)) {
    return NextResponse.json({ error: 'Only the shop or a manager can close out this job.' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const workOrder = await prisma.workOrder.findUnique({ where: { id } });
  if (!workOrder) {
    return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
  }

  const shopId = auth.role === 'shop' ? auth.id : auth.shopId;
  if (auth.role !== 'superadmin' && auth.role !== 'admin' && workOrder.shopId !== shopId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const transition = closeoutTransition(workOrder, body.action);
  if (!transition.ok) {
    return NextResponse.json({ error: transition.error }, { status: 400 });
  }

  if (transition.action === 'invoice') {
    const token = crypto.randomBytes(24).toString('hex');
    const link = await prisma.paymentLink.create({
      data: {
        shopId: workOrder.shopId,
        workOrderId: workOrder.id,
        customerId: workOrder.customerId,
        token,
        amount: transition.amount,
        description: `Invoice for work order ${workOrder.id}`,
        status: 'pending',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    const updated = await prisma.workOrder.update({
      where: { id },
      data: { status: transition.status, paymentStatus: transition.paymentStatus },
    });
    return NextResponse.json({
      workOrder: updated,
      paymentLink: { ...link, url: `/customer/pay/${token}` },
    });
  }

  if (transition.action === 'paid') {
    await prisma.paymentLink.updateMany({
      where: { workOrderId: id, status: 'pending' },
      data: { status: 'paid', paidAt: new Date() },
    });
    const updated = await prisma.workOrder.update({
      where: { id },
      data: {
        status: transition.status,
        paymentStatus: 'paid',
        amountPaid: transition.amount > 0 ? transition.amount : workOrder.amountPaid,
      },
    });
    return NextResponse.json({ workOrder: updated });
  }

  const updated = await prisma.workOrder.update({
    where: { id },
    data: {
      status: transition.status,
      paymentStatus: 'paid',
      completedAt: new Date(),
    },
  });
  return NextResponse.json({ workOrder: updated });
}
