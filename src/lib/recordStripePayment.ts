import prisma from '@/lib/prisma';
import { planCardPayment, usdToCents } from '@/lib/books/money';
import { writeBooksEntries } from '@/lib/books/persist';
import { quoteAmount } from '@/lib/workOrderCloseout';

/**
 * Record a real Stripe charge on a work order.
 * Saves the PaymentIntent id. Leaves job status alone so closeout stays
 * invoice → paid (waiting for the shop to complete) → complete.
 */
export async function recordStripeWorkOrderPayment(input: {
  workOrderId: string;
  paymentIntentId: string;
  amountCents: number;
}) {
  if (!input.paymentIntentId.startsWith('pi_')) {
    throw new Error('A PaymentIntent id is required to mark this invoice paid.');
  }
  const amountPaid = Math.round(input.amountCents) / 100;
  const updated = await prisma.workOrder.update({
    where: { id: input.workOrderId },
    data: {
      paymentStatus: 'paid',
      amountPaid,
      paymentIntentId: input.paymentIntentId,
    },
    include: {
      customer: true,
      shop: { select: { id: true, shopName: true } },
    },
  });
  await prisma.paymentLink.updateMany({
    where: { workOrderId: input.workOrderId, status: { not: 'paid' } },
    data: { status: 'paid', paidAt: new Date(), amount: amountPaid },
  });
  const plan = planCardPayment({
    paymentIntentId: input.paymentIntentId,
    workOrderId: updated.id,
    shopId: updated.shopId,
    jobCents: usdToCents(quoteAmount(updated)),
    chargedCents: Math.round(input.amountCents),
    actorId: 'stripe',
    at: new Date().toISOString(),
  });
  if (plan.ok) {
    await writeBooksEntries({
      shopId: updated.shopId,
      workOrderId: updated.id,
      entries: plan.entries,
      audit: plan.audit,
    });
  }
  return updated;
}
