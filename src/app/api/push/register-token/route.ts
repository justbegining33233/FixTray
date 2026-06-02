import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

// Compatibility endpoint for native clients that send device tokens.
export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token : '';
    if (!token) {
      return NextResponse.json({ error: 'token is required' }, { status: 400 });
    }

    await prisma.pushSubscription.upsert({
      where: { customerId: auth.id },
      update: {
        subscription: JSON.stringify({
          token,
          platform: body.platform,
          deviceId: body.deviceId,
          source: 'native-token',
        }),
      },
      create: {
        customerId: auth.id,
        subscription: JSON.stringify({
          token,
          platform: body.platform,
          deviceId: body.deviceId,
          source: 'native-token',
        }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push token registration error:', error);
    return NextResponse.json({ error: 'Failed to register push token' }, { status: 500 });
  }
}
