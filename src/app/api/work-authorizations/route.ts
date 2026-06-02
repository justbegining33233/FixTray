import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';
import crypto from 'crypto';

const ACTIVE_WORK_ORDER_STATUSES = new Set([
  'pending',
  'assigned',
  'in-progress',
  'waiting-estimate',
  'waiting-for-payment',
]);

const ALLOWED_SERVICE_LOCATIONS = new Set(['in-shop', 'roadside', 'roadcall']);

function hasQuoteData(workOrder: { estimate: unknown; estimatedCost: number | null }) {
  if (typeof workOrder.estimatedCost === 'number' && workOrder.estimatedCost > 0) {
    return true;
  }

  if (!workOrder.estimate || typeof workOrder.estimate !== 'object') {
    return false;
  }

  const estimate = workOrder.estimate as Record<string, unknown>;
  const amountCandidates = [estimate.amount, estimate.total, estimate.subtotal, estimate.grandTotal];
  if (amountCandidates.some((value) => Number(value) > 0)) {
    return true;
  }

  const lineItems = estimate.lineItems;
  if (Array.isArray(lineItems) && lineItems.length > 0) {
    return true;
  }

  const items = estimate.items;
  if (Array.isArray(items) && items.length > 0) {
    return true;
  }

  return false;
}

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const shopId = auth.role === 'shop' ? auth.id : (auth as any).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });
  const list = await prisma.workAuthorization.findMany({ where: { shopId }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const shopId = auth.role === 'shop' ? auth.id : (auth as any).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });

  const body = await req.json();
  const workOrderId = typeof body.workOrderId === 'string' ? body.workOrderId.trim() : '';
  if (!workOrderId) {
    return NextResponse.json(
      { error: 'workOrderId is required. Create authorizations only from an existing quoted work order.' },
      { status: 400 }
    );
  }

  const workOrder = await prisma.workOrder.findFirst({
    where: { id: workOrderId, shopId },
    select: {
      id: true,
      shopId: true,
      customerId: true,
      serviceLocation: true,
      status: true,
      issueDescription: true,
      estimatedCost: true,
      estimate: true,
    },
  });

  if (!workOrder) {
    return NextResponse.json({ error: 'Work order not found for this shop.' }, { status: 404 });
  }

  const normalizedLocation = String(workOrder.serviceLocation || '').toLowerCase();
  if (!ALLOWED_SERVICE_LOCATIONS.has(normalizedLocation)) {
    return NextResponse.json(
      { error: 'Authorization can only be created for in-shop or roadcall work orders.' },
      { status: 400 }
    );
  }

  const normalizedStatus = String(workOrder.status || '').toLowerCase();
  if (!ACTIVE_WORK_ORDER_STATUSES.has(normalizedStatus)) {
    return NextResponse.json(
      { error: 'Authorization can only be created for active current work orders.' },
      { status: 400 }
    );
  }

  if (!hasQuoteData({ estimate: workOrder.estimate, estimatedCost: workOrder.estimatedCost })) {
    return NextResponse.json(
      { error: 'A quote/estimate is required before creating a work authorization.' },
      { status: 400 }
    );
  }

  const workSummary = typeof body.workSummary === 'string' && body.workSummary.trim()
    ? body.workSummary.trim()
    : String(workOrder.issueDescription || '').trim();

  if (!workSummary) {
    return NextResponse.json({ error: 'Work summary is required.' }, { status: 400 });
  }

  const token = crypto.randomBytes(24).toString('hex');
  const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const wa = await prisma.workAuthorization.create({
    data: {
      shopId,
      workOrderId: workOrder.id,
      customerId: workOrder.customerId || null,
      authToken: token,
      estimateTotal: body.estimateTotal ? Number(body.estimateTotal) : (workOrder.estimatedCost ?? null),
      workSummary,
      expiresAt: expiry,
      status: 'pending',
      notes: body.notes,
    },
  });
  return NextResponse.json({ ...wa, link: `/customer/authorization/${token}` }, { status: 201 });
}
