import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { sendPushToCustomer } from '@/lib/serverPush';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import { z } from 'zod';

const pushNotificationSchema = z.object({
  customerId: z.string().min(1, 'Customer ID required'),
  title: z.string().min(1, 'Title required'),
  body: z.string().min(1, 'Body required'),
  data: z.optional(z.record(z.string(), z.any())),
  tag: z.string().optional(),
  requireInteraction: z.boolean().optional(),
});

/**
 * POST /api/push/send-to-customer
 * Send a push notification to a specific customer
 */
export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'manager', 'admin', 'tech']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const validated = pushNotificationSchema.parse(body);

    // Verify the customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: validated.customerId },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Verify access (shop can only send to their customers)
    if (auth.role === 'shop') {
      const isCustomer = await prisma.workOrder.findFirst({
        where: {
          customerId: validated.customerId,
          shopId: auth.id,
        },
      });

      if (!isCustomer) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        );
      }
    }

    // Send the notification
    await sendPushToCustomer(validated.customerId, {
      title: validated.title,
      body: validated.body,
      icon: '/icon-192x192.png',
      tag: validated.tag,
      requireInteraction: validated.requireInteraction || false,
      data: validated.data || {},
    });

    // Log notification if notification model exists
    try {
      await prisma.notification.create({
        data: {
          customerId: validated.customerId,
          type: 'push',
          title: validated.title,
          message: validated.body,
          deliveryMethod: 'push',
        },
      });
    } catch {
      // Silently fail if notification model is different
    }

    logger.info('Push notification sent', {
      customerId: validated.customerId,
      title: validated.title,
      sentBy: auth.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Push notification sent',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Error sending push notification', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
