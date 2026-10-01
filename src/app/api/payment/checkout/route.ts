import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import { createWorkOrderCheckoutSession } from '@/lib/workOrderCheckout';

/**
 * POST /api/payment/checkout
 * Creates a Stripe Checkout Session for a work order.
 * The customer is redirected to Stripe. This route does not mark the job paid.
 */
export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { workOrderId } = await request.json();
    if (typeof workOrderId !== 'string' || !workOrderId) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }

    if (auth.role === 'customer') {
      const workOrder = await prisma.workOrder.findUnique({
        where: { id: workOrderId },
        select: { customerId: true },
      });
      if (!workOrder) return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
      if (workOrder.customerId !== auth.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fixtray.app';
    const result = await createWorkOrderCheckoutSession({ workOrderId, appUrl });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ url: result.url });
  } catch (error) {
    logger.error('Checkout session error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
