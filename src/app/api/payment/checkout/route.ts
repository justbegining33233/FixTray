import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import { FIXTRAY_SERVICE_FEE } from '@/lib/constants';
import stripe from '@/lib/stripe';
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

    const estimate = workOrder.estimate as any;
    if (!estimate?.amount) {
      return NextResponse.json({ error: 'No estimate on this work order yet' }, { status: 400 });
    }

    if (workOrder.status !== 'waiting-for-payment') {
      return NextResponse.json({ error: 'Work order is not ready for payment' }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fixtray.app';

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
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
            unit_amount: Math.round(estimate.amount * 100),
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'FixTray Service Fee',
              description: 'Platform service fee',
            },
            unit_amount: Math.round(FIXTRAY_SERVICE_FEE * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        workOrderId: workOrder.id,
        customerId: workOrder.customerId,
        shopId: workOrder.shopId,
      },
      customer_email: workOrder.customer?.email ?? undefined,
      success_url: `${appUrl}/payment/success?workOrderId=${workOrder.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/payment/cancel?workOrderId=${workOrder.id}`,
    };

    // If shop has a connected Stripe account, auto-split: $5 stays, rest transfers to shop
    if (workOrder.shop?.stripeAccountId) {
      sessionParams.payment_intent_data = {
        application_fee_amount: Math.round(FIXTRAY_SERVICE_FEE * 100),
        transfer_data: { destination: workOrder.shop.stripeAccountId },
      };
    }

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
