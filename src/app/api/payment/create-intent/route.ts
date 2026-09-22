import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { createPaymentIntent, shopConnectPayoutReady } from '@/lib/stripe';
import prisma from '@/lib/prisma';
import { getPlatformServiceFeeUsd } from '@/lib/platformFee';
import { invoiceTotal } from '@/lib/workOrderCloseout';
import { buildConnectDestinationSplit } from '@/lib/stripeConnectSplit';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (!request.headers.get('authorization')) {
    const ok = await (await import('@/lib/csrf')).validateCsrf(request);
    if (!ok) return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }
  
  try {
    const { workOrderId } = await request.json();
    
    // Get work order
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: { customer: true },
    });
    
    if (!workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }
    
    // Check authorization
    if (auth.role === 'customer' && workOrder.customerId !== auth.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const bill = invoiceTotal(workOrder, await getPlatformServiceFeeUsd());
    const shop = await prisma.shop.findUnique({ where: { id: workOrder.shopId } });
    const split = buildConnectDestinationSplit({
      quoteUsd: bill.quoteAmount,
      serviceFeeUsd: bill.serviceFee,
      connectedAccountId: shop?.stripeAccountId,
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

    const serviceFee = bill.serviceFee;
    const totalAmount = bill.amount;

    // Destination charge: application fee is the live platform fee only.
    const paymentIntent = await createPaymentIntent(split, {
      workOrderId: workOrder.id,
      customerId: workOrder.customerId,
      shopId: workOrder.shopId,
    });
    
    // Update work order
    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        paymentIntentId: paymentIntent.id,
        paymentStatus: 'pending',
      },
    });
    
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount: totalAmount,
      serviceFee,
    });
  } catch (error) {
    logger.error('Payment intent error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to create payment intent' }, { status: 500 });
  }
}
