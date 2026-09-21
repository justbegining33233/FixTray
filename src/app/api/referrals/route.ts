import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';
import crypto from 'crypto';
import { validateReferralCreate } from '@/lib/shopFormValidation';

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const shopId = auth.role === 'shop' ? auth.id : (auth as any).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });
  const referrals = await prisma.referral.findMany({ where: { shopId }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json(referrals);
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const shopId = auth.role === 'shop' ? auth.id : (auth as any).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });
  const body = await req.json().catch(() => ({}));

  if (body._action === 'create_for_customer') {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const referral = await prisma.referral.create({
      data: {
        shopId,
        referrerCustomerId: body.customerId,
        referralCode: code,
        referrerReward: Number(body.referrerReward) || 25,
        referredReward: Number(body.referredReward) || 25,
        status: 'pending',
      },
    });
    return NextResponse.json(referral, { status: 201 });
  }

  const check = validateReferralCreate(body);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const reward = body.rewardValue === undefined || body.rewardValue === '' || body.rewardValue === null
    ? 0
    : Number(body.rewardValue);
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  const referral = await prisma.referral.create({
    data: {
      shopId,
      referrerCustomerId: String(body.referrerId || body.referrerCustomerId || auth.id),
      referredName: String(body.referredName).trim(),
      referredEmail: body.referredEmail ? String(body.referredEmail).trim() : null,
      referralCode: code,
      referrerReward: reward,
      referredReward: reward,
      status: 'pending',
    },
  });
  return NextResponse.json(referral, { status: 201 });
}
