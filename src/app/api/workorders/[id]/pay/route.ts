import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { planInPersonPayment, usdToCents, type InPersonMethod } from '@/lib/books/money';
import { findShopJob } from '@/lib/books/loadShopBooks';
import { writeBooksEntries } from '@/lib/books/persist';
import { getConfiguredPlatformServiceFeeUsd } from '@/lib/platformFee';
import { createWorkOrderCheckoutSession } from '@/lib/workOrderCheckout';

const PAY_ROLES = new Set(['shop', 'manager', 'admin', 'superadmin']);
const IN_PERSON = new Set<InPersonMethod>(['cash', 'check', 'other']);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (!PAY_ROLES.has(auth.role)) {
    return NextResponse.json({ error: 'Only the shop or a manager can take payment.' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const method = String(body?.method || '');
  if (method !== 'card' && !IN_PERSON.has(method as InPersonMethod)) {
    return NextResponse.json({ error: 'Choose card, cash, check, or other.' }, { status: 400 });
  }

  const workOrder = await prisma.workOrder.findUnique({ where: { id } });
  if (!workOrder) return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
  const shopId = auth.role === 'shop' ? auth.id : auth.shopId;
  if (auth.role !== 'superadmin' && auth.role !== 'admin' && workOrder.shopId !== shopId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  if (method === 'card') {
    const origin = request.nextUrl.origin;
    const session = await createWorkOrderCheckoutSession({ workOrderId: id, appUrl: origin });
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });
    return NextResponse.json({ ok: true, method: 'card', url: session.url });
  }

  const savedFeeUsd = await getConfiguredPlatformServiceFeeUsd();
  if (savedFeeUsd === null) {
    return NextResponse.json({ error: 'The platform service fee is not configured.' }, { status: 503 });
  }
  const jobCents = usdToCents(workOrder.estimatedCost);
  const job = await findShopJob(workOrder.shopId, id);
  const alreadyReceivedCents = job?.shopReceivedCents || 0;
  const feeAlreadyRecorded = (job?.platformFeeCents || 0) > 0;
  const remaining = Math.max(0, jobCents - alreadyReceivedCents);
  const tendered = body?.amountCents == null ? remaining : Number(body.amountCents);
  const planned = planInPersonPayment({
    workOrderId: id,
    shopId: workOrder.shopId,
    jobCents,
    alreadyReceivedCents: Math.max(0, alreadyReceivedCents),
    tenderedCents: tendered,
    savedFeeCents: Math.round(savedFeeUsd * 100),
    method: method as InPersonMethod,
    feeAlreadyRecorded,
    actorId: auth.id,
    at: new Date().toISOString(),
  });
  if (!planned.ok) return NextResponse.json({ error: planned.error }, { status: 400 });
  await writeBooksEntries({
    shopId: workOrder.shopId,
    workOrderId: id,
    entries: planned.entries,
    audit: planned.audit,
  });
  const updated = await prisma.workOrder.update({
    where: { id },
    data: {
      amountPaid: planned.shopReceivedCents / 100,
      paymentStatus: planned.paymentStatus,
    },
  });
  return NextResponse.json({
    ok: true,
    method,
    workOrder: updated,
    shopReceivedCents: planned.shopReceivedCents,
    platformFeeCents: planned.platformFeeCents,
    feeDeductedFromShop: false,
    paymentStatus: planned.paymentStatus,
    connectRequired: false,
  });
}
