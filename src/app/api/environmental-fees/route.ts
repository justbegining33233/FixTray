import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';
import { environmentalFeeAmount, validateEnvironmentalFee } from '@/lib/shopFormValidation';

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
  const shopId = auth.role === 'shop' ? auth.id : (auth as { shopId?: string }).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });
  const fees = await prisma.environmentalFee.findMany({ where: { shopId }, orderBy: { name: 'asc' } });
  return NextResponse.json(fees.map(toFeeDto));
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const shopId = auth.role === 'shop' ? auth.id : (auth as { shopId?: string }).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });
  const body = await req.json().catch(() => ({}));
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
