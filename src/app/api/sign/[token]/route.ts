import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { recordEstimateDecision } from '@/lib/recordEstimateDecision';
import { customerJobTrack } from '@/lib/customerJobTrack';

async function findByToken(token: string) {
  return prisma.workOrder.findFirst({
    where: { estimate: { path: ['counterSignToken'], equals: token } },
    include: {
      vehicle: { select: { year: true, make: true, model: true, licensePlate: true } },
      shop: { select: { shopName: true } },
      statusHistory: { orderBy: { createdAt: 'asc' } },
    },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token || token.length < 16) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const workOrder = await findByToken(token);
  if (!workOrder) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    ...customerJobTrack(workOrder),
    needsDecision: workOrder.status === 'estimate-submitted',
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const workOrder = await findByToken(token);
  if (!workOrder) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const result = await recordEstimateDecision({
    workOrderId: workOrder.id,
    response: body.response,
    signature: body,
    signerIp: request.headers.get('x-forwarded-for') || 'kiosk',
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  return NextResponse.json({ success: true, newStatus: result.newStatus });
}
