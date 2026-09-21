import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';
import {
  MANUAL_AUTHORIZATION_BLOCKED_MESSAGE,
  SIGNED_AUTHORIZATION_STATUS,
} from '@/lib/estimateAuthorization';

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const shopId = auth.role === 'shop' ? auth.id : (auth as any).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });
  const list = await prisma.workAuthorization.findMany({
    where: { shopId, status: SIGNED_AUTHORIZATION_STATUS },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const shopId = auth.role === 'shop' ? auth.id : (auth as any).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });

  return NextResponse.json({ error: MANUAL_AUTHORIZATION_BLOCKED_MESSAGE }, { status: 403 });
}
