import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import prisma from '@/lib/prisma';
import stripe from '@/lib/stripe';
import { sendPaymentConfirmationEmail } from '@/lib/emailService';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Additional security: Check for custom webhook secret header
    const webhookSecret = request.headers.get('x-webhook-secret');
    if (process.env.CUSTOM_WEBHOOK_SECRET && webhookSecret !== process.env.CUSTOM_WEBHOOK_SECRET) {
      logger.warn('Invalid custom webhook secret provided');
      return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 });
    }

    const sig = request.headers.get('stripe-signature');
    if (!sig) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripeWebhookSecret) {
      logger.error('STRIPE_WEBHOOK_SECRET environment variable not configured', new Error('Missing STRIPE_WEBHOOK_SECRET'));
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }
    
    const body = await request.text();
    const event = stripe.webhooks.constructEvent(
      body,
      sig,
      stripeWebhookSecret
    );
    
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const workOrderId = paymentIntent.metadata.workOrderId;
      
      // Update work order
      const workOrder = await prisma.workOrder.update({
        where: { id: workOrderId },
        data: {
          status: 'closed',
          paymentStatus: 'paid',
          amountPaid: paymentIntent.amount / 100,
          completedAt: new Date(),
        },
        include: { customer: true },
      });
      
      // Send confirmation email (queue for retry if fails)
      await asyncErrorHandler(
        () => sendPaymentConfirmationEmail(
          workOrder.customer.email,
          workOrder.id,
          workOrder.amountPaid!
        ),
        {
          context: 'sendPaymentConfirmationEmail',
          shouldQueue: true,
          metadata: { workOrderId: workOrder.id, customerId: workOrder.customerId },
        }
      );
      
      // Create notification
      try {
        await prisma.notification.create({
          data: {
            customerId: workOrder.customerId,
            type: 'payment',
            title: 'Payment Successful',
            message: `Payment of $${workOrder.amountPaid!.toFixed(2)} received for work order ${workOrder.id}`,
            workOrderId: workOrder.id,
            deliveryMethod: 'in-app',
          },
        });
      } catch (error) {
        logger.warn('Failed to create payment notification', error, { workOrderId: workOrder.id });
      }

      // Dispatch webhook for payment received
      const { dispatchWebhook } = await import('@/lib/webhookService');
      await asyncErrorHandler(
        () => dispatchWebhook(workOrder.shopId, 'payment.received', {
          workOrderId: workOrder.id,
          amount: workOrder.amountPaid,
          customerId: workOrder.customerId,
        }),
        {
          context: 'dispatchWebhook',
          severity: 'warn',
          shouldQueue: true,
          metadata: { workOrderId: workOrder.id, event: 'payment.received' },
        }
      );

      // Award loyalty points
      const { awardLoyaltyPoints } = await import('@/lib/loyaltyService');
      await asyncErrorHandler(
        () => awardLoyaltyPoints(workOrder.customerId, workOrder.id, workOrder.amountPaid || 0),
        {
          context: 'awardLoyaltyPoints',
          severity: 'warn',
          shouldQueue: true,
          metadata: { customerId: workOrder.customerId, workOrderId: workOrder.id },
        }
      );
    }
    
    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('Payment webhook error', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}
