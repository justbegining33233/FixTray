import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { isCustomerVisibleNotification } from '@/lib/customerNotifications';

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  
  if (auth.role !== 'customer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  try {
    const notifications = await prisma.notification.findMany({
      where: { customerId: auth.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    
    return NextResponse.json(notifications.filter(isCustomerVisibleNotification));
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  
  if (auth.role !== 'customer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  try {
    const { searchParams } = new URL(request.url);
    let body: { notificationId?: string; id?: string; action?: string } = {};
    if (request.headers.get('content-type')?.includes('application/json')) {
      body = await request.json().catch(() => ({}));
    }
    const notificationId = searchParams.get('id') || body.notificationId || body.id;
    const action = searchParams.get('action') || body.action;
    
    if (action === 'markAllRead') {
      await prisma.notification.updateMany({
        where: { customerId: auth.id, read: false },
        data: { read: true, readAt: new Date() },
      });
      return NextResponse.json({ success: true });
    }
    
    if (notificationId) {
      const updated = await prisma.notification.updateMany({
        where: {
          id: notificationId,
          customerId: auth.id,
        },
        data: { read: true, readAt: new Date() },
      });
      if (updated.count === 0) {
        return NextResponse.json({ success: false }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ success: false }, { status: 400 });
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  
  if (auth.role !== 'customer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get('id');
    
    if (!notificationId) {
      return NextResponse.json({ error: 'Notification ID required' }, { status: 400 });
    }
    
    await prisma.notification.delete({
      where: {
        id: notificationId,
        customerId: auth.id,
      },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json({ error: 'Failed to delete notification' }, { status: 500 });
  }
}
