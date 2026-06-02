import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

const defaults = {
  workOrders: true,
  messages: true,
  reminders: true,
  system: true,
  sound: true,
  vibration: true,
};

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    if (auth.role === 'shop') {
      const settings = await prisma.shopSettings.upsert({
        where: { shopId: auth.id },
        update: {},
        create: { shopId: auth.id },
        select: { notificationPreferences: true },
      });

      return NextResponse.json({
        settings: {
          ...defaults,
          ...(settings.notificationPreferences as Record<string, unknown> || {}),
        },
      });
    }

    return NextResponse.json({ settings: defaults });
  } catch (error) {
    console.error('Notification settings fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch notification settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const nextSettings = {
      ...defaults,
      ...(body as Record<string, unknown>),
    };

    if (auth.role === 'shop') {
      await prisma.shopSettings.upsert({
        where: { shopId: auth.id },
        update: { notificationPreferences: nextSettings },
        create: { shopId: auth.id, notificationPreferences: nextSettings },
      });
    }

    return NextResponse.json({ success: true, settings: nextSettings });
  } catch (error) {
    console.error('Notification settings update error:', error);
    return NextResponse.json({ error: 'Failed to update notification settings' }, { status: 500 });
  }
}
