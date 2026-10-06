import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { counterBalanceDueCents, usdToCents, type InPersonMethod } from '@/lib/books/money';
import { planCounterPayment } from '@/lib/books/counterPay';
import { postCollectedTax, postPayment } from '@/lib/books/journal';
import { recordStatusHistory } from '@/lib/statusHistoryWrite';
import { findShopJob } from '@/lib/books/loadShopBooks';
import { writeBooksEntries } from '@/lib/books/persist';
import { embeddedFeeCents, readCheckoutFeeForInPerson, readFeeSnapshot } from '@/lib/feeSnapshot';
import { saveJournalDraft } from '@/lib/books/persistJournal';
import { readSalesTaxSnapshot } from '@/lib/books/shopTax';
import { quoteAmount } from '@/lib/workOrderCloseout';
import { createWorkOrderCheckoutSession } from '@/lib/workOrderCheckout';

const PAY_ROLES = new Set(['shop', 'manager', 'admin', 'superadmin']);
const IN_PERSON = new Set<InPersonMethod>(['cash', 'check', 'other', 'card']);

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
  const methodRaw = String(body?.method || '');
  const inPersonCard = methodRaw === 'card_in_person' || (methodRaw === 'card' && body?.inPerson === true);
  const method = inPersonCard ? 'card' : methodRaw;
  if (method !== 'card' && !IN_PERSON.has(method as InPersonMethod)) {
    return NextResponse.json({ error: 'Choose card, cash, check, or other.' }, { status: 400 });
  }

  const workOrder = await prisma.workOrder.findUnique({ where: { id } });
  if (!workOrder) return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
  const shopId = auth.role === 'shop' ? auth.id : auth.shopId;
  if (auth.role !== 'superadmin' && auth.role !== 'admin' && workOrder.shopId !== shopId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  if (method === 'card' && !inPersonCard) {
    const origin = request.nextUrl.origin;
    const session = await createWorkOrderCheckoutSession({ workOrderId: id, appUrl: origin });
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });
    return NextResponse.json({ ok: true, method: 'card', url: session.url });
  }

  const jobCents = usdToCents(quoteAmount(workOrder));
  const taxCents = readSalesTaxSnapshot(workOrder.completion)?.taxCents || 0;
  const link = await prisma.paymentLink.findFirst({
    where: {
      workOrderId: id,
      description: { startsWith: 'Invoice for work order' },
    },
    orderBy: { createdAt: 'desc' },
    select: { amount: true },
  });
  const at = new Date().toISOString();
  const job = await findShopJob(workOrder.shopId, id);
  const alreadyReceivedCents = job?.shopReceivedCents || 0;
  const feeAlreadyRecorded = (job?.platformFeeCents || 0) > 0;
  const embedded = embeddedFeeCents(link?.amount, jobCents + taxCents);
  const preview = readCheckoutFeeForInPerson({
    completion: workOrder.completion,
    quoteCents: jobCents,
    embeddedFeeCents: embedded,
    now: at,
  });
  const feeCents = preview.ok ? preview.snapshot.customerFacingFeeCents : 0;
  const due = counterBalanceDueCents({
    jobCents,
    alreadyReceivedCents: Math.max(0, alreadyReceivedCents),
    feeCents,
    taxCents,
    feeAlreadyRecorded,
  });
  const tendered = body?.amountCents == null ? due.dueCents : Number(body.amountCents);
  const counter = planCounterPayment({
    workOrderId: id,
    shopId: workOrder.shopId,
    completion: workOrder.completion,
    quoteCents: jobCents,
    embeddedFeeCents: embedded,
    alreadyReceivedCents: Math.max(0, alreadyReceivedCents),
    tenderedCents: tendered,
    taxCents,
    method: method as InPersonMethod,
    feeAlreadyRecorded,
    actorId: auth.id,
    at,
  });
  if (!counter.ok) return NextResponse.json({ error: counter.error }, { status: counter.error.includes('Invoice') ? 409 : 400 });
  const { frozen, planned } = counter;
  const previous = readFeeSnapshot(workOrder.completion);
  if (!previous || previous.customerFacingFeeCents !== frozen.snapshot.customerFacingFeeCents || previous.quoteCents !== frozen.snapshot.quoteCents) {
    await prisma.workOrder.update({
      where: { id },
      data: { completion: frozen.completion as Prisma.InputJsonValue },
    });
  }
  await writeBooksEntries({
    shopId: workOrder.shopId,
    workOrderId: id,
    entries: planned.entries,
    audit: planned.audit,
  });
  const jobPayment = planned.entries.find((entry) => entry.appliesTo === 'job' && entry.kind === 'job_payment');
  if (jobPayment) {
    await saveJournalDraft(workOrder.shopId, auth.id, postPayment({
      id: jobPayment.idempotencyKey,
      workOrderId: id,
      date: at.slice(0, 10),
      amountCents: jobPayment.amountCents,
      openArCents: Math.max(0, jobCents - Math.max(0, alreadyReceivedCents)),
      hasInvoice: true,
    }));
  }
  if (planned.taxCollectedCents > 0) {
    await saveJournalDraft(workOrder.shopId, auth.id, postCollectedTax({
      id: `tax:${id}:${planned.shopReceivedCents}`,
      workOrderId: id,
      date: at.slice(0, 10),
      amountCents: planned.taxCollectedCents,
    }));
  }
  if (planned.paymentStatus === 'paid') {
    await prisma.paymentLink.updateMany({
      where: { workOrderId: id, status: 'pending' },
      data: { status: 'paid', paidAt: new Date() },
    });
    await recordStatusHistory({
      workOrderId: id,
      fromStatus: workOrder.status || 'waiting-for-payment',
      toStatus: 'paid',
      reason: 'Paid in person',
    });
  }
  const updated = await prisma.workOrder.update({
    where: { id },
    data: {
      amountPaid: planned.shopReceivedCents / 100,
      paymentStatus: planned.paymentStatus,
    },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, company: true } },
      vehicle: { select: { id: true, vehicleType: true, make: true, model: true, year: true, vin: true, licensePlate: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
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
