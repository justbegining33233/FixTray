import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

function getAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  if (!decoded || !['shop', 'manager', 'tech'].includes(decoded.role)) return null;
  return decoded as { id: string; role: string; shopId?: string };
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuth(request);
    if (!auth || !['shop', 'manager'].includes(auth.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const date = body.date ? new Date(body.date) : null;
    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    const blockedDate = await prisma.shopBlockedDate.create({
      data: {
        shopId: auth.shopId || auth.id,
        date,
        reason: body.reason || null,
      },
    });

    return NextResponse.json(blockedDate);
  } catch (error: unknown) {
    console.error('Error adding blocked date:', error);
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'This date is already blocked' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to add blocked date' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = getAuth(request);
    if (!auth || !['shop', 'manager'].includes(auth.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Date ID is required' }, { status: 400 });
    }

    const shopId = auth.shopId || auth.id;
    await prisma.shopBlockedDate.deleteMany({ where: { id, shopId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing blocked date:', error);
    return NextResponse.json({ error: 'Failed to remove blocked date' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = getAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const shopId = auth.shopId || auth.id;
    const blockedDates = await prisma.shopBlockedDate.findMany({
      where: {
        shopId,
        date: { gte: new Date() },
      },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({ blockedDates });
  } catch (error) {
    console.error('Error fetching blocked dates:', error);
    return NextResponse.json({ error: 'Failed to fetch blocked dates' }, { status: 500 });
  }
}
