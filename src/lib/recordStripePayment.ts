import prisma from '@/lib/prisma';

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
  return updated;
}
