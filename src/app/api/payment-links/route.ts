import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';
import crypto from 'crypto';

function publicPaymentLink(link: {
  id: string;
  token: string;
  amount: number;
  description: string | null;
  status: string;
  paidAt: Date | null;
  expiresAt: Date | null;
  workOrderId: string | null;
}) {
  return {
    id: link.id,
    token: link.token,
    amount: link.amount,
    description: link.description,
    status: link.status,
    paidAt: link.paidAt,
    expiresAt: link.expiresAt,
    workOrderId: link.workOrderId,
  };
}

async function settlePaymentLink(token: string) {
  if (!token) return NextResponse.json({ error: 'Payment link not found' }, { status: 404 });
  const link = await prisma.paymentLink.findUnique({ where: { token } });
  if (!link) return NextResponse.json({ error: 'Payment link not found' }, { status: 404 });
  if (link.expiresAt && link.expiresAt < new Date() && link.status !== 'paid') {
    return NextResponse.json({ error: 'This payment link has expired.' }, { status: 410 });
  }

  if (link.status !== 'paid') {
    await prisma.paymentLink.update({
      where: { id: link.id },
      data: { status: 'paid', paidAt: new Date() },
    });
    if (link.workOrderId) {
      const workOrder = await prisma.workOrder.findUnique({ where: { id: link.workOrderId } });
      if (workOrder && workOrder.status !== 'completed' && workOrder.status !== 'closed') {
        await prisma.workOrder.update({
          where: { id: workOrder.id },
          data: {
            paymentStatus: 'paid',
            amountPaid: link.amount,
            status: workOrder.status === 'waiting-for-payment' ? 'waiting-for-payment' : workOrder.status,
          },
        });
      }
    }
  }

  const paid = await prisma.paymentLink.findUnique({ where: { token } });
  return NextResponse.json(publicPaymentLink(paid!));
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token) {
    const link = await prisma.paymentLink.findUnique({ where: { token } });
    if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(publicPaymentLink(link));
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
    return settlePaymentLink(typeof body.token === 'string' ? body.token : '');
  }

  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const shopId = auth.role === 'shop' ? auth.id : (auth as any).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });
  const token = crypto.randomBytes(24).toString('hex');
  const workOrderId = typeof body.workOrderId === 'string' && body.workOrderId.trim()
    ? body.workOrderId.trim()
    : null;
  const link = await prisma.paymentLink.create({
    data: {
      shopId,
      token,
      amount: Number(body.amount),
      description: body.description,
      workOrderId,
      customerId: body.customerId || null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'pending',
    },
  });
  return NextResponse.json({ ...link, link: `/customer/pay/${token}` }, { status: 201 });
}
