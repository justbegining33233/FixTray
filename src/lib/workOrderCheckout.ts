import Stripe from 'stripe';
import prisma from '@/lib/prisma';
import stripe, { shopConnectPayoutReady } from '@/lib/stripe';
import { getConfiguredPlatformServiceFeeUsd } from '@/lib/platformFee';
import { invoiceTotal } from '@/lib/workOrderCloseout';
import { buildConnectDestinationSplit } from '@/lib/stripeConnectSplit';

const BLOCKED_STATUSES = new Set(['denied-estimate', 'cancelled', 'canceled']);

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; status: number; error: string };

function paymentIntentIdFromSession(session: Stripe.Checkout.Session): string | null {
  const paymentIntent = session.payment_intent;
  if (typeof paymentIntent === 'string' && paymentIntent.startsWith('pi_')) return paymentIntent;
  if (paymentIntent && typeof paymentIntent === 'object' && typeof paymentIntent.id === 'string' && paymentIntent.id.startsWith('pi_')) {
    return paymentIntent.id;
  }
  return null;
}

/**
 * Stripe Checkout for a work-order invoice.
 * Destination charge: shop receives the quote, FixTray keeps the configured fee.
 * Does not mark the invoice paid. Refuses when the shop cannot receive transfers.
 */
export async function createWorkOrderCheckoutSession(input: {
  workOrderId: string;
  appUrl: string;
}): Promise<CheckoutResult> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { ok: false, status: 503, error: 'Card payments are not configured.' };
  }

  const serviceFeeUsd = await getConfiguredPlatformServiceFeeUsd();
  if (serviceFeeUsd === null) {
    return { ok: false, status: 503, error: 'The platform service fee is not configured.' };
  }

  const workOrder = await prisma.workOrder.findUnique({
    where: { id: input.workOrderId },
    include: { customer: true, shop: true },
  });
  if (!workOrder) return { ok: false, status: 404, error: 'Work order not found' };
  if (workOrder.paymentStatus === 'paid') {
    return { ok: false, status: 400, error: 'This invoice is already paid.' };
  }
  const status = String(workOrder.status || '').toLowerCase();
  if (BLOCKED_STATUSES.has(status)) {
    return { ok: false, status: 400, error: 'This work order cannot be paid.' };
  }

  const bill = invoiceTotal(workOrder, serviceFeeUsd);
  const split = buildConnectDestinationSplit({
    quoteUsd: bill.quoteAmount,
    serviceFeeUsd: bill.serviceFee,
    connectedAccountId: workOrder.shop?.stripeAccountId,
  });
  if (!split.ok) return { ok: false, status: split.status, error: split.error };

  const payoutReady = await shopConnectPayoutReady(split.destination);
  if (!payoutReady) {
    return {
      ok: false,
      status: 409,
      error: "This shop's Stripe account cannot receive payouts yet. Finish Connect onboarding, then try again.",
    };
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: 'usd',
        product_data: {
          name: `Work Order #${workOrder.id.slice(-8)}`,
          description: `${workOrder.shop?.shopName ?? 'Auto Shop'} - ${
            typeof workOrder.issueDescription === 'string'
              ? workOrder.issueDescription.slice(0, 100)
              : 'Vehicle Service'
          }`,
        },
        unit_amount: split.quoteCents,
      },
      quantity: 1,
    },
  ];
  if (split.applicationFeeCents > 0) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'FixTray Service Fee',
          description: 'Platform service fee',
        },
        unit_amount: split.applicationFeeCents,
      },
      quantity: 1,
    });
  }

  const metadata = {
    workOrderId: workOrder.id,
    customerId: workOrder.customerId,
    shopId: workOrder.shopId,
    fixtrayServiceFeeCents: String(split.applicationFeeCents),
    shopPayoutCents: String(split.shopPayoutCents),
  };

  const appUrl = input.appUrl.replace(/\/$/, '');
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: lineItems,
    metadata,
    customer_email: workOrder.customer?.email ?? undefined,
    success_url: `${appUrl}/payment/success?workOrderId=${workOrder.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/payment/cancel?workOrderId=${workOrder.id}`,
    payment_intent_data: {
      ...split.paymentIntentData,
      metadata,
    },
  });

  const paymentIntentId = paymentIntentIdFromSession(session);
  await prisma.workOrder.update({
    where: { id: workOrder.id },
    data: {
      paymentStatus: 'pending',
      ...(paymentIntentId ? { paymentIntentId } : {}),
    },
  });

  if (!session.url) return { ok: false, status: 500, error: 'Failed to create checkout session' };
  return { ok: true, url: session.url };
}
