import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import { getPlatformServiceFeeUsd } from '@/lib/platformFee';
import { invoiceTotal } from '@/lib/workOrderCloseout';
import stripe, { shopConnectPayoutReady } from '@/lib/stripe';
import { buildConnectDestinationSplit } from '@/lib/stripeConnectSplit';
import Stripe from 'stripe';

/**
 * POST /api/payment/checkout
 * Creates a Stripe Checkout Session for a work order.
 * Customer is redirected to Stripe's hosted page — no card form needed.
 */
export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { workOrderId } = await request.json();

    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: { customer: true, shop: true },
    });

    if (!workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }

    if (auth.role === 'customer' && workOrder.customerId !== auth.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (workOrder.status !== 'waiting-for-payment') {
      return NextResponse.json({ error: 'Work order is not ready for payment' }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fixtray.app';
    const bill = invoiceTotal(workOrder, await getPlatformServiceFeeUsd());
    const split = buildConnectDestinationSplit({
      quoteUsd: bill.quoteAmount,
      serviceFeeUsd: bill.serviceFee,
      connectedAccountId: workOrder.shop?.stripeAccountId,
    });
    if (!split.ok) {
      return NextResponse.json({ error: split.error }, { status: split.status });
    }

    const payoutReady = await shopConnectPayoutReady(split.destination);
    if (!payoutReady) {
      return NextResponse.json(
        {
          error:
            "This shop's Stripe account cannot receive payouts yet. Finish Connect onboarding, then try again.",
        },
        { status: 409 }
      );
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Work Order #${workOrder.id.slice(-8)}`,
            description: `${workOrder.shop?.shopName ?? 'Auto Shop'} — ${
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

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      metadata,
      customer_email: workOrder.customer?.email ?? undefined,
      success_url: `${appUrl}/payment/success?workOrderId=${workOrder.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/payment/cancel?workOrderId=${workOrder.id}`,
      // Destination charge: application_fee_amount is the live FixTray fee only.
      // Stripe transfers the rest (labor, parts, shop fees) to the connected account.
      payment_intent_data: {
        ...split.paymentIntentData,
        metadata,
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: { paymentIntentId: session.id, paymentStatus: 'pending' },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logger.error('Checkout session error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
