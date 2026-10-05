import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { recordEstimateDecision } from '@/lib/recordEstimateDecision';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (auth.role !== 'customer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;
  const owned = await prisma.workOrder.findUnique({
    where: { id },
    select: { customerId: true },
  });
  if (!owned) return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
  if (owned.customerId !== auth.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  const result = await recordEstimateDecision({
    workOrderId: id,
    response: body.response,
    signature: body,
    signerIp: request.headers.get('x-forwarded-for') || 'unknown',
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  }
  return NextResponse.json({
    success: true,
    newStatus: result.newStatus,
    authorizationCreated: result.authorizationCreated,
  });
}
