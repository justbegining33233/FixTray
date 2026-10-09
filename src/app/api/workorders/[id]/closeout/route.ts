import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import crypto from 'crypto';
import { closeoutTransition } from '@/lib/workOrderCloseout';
import { ensureProductionColumns } from '@/lib/ensureProductionColumns';
import { getPlatformServiceFeeUsd } from '@/lib/platformFee';
import { freezeWorkOrderCheckoutFee } from '@/lib/freezeWorkOrderFee';
import { recordStatusHistory } from '@/lib/statusHistoryWrite';
import { presentCloseoutForRole } from '@/lib/staffMoneyAccess';

const CLOSEOUT_ROLES = new Set(['shop', 'manager']);

// Do not return customerName. Production databases that have not picked up
// the additive column otherwise fail the INSERT ... RETURNING and the shop
// only sees "Closeout failed." Mark paid does not charge a card.
const WORK_ORDER_VIEW = {
  include: {
    customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, company: true } },
    vehicle: { select: { id: true, vehicleType: true, make: true, model: true, year: true, vin: true, licensePlate: true } },
    assignedTo: { select: { id: true, firstName: true, lastName: true } },
  },
} as const;

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
    if (workOrder.shopId !== shopId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { readFeeSnapshot } = await import('@/lib/feeSnapshot');
    const serviceFeeUsd = await getPlatformServiceFeeUsd();
    if ((body.action === 'invoice' || body.action === 'paid') && serviceFeeUsd == null && !readFeeSnapshot(workOrder.completion)) {
      return NextResponse.json({ error: 'The platform service fee is not configured.' }, { status: 409 });
    }
    const transition = closeoutTransition(workOrder, body.action, serviceFeeUsd ?? 0);
    if (!transition.ok) {
      return NextResponse.json({ error: transition.error }, { status: 400 });
    }

    if (transition.action === 'invoice') {
      const frozen = await freezeWorkOrderCheckoutFee(workOrder);
      if (!frozen.ok) {
        return NextResponse.json({ error: frozen.error }, { status: frozen.status });
      }
      const existing = await prisma.paymentLink.findFirst({
        where: { workOrderId: workOrder.id, status: 'pending' },
        orderBy: { createdAt: 'desc' },
        select: PAYMENT_LINK_SELECT,
      });
      // Store the frozen bill (quote + customer fee fixed at this invoice).
      // A later PlatformConfig change does not rewrite this amount.
      const link = existing
        ? await prisma.paymentLink.update({
            where: { id: existing.id },
            data: {
              amount: frozen.total,
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
              amount: frozen.total,
              description: `Invoice for work order ${workOrder.id}`,
              status: 'pending',
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
            select: PAYMENT_LINK_SELECT,
          });
      const updated = await prisma.workOrder.update({
        where: { id },
        data: { status: transition.status, paymentStatus: transition.paymentStatus },
        ...WORK_ORDER_VIEW,
      });
      await recordStatusHistory({
        workOrderId: id,
        fromStatus: workOrder.status,
        toStatus: transition.status,
        reason: 'Invoice created',
      });
      return NextResponse.json(presentCloseoutForRole(auth.role, {
        workOrder: updated,
        invoice: {
          quoteAmount: frozen.subtotal,
          serviceFee: frozen.serviceFee,
          totalDue: frozen.total,
        },
        paymentLink: {
          ...link,
          quoteAmount: frozen.subtotal,
          serviceFee: frozen.serviceFee,
          url: `/customer/pay/${link.token}`,
        },
      }));
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
        ...WORK_ORDER_VIEW,
      });
      await recordStatusHistory({
        workOrderId: id,
        fromStatus: workOrder.status,
        toStatus: transition.status,
        reason: 'Marked paid',
      });
      return NextResponse.json(presentCloseoutForRole(auth.role, {
        workOrder: updated,
        invoice: {
          quoteAmount: transition.quoteAmount,
          serviceFee: transition.serviceFee,
          totalDue: transition.amount,
        },
      }));
    }

    const updated = await prisma.workOrder.update({
      where: { id },
      data: {
        status: transition.status,
        paymentStatus: 'paid',
        completedAt: new Date(),
      },
      ...WORK_ORDER_VIEW,
    });
    await recordStatusHistory({
      workOrderId: id,
      fromStatus: workOrder.status,
      toStatus: transition.status,
      reason: 'Job completed',
    });
    return NextResponse.json(presentCloseoutForRole(auth.role, {
      workOrder: updated,
      invoice: {
        quoteAmount: transition.quoteAmount,
        serviceFee: transition.serviceFee,
        totalDue: transition.amount,
      },
    }));
  } catch (error) {
    console.error('[workorders closeout]', error);
    return NextResponse.json({ error: 'Closeout failed.' }, { status: 500 });
  }
}
