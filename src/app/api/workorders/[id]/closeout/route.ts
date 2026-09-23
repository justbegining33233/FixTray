import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import crypto from 'crypto';
import { closeoutTransition } from '@/lib/workOrderCloseout';
import { ensureProductionColumns } from '@/lib/ensureProductionColumns';
import { getPlatformServiceFeeUsd } from '@/lib/platformFee';

const CLOSEOUT_ROLES = new Set(['shop', 'manager', 'admin', 'superadmin']);

// Do not return customerName. Production databases that have not picked up
// the additive column otherwise fail the INSERT ... RETURNING and the shop
// only sees "Closeout failed." Mark paid does not charge a card.
const PAYMENT_LINK_SELECT = {
  id: true,
  token: true,
  amount: true,
  description: true,
  status: true,
  workOrderId: true,
  expiresAt: true,
} as const;

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

  try {
    await ensureProductionColumns();

    const workOrder = await prisma.workOrder.findUnique({ where: { id } });
    if (!workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }

    const shopId = auth.role === 'shop' ? auth.id : auth.shopId;
    if (auth.role !== 'superadmin' && auth.role !== 'admin' && workOrder.shopId !== shopId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const serviceFeeUsd = await getPlatformServiceFeeUsd();
    const transition = closeoutTransition(workOrder, body.action, serviceFeeUsd);
    if (!transition.ok) {
      return NextResponse.json({ error: transition.error }, { status: 400 });
    }

    if (transition.action === 'invoice') {
      const existing = await prisma.paymentLink.findFirst({
        where: { workOrderId: workOrder.id, status: 'pending' },
        orderBy: { createdAt: 'desc' },
        select: PAYMENT_LINK_SELECT,
      });
      // Always store the final bill (quote + FixTray fee). Refresh pending links
      // so earlier amounts that omitted the fee do not stick around.
      const link = existing
        ? await prisma.paymentLink.update({
            where: { id: existing.id },
            data: {
              amount: transition.amount,
              description: `Invoice for work order ${workOrder.id}`,
            },
            select: PAYMENT_LINK_SELECT,
          })
        : await prisma.paymentLink.create({
            data: {
              shopId: workOrder.shopId,
              workOrderId: workOrder.id,
              customerId: workOrder.customerId,
              token: crypto.randomBytes(24).toString('hex'),
              amount: transition.amount,
              description: `Invoice for work order ${workOrder.id}`,
              status: 'pending',
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
            select: PAYMENT_LINK_SELECT,
          });
      const updated = await prisma.workOrder.update({
        where: { id },
        data: { status: transition.status, paymentStatus: transition.paymentStatus },
      });
      return NextResponse.json({
        workOrder: updated,
        invoice: {
          quoteAmount: transition.quoteAmount,
          serviceFee: transition.serviceFee,
          totalDue: transition.amount,
        },
        paymentLink: {
          ...link,
          quoteAmount: transition.quoteAmount,
          serviceFee: transition.serviceFee,
          url: `/customer/pay/${link.token}`,
        },
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
      return NextResponse.json({
        workOrder: updated,
        invoice: {
          quoteAmount: transition.quoteAmount,
          serviceFee: transition.serviceFee,
          totalDue: transition.amount,
        },
      });
    }

    const updated = await prisma.workOrder.update({
      where: { id },
      data: {
        status: transition.status,
        paymentStatus: 'paid',
        completedAt: new Date(),
      },
    });
    return NextResponse.json({
      workOrder: updated,
      invoice: {
        quoteAmount: transition.quoteAmount,
        serviceFee: transition.serviceFee,
        totalDue: transition.amount,
      },
    });
  } catch (error) {
    console.error('[workorders closeout]', error);
    return NextResponse.json({ error: 'Closeout failed.' }, { status: 500 });
  }
}
