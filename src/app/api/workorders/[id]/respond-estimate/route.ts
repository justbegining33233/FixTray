import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import crypto from 'crypto';
import { customerEstimateDecision } from '@/lib/estimateAuthorization';

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
  const body = await request.json();
  const decision = customerEstimateDecision(body.response, body);
  if (!decision.ok) {
    return NextResponse.json({ error: decision.error }, { status: 400 });
  }

  const workOrder = await prisma.workOrder.findUnique({
    where: { id },
    select: {
      id: true,
      customerId: true,
      shopId: true,
      status: true,
      estimatedCost: true,
      estimate: true,
      issueDescription: true,
    },
  });

  if (!workOrder) {
    return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
  }

  // Customer must own this work order
  if (workOrder.customerId !== auth.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Only allow responding to estimate-submitted work orders
  if (workOrder.status !== 'estimate-submitted') {
    return NextResponse.json({ error: 'No pending estimate to respond to' }, { status: 400 });
  }

  const priorEstimate = workOrder.estimate && typeof workOrder.estimate === 'object'
    ? workOrder.estimate as Record<string, unknown>
    : {};
  const signedAt = new Date();

  await prisma.workOrder.update({
    where: { id },
    data: {
      status: decision.woStatus,
      estimate: {
        ...priorEstimate,
        customerDecision: {
          response: decision.response,
          signerName: decision.signerName,
          signatureData: decision.signatureData,
          signedAt: signedAt.toISOString(),
        },
      },
    },
  });

  if (decision.createAuthorization) {
    const summary = String(workOrder.issueDescription ?? '').slice(0, 1000) || 'Customer-signed estimate';
    const existing = await prisma.workAuthorization.findFirst({
      where: { workOrderId: id },
      orderBy: { createdAt: 'desc' },
    });
    const authFields = {
      status: decision.authStatus,
      signatureData: decision.signatureData,
      signedAt,
      signerName: decision.signerName,
      signerIP: request.headers.get('x-forwarded-for') || 'unknown',
      estimateTotal: workOrder.estimatedCost ?? null,
      workSummary: summary,
    };
    if (existing) {
      await prisma.workAuthorization.update({ where: { id: existing.id }, data: authFields });
    } else {
      await prisma.workAuthorization.create({
        data: {
          shopId: workOrder.shopId,
          workOrderId: id,
          customerId: workOrder.customerId ?? null,
          authToken: crypto.randomBytes(24).toString('hex'),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          ...authFields,
        },
      });
    }
  } else {
    await prisma.workAuthorization.deleteMany({
      where: { workOrderId: id, status: 'pending' },
    });
  }

  await prisma.notification.create({
    data: {
      customerId: workOrder.customerId!,
      type: 'estimate',
      title: `Estimate ${decision.response === 'accepted' ? 'Accepted' : 'Denied'} by Customer`,
      message: decision.response === 'accepted'
        ? `Customer signed and accepted the estimate for work order ${id}.`
        : `Customer signed and denied the estimate for work order ${id}. The quote is closed and no work authorization was created.`,
      workOrderId: id,
      deliveryMethod: 'in-app',
    },
  });

  return NextResponse.json({
    success: true,
    newStatus: decision.woStatus,
    authorizationCreated: decision.createAuthorization,
  });
}
