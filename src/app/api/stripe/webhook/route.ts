import { NextRequest, NextResponse } from 'next/server';
import stripe from '@/lib/stripe';
import prisma from '@/lib/prisma';
import Stripe from 'stripe';
import { sendPaymentReceiptEmail } from '@/lib/emailService';
import { pushPaymentConfirmed } from '@/lib/serverPush';

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
      console.error('STRIPE_WEBHOOK_SECRET is not set');
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
        const { workOrderId } = session.metadata ?? {};

        // -- Work-order payment flow -------------------------------------------
        if (!workOrderId) break;


        const updatedWO = await prisma.workOrder.update({
          where: { id: workOrderId },
          data: {
            paymentStatus: 'paid',
            status: 'closed',
            amountPaid: (session.amount_total ?? 0) / 100,
          },
          include: {
            customer: { select: { email: true, firstName: true, lastName: true } },
            shop: { select: { shopName: true } },
          },
        });

        // Send payment receipt email
        if (updatedWO.customer?.email) {
          sendPaymentReceiptEmail(
            updatedWO.customer.email,
            `${updatedWO.customer.firstName} ${updatedWO.customer.lastName}`,
            workOrderId,
            (session.amount_total ?? 0) / 100,
            updatedWO.shop?.shopName || 'Your Shop',
            updatedWO.issueDescription || 'Vehicle Service'
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
    console.error('?? [WEBHOOK] Error processing event:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
