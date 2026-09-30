import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import {
  acknowledgeAttentionFlag,
  flagVisibleTo,
  parseAttentionFlag,
  staffShopId,
} from '@/lib/notificationFlags';

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const shopId = staffShopId(auth);
  if (!shopId) return NextResponse.json({ flags: [] });

  try {
    const rows = await prisma.notification.findMany({
      where: {
        AND: [
          { metadata: { contains: '"flagged":true' } },
          { metadata: { contains: `"shopId":"${shopId}"` } },
          { metadata: { contains: '"acknowledged":false' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        title: true,
        message: true,
        workOrderId: true,
        metadata: true,
        createdAt: true,
        read: true,
      },
    });

    const flags = rows.flatMap((row) => {
      const flag = parseAttentionFlag(row.metadata);
      if (!flag || !flagVisibleTo(flag, auth)) return [];
      return [{
        id: row.id,
        title: row.title,
        message: row.message,
        workOrderId: row.workOrderId,
        createdAt: row.createdAt,
        read: row.read,
        flagged: true,
        flagLabel: flag.flagLabel,
        event: flag.event,
      }];
    });

    return NextResponse.json({ flags });
  } catch {
    return NextResponse.json({ flags: [] });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const shopId = staffShopId(auth);
  if (!shopId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  let body: { id?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ error: 'Notification ID required' }, { status: 400 });

  const row = await prisma.notification.findUnique({
    where: { id },
    select: { id: true, metadata: true },
  });
  if (!row?.metadata) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const flag = parseAttentionFlag(row.metadata);
  if (!flag || flag.shopId !== shopId || !flagVisibleTo({ ...flag, acknowledged: false }, auth)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const ack = acknowledgeAttentionFlag(row.metadata);
  if (!ack || ack.workOrderUpdate !== null) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.notification.update({
    where: { id: row.id },
    data: {
      metadata: ack.metadata,
      read: ack.read,
      readAt: new Date(),
    },
  });

  return NextResponse.json({
    success: true,
    acknowledged: true,
    workOrderUpdated: false,
  });
}
