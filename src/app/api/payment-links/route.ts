import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';
import crypto from 'crypto';
import { validatePaymentLink } from '@/lib/shopFormValidation';
import { ensureProductionColumns } from '@/lib/ensureProductionColumns';
import { getPlatformServiceFeeUsd } from '@/lib/platformFee';
import { quoteAmount } from '@/lib/workOrderCloseout';
import { paymentLinkFeeBreakdown } from '@/lib/serviceFeeBill';
import { createWorkOrderCheckoutSession } from '@/lib/workOrderCheckout';

async function invoiceBreakdown(link: {
  amount: number;
  workOrderId: string | null;
}) {
  const amount = Number(link.amount) || 0;
  let quote = 0;
  if (amount > 0 && link.workOrderId) {
    const workOrder = await prisma.workOrder.findUnique({ where: { id: link.workOrderId } });
    if (workOrder) quote = quoteAmount(workOrder);
  }
  const platformFee = amount > 0 ? await getPlatformServiceFeeUsd() : 0;
  const bill = paymentLinkFeeBreakdown(amount, quote, platformFee);
  return {
    serviceCost: bill.serviceCost,
    serviceFee: bill.serviceFee,
    amount: bill.amount,
  };
}

async function publicPaymentLink(link: {
  id: string;
  token: string;
  amount: number;
  description: string | null;
  status: string;
  paidAt: Date | null;
  expiresAt: Date | null;
  workOrderId: string | null;
}) {
  const breakdown = await invoiceBreakdown(link);
  return {
    id: link.id,
    token: link.token,
    amount: breakdown.amount,
    serviceCost: breakdown.serviceCost,
    serviceFee: breakdown.serviceFee,
    description: link.description,
    status: link.status,
    paidAt: link.paidAt,
    expiresAt: link.expiresAt,
    workOrderId: link.workOrderId,
  };
}

async function startPaymentLinkCheckout(token: string) {
  if (!token) return NextResponse.json({ error: 'Payment link not found' }, { status: 404 });
  const link = await prisma.paymentLink.findUnique({ where: { token } });
  if (!link) return NextResponse.json({ error: 'Payment link not found' }, { status: 404 });
  if (link.status === 'paid') {
    return NextResponse.json({ error: 'This invoice has already been paid.' }, { status: 400 });
  }
  if (link.expiresAt && link.expiresAt < new Date()) {
    return NextResponse.json({ error: 'This payment link has expired.' }, { status: 410 });
  }
  if (!link.workOrderId) {
    return NextResponse.json({ error: 'This payment link is not tied to a work order.' }, { status: 400 });
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fixtray.app';
  const result = await createWorkOrderCheckoutSession({ workOrderId: link.workOrderId, appUrl });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ url: result.url });
}

export async function GET(req: NextRequest) {
  await ensureProductionColumns();
  const token = req.nextUrl.searchParams.get('token');
  if (token) {
    const link = await prisma.paymentLink.findUnique({ where: { token } });
    if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(await publicPaymentLink(link));
  }

  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const shopId = auth.role === 'shop' ? auth.id : (auth as any).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });
  const workOrderId = req.nextUrl.searchParams.get('workOrderId');
  const links = await prisma.paymentLink.findMany({
    where: { shopId, ...(workOrderId ? { workOrderId } : {}) },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(links);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body?.action === 'pay') {
    return startPaymentLinkCheckout(typeof body.token === 'string' ? body.token : '');
  }

  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const shopId = auth.role === 'shop' ? auth.id : (auth as any).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });
  await ensureProductionColumns();
  const linkCheck = validatePaymentLink(body);
  if (!linkCheck.ok) return NextResponse.json({ error: linkCheck.error }, { status: 400 });
  const token = crypto.randomBytes(24).toString('hex');
  const workOrderId = typeof body.workOrderId === 'string' && body.workOrderId.trim()
    ? body.workOrderId.trim()
    : null;
  const link = await prisma.paymentLink.create({
    data: {
      shopId,
      token,
      amount: Number(body.amount),
      description: String(body.description).trim(),
      workOrderId,
      customerId: body.customerId || null,
      customerName: body.customerName ? String(body.customerName).trim() : null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'pending',
    },
  });
  return NextResponse.json({ ...link, link: `/customer/pay/${token}` }, { status: 201 });
}
