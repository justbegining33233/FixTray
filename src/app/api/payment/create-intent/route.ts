import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { createPaymentIntent } from '@/lib/stripe';
import prisma from '@/lib/prisma';
import { getPlatformServiceFeeUsd } from '@/lib/platformFee';
import { invoiceTotal } from '@/lib/workOrderCloseout';
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
    if (bill.quoteAmount <= 0) {
      return NextResponse.json({ error: 'No estimate available' }, { status: 400 });
    }
    const serviceFee = bill.serviceFee;
    const totalAmount = bill.amount;

    // Fetch shop's Stripe connected account for automatic split
    const shop = await prisma.shop.findUnique({ where: { id: workOrder.shopId } });

    // Create payment intent — platform fee goes to FixTray, rest to shop when connected
    const paymentIntent = await createPaymentIntent(
      totalAmount,
      { workOrderId: workOrder.id, customerId: workOrder.customerId },
      shop?.stripeAccountId ?? undefined,
      serviceFee,
    );
    
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
