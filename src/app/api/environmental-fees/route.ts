import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest, type AuthUser } from '@/lib/auth';
import { environmentalFeeAmount, validateEnvironmentalFee } from '@/lib/shopFormValidation';
import { usableShopId } from '@/lib/shopAccess';

function actorShopId(auth: AuthUser, requested: unknown): string | null {
  const requestedId = usableShopId(requested);
  if (auth.role === 'shop') return auth.id;
  if (auth.role === 'manager' || auth.role === 'tech') return usableShopId(auth.shopId);
  if (auth.role === 'admin' || auth.role === 'superadmin') return requestedId;
  return null;
}

function toFeeDto(fee: {
  id: string;
  name: string;
  feeAmount: number;
  feeType: string | null;
  description: string | null;
  unit: string;
  active: boolean;
  taxable: boolean;
  shopId: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...fee,
    amount: fee.feeAmount,
    isActive: fee.active,
    feeType: fee.feeType || 'other',
    description: fee.description || '',
  };
}

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['shop', 'manager', 'tech', 'admin', 'superadmin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const requested = new URL(req.url).searchParams.get('shopId');
  const shopId = actorShopId(auth, requested);
  const platformWide = (auth.role === 'admin' || auth.role === 'superadmin') && !shopId;
  if (!shopId && !platformWide) return NextResponse.json({ error: 'No shop' }, { status: 400 });
  const fees = await prisma.environmentalFee.findMany({
    where: shopId ? { shopId } : undefined,
    orderBy: { name: 'asc' },
    include: { Shop: { select: { shopName: true } } },
  });
  return NextResponse.json(fees.map((fee) => {
    const { Shop, ...rest } = fee;
    return { ...toFeeDto(rest), shopName: Shop?.shopName || '' };
  }));
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['shop', 'manager', 'admin', 'superadmin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const requested = new URL(req.url).searchParams.get('shopId') || body.shopId;
  const shopId = actorShopId(auth, requested);
  if (!shopId) return NextResponse.json({ error: 'Select a shop before creating a fee' }, { status: 400 });
  const check = validateEnvironmentalFee(body);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
  const fee = await prisma.environmentalFee.create({
    data: {
      shopId,
      name: String(body.name).trim(),
      feeAmount: environmentalFeeAmount(body),
      feeType: body.feeType ? String(body.feeType) : null,
      description: body.description ? String(body.description) : null,
      unit: body.unit || 'per_job',
      taxable: Boolean(body.taxable),
      active: body.active !== false && body.isActive !== false,
    },
  });
  return NextResponse.json(toFeeDto(fee), { status: 201 });
}
