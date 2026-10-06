import { NextRequest, NextResponse } from 'next/server';
import stripe from '@/lib/stripe';
import Stripe from 'stripe';
import { sendPaymentReceiptEmail } from '@/lib/emailService';
import { pushPaymentConfirmed } from '@/lib/serverPush';
import logger from '@/lib/logger';
import { recordStripeWorkOrderPayment } from '@/lib/recordStripePayment';
import { recordFeeSettlement } from '@/lib/recordFeeSettlement';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error('STRIPE_WEBHOOK_SECRET not configured', { error: 'Missing STRIPE_WEBHOOK_SECRET' });
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error('[WEBHOOK] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }


  try {
    switch (event.type) {
      // Checkout completed - handles work-order payments
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata ?? {};
        if (metadata.kind === 'fixtray_fee_settlement' && metadata.shopId) {
          const paymentIntentId = typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id;
          if (session.payment_status === 'paid' && paymentIntentId?.startsWith('pi_')) {
            await recordFeeSettlement({
              shopId: metadata.shopId,
              paymentIntentId,
              amountCents: session.amount_total ?? Number(metadata.owedCents || 0),
            });
          }
          break;
        }
        const { workOrderId } = metadata;

        // -- Work-order payment flow -------------------------------------------
        if (!workOrderId) break;


        const paymentIntentId = typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id;
        if (session.payment_status !== 'paid' || !paymentIntentId || !paymentIntentId.startsWith('pi_')) {
          break;
        }

        const updatedWO = await recordStripeWorkOrderPayment({
          workOrderId,
          paymentIntentId,
          amountCents: session.amount_total ?? 0,
        });

        // Send payment receipt email
        if (updatedWO.customer?.email) {
          sendPaymentReceiptEmail(
            updatedWO.customer.email,
            `${updatedWO.customer.firstName} ${updatedWO.customer.lastName}`,
            workOrderId,
            (session.amount_total ?? 0) / 100,
            updatedWO.shop?.shopName || 'Your Shop',
            updatedWO.issueDescription || 'Vehicle Service',
            updatedWO.shop?.id,
          ).catch(console.error);
        }

        // Send push notification
        if (updatedWO.customerId) {
          pushPaymentConfirmed(updatedWO.customerId, (session.amount_total ?? 0) / 100, workOrderId).catch(console.error);
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[WEBHOOK] Error processing event:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
