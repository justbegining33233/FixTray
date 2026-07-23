import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticateRequest } from '@/lib/middleware';
import { getSocketServer } from '@/lib/socket-server';
import logger from '@/lib/logger';

// POST /api/customers/estimates/request-new
export async function POST(request: Request) {
  try {
    const user = authenticateRequest(request as any);
    if (!user || user.role !== 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { workOrderId, message } = body;

    if (!workOrderId) {
      return NextResponse.json({ error: 'workOrderId required' }, { status: 400 });
    }

    const workOrder = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
    if (!workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }

    // Only allow customer that owns the work order to request a new estimate
    if (workOrder.customerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const shopId = workOrder.shopId;

    // Persist a notification record (for customers) so there's an audit trail
    try {
      await prisma.notification.create({
        data: {
          customerId: user.id,
          type: 'request_new_estimate',
          title: 'Customer requested a new estimate',
          message: message || `Customer requested a new estimate for work order ${workOrderId}`,
          deliveryMethod: 'in-app',
          metadata: JSON.stringify({ workOrderId, shopId }),
        },
      });
    } catch (err) {
        logger.warn('[estimate-request] Failed to create notification', err, { workOrderId });
    }

    // Emit socket event to shop room and manager role so managers get notified in real-time
    try {
      const io = getSocketServer();
      const payload = {
        workOrderId,
        shopId,
        customerId: user.id,
        message: message || null,
        timestamp: new Date().toISOString(),
      };

      if (io) {
        // Notify all managers and shop room
        io.to(`role_manager`).emit('new-estimate-request', payload);
        io.to(`shop_${shopId}`).emit('new-estimate-request', payload);
      }
    } catch (err) {
      logger.error('[estimate-request] Failed to emit socket event', err);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error requesting new estimate', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
