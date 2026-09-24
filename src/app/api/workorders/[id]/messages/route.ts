import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import logger from '@/lib/logger';
import { workOrderDirectMessage, workOrderSeenWhere } from '@/lib/workOrderMessagePersist';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  let workOrderId = '';
  try {
    workOrderId = (await params).id;
    const body = await request.json();
    const messageBody: string = String(body?.body || '').trim();

    if (!messageBody) {
      return NextResponse.json({ error: 'Message body is required' }, { status: 400 });
    }
    if (messageBody.length > 5000) {
      return NextResponse.json({ error: 'Message exceeds 5000 characters' }, { status: 400 });
    }

    const wo = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true } },
        shop:     { select: { id: true, shopName: true } },
      },
    });

    if (!wo) return NextResponse.json({ error: 'Work order not found' }, { status: 404 });

    const authorized =
      auth.role === 'superadmin' ||
      (auth.role === 'customer' && wo.customerId === auth.id) ||
      (auth.role === 'shop'     && wo.shopId === auth.id) ||
      ((auth.role === 'tech' || auth.role === 'manager') && wo.shopId === auth.shopId);

    if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    // Resolve sender display name
    let senderName: string = auth.role;
    if (auth.role === 'shop') {
      senderName = wo.shop?.shopName || 'Shop';
    } else if (auth.role === 'customer') {
      senderName = wo.customer
        ? `${wo.customer.firstName} ${wo.customer.lastName}`.trim()
        : 'Customer';
    } else if (auth.role === 'tech' || auth.role === 'manager') {
      const tech = await prisma.tech.findUnique({
        where: { id: auth.id },
        select: { firstName: true, lastName: true },
      });
      if (tech) senderName = `${tech.firstName} ${tech.lastName}`.trim();
    }

    // Save the work-order row first. A shop-inbox mirror must not roll the chat line back.
    const message = await prisma.message.create({
      data: { workOrderId, sender: auth.role, senderName, body: messageBody },
    });

    const customerName = wo.customer
      ? `${wo.customer.firstName} ${wo.customer.lastName}`.trim()
      : 'Customer';
    const mirror = workOrderDirectMessage({
      workOrderId,
      shopId: wo.shopId,
      shopName: wo.shop?.shopName,
      customerId: wo.customerId,
      customerName,
      senderRole: auth.role,
      senderId: auth.id,
      senderName: auth.role === 'customer' ? customerName : senderName,
      body: messageBody,
    });
    if (mirror) {
      try {
        await prisma.directMessage.create({ data: mirror });
      } catch (mirrorError) {
        logger.error('Work order message saved but shop inbox mirror failed', {
          error: mirrorError instanceof Error ? mirrorError.message : String(mirrorError),
          workOrderId,
        });
      }
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    logger.error('Error sending work order message', {
      error: error instanceof Error ? error.message : String(error),
      workOrderId
    });
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

/** Mark the mirrored inbox rows for this work-order chat as seen. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const workOrderId = (await params).id;
    const wo = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: { id: true, customerId: true, shopId: true },
    });
    if (!wo) return NextResponse.json({ error: 'Work order not found' }, { status: 404 });

    const where = workOrderSeenWhere({
      viewer: { id: auth.id, role: auth.role, shopId: auth.shopId },
      workOrder: wo,
    });
    if (!where) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const updated = await prisma.directMessage.updateMany({
      where,
      data: { isRead: true, readAt: new Date() },
    });
    return NextResponse.json({ success: true, updated: updated.count });
  } catch (error) {
    logger.error('Error marking work order thread seen', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to mark messages read' }, { status: 500 });
  }
}
