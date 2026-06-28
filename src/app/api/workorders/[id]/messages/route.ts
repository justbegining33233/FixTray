import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: workOrderId } = await params;
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
    let senderName = auth.role;
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

    // 1. Create work-order-specific message (shows in WO thread)
    const message = await prisma.message.create({
      data: { workOrderId, sender: auth.role, senderName, body: messageBody },
    });

    // 2. Mirror to DirectMessage so it appears in the messages page
    const woShortId = `WO-${workOrderId.slice(-8).toUpperCase()}`;
    const shopId = wo.shopId;

    type UserRole = 'admin' | 'superadmin' | 'shop' | 'tech' | 'manager' | 'customer';

    if (['shop', 'tech', 'manager'].includes(auth.role) && wo.customer) {
      const shopSenderId = auth.role === 'shop' ? auth.id : (auth.shopId || shopId);
      await prisma.directMessage.create({
        data: {
          senderId:     shopSenderId,
          senderRole:   'shop' as UserRole,
          senderName:   wo.shop?.shopName || senderName,
          receiverId:   wo.customerId,
          receiverRole: 'customer' as UserRole,
          receiverName: `${wo.customer.firstName} ${wo.customer.lastName}`.trim(),
          shopId,
          subject:      woShortId,
          body:         messageBody,
        },
      });
    } else if (auth.role === 'customer') {
      const customerName = wo.customer
        ? `${wo.customer.firstName} ${wo.customer.lastName}`.trim()
        : 'Customer';
      await prisma.directMessage.create({
        data: {
          senderId:     auth.id,
          senderRole:   'customer' as UserRole,
          senderName:   customerName,
          receiverId:   shopId,
          receiverRole: 'shop' as UserRole,
          receiverName: wo.shop?.shopName || 'Shop',
          shopId,
          subject:      woShortId,
          body:         messageBody,
        },
      });
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error('Error sending WO message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
