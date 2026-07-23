import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { refundPayment } from '@/lib/stripe';
import logger from '@/lib/logger';
import { z } from 'zod';

const refundSchema = z.object({
  paymentIntentId: z.string().min(1, 'Payment intent ID required'),
  amount: z.number().optional().refine(a => !a || a > 0, 'Amount must be positive'),
  reason: z.string().optional(),
});

/**
 * POST /api/payment/refund
 * Process refund for a payment (within 90-day window)
 */
export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'manager', 'admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const validated = refundSchema.parse(body);

    // Find the work order
    const workOrder = await prisma.workOrder.findFirst({
      where: { paymentIntentId: validated.paymentIntentId },
    });

    if (!workOrder) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Check authorization - only shop owner, manager, or admin can refund
    if (auth.role === 'shop' && workOrder.shopId !== auth.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (auth.role === 'manager' && workOrder.shopId !== auth.shopId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Verify payment was completed
    if (workOrder.paymentStatus !== 'paid') {
      return NextResponse.json(
        { error: 'Only paid orders can be refunded' },
        { status: 400 }
      );
    }

    // Check 90-day window
    const paymentDate = new Date(workOrder.completedAt || workOrder.createdAt);
    const daysSincePayment = Math.floor(
      (Date.now() - paymentDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSincePayment > 90) {
      return NextResponse.json(
        { error: `Refund window expired. Paid ${daysSincePayment} days ago (90-day limit)` },
        { status: 400 }
      );
    }

    // Calculate refund amount
    const refundAmount = validated.amount || workOrder.amountPaid || 0;

    if (refundAmount <= 0) {
      return NextResponse.json(
        { error: 'Refund amount must be greater than 0' },
        { status: 400 }
      );
    }

    if (refundAmount > (workOrder.amountPaid || 0)) {
      return NextResponse.json(
        { error: `Refund amount ($${refundAmount}) exceeds paid amount ($${workOrder.amountPaid})` },
        { status: 400 }
      );
    }

    // Process refund with Stripe
    const stripeRefund = await refundPayment(validated.paymentIntentId, refundAmount);

    if (!stripeRefund.id) {
      throw new Error('Stripe refund failed');
    }

    // Create audit trail entry
    await prisma.paymentHistory.create({
      data: {
        stripePaymentIntentId: validated.paymentIntentId,
        amount: refundAmount,
        currency: 'usd',
        status: 'refunded',
        description: `Refund: ${validated.reason || 'Manual refund'}`,
        paidAt: new Date(),
      },
    });

    // Update work order payment status if full refund
    if (refundAmount === workOrder.amountPaid) {
      await prisma.workOrder.update({
        where: { id: workOrder.id },
        data: {
          paymentStatus: 'refunded',
          amountPaid: 0,
          status: 'pending', // Reset to pending
        },
      });
    } else {
      // Partial refund - reduce amount paid
      await prisma.workOrder.update({
        where: { id: workOrder.id },
        data: {
          amountPaid: (workOrder.amountPaid || 0) - refundAmount,
          paymentStatus: 'pending',
        },
      });
    }

    // Create notification for customer
    await prisma.notification.create({
      data: {
        customerId: workOrder.customerId,
        type: 'payment',
        title: 'Refund Processed',
        message: `A refund of $${refundAmount.toFixed(2)} has been processed for work order ${workOrder.id}. It may take 5-10 business days to appear in your account.`,
        workOrderId: workOrder.id,
        deliveryMethod: 'in-app',
      },
    }).catch(() => {}); // Silently fail if notification creation fails

    logger.info('Refund processed', {
      workOrderId: workOrder.id,
      refundAmount,
      reason: validated.reason,
      processedBy: auth.id,
    });

    return NextResponse.json(
      {
        success: true,
        refund: {
          refundId: stripeRefund.id,
          workOrderId: workOrder.id,
          amount: refundAmount,
          status: stripeRefund.status,
          reason: validated.reason,
          daysOld: daysSincePayment,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Error processing refund', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to process refund' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/payment/refund?workOrderId=xxx
 * Get refund history for a work order
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['customer', 'shop', 'manager', 'admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const workOrderId = searchParams.get('workOrderId');

    if (!workOrderId) {
      return NextResponse.json(
        { error: 'workOrderId required' },
        { status: 400 }
      );
    }

    // Get work order to verify access
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
    });

    if (!workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }

    // Verify access
    if (
      auth.role === 'customer' &&
      workOrder.customerId !== auth.id
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (auth.role === 'shop' && workOrder.shopId !== auth.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (auth.role === 'manager' && workOrder.shopId !== auth.shopId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get refund history
    const refunds = await prisma.paymentHistory.findMany({
      where: { 
        status: 'refunded',
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json(refunds);
  } catch (error) {
    logger.error('Error fetching refund history', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch refund history' },
      { status: 500 }
    );
  }
}
