import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';
import { environmentalFeeAmount, validateEnvironmentalFee } from '@/lib/shopFormValidation';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['shop', 'manager', 'admin', 'superadmin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const check = validateEnvironmentalFee(body);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
  const fee = await prisma.environmentalFee.update({
    where: { id },
    data: {
      name: String(body.name).trim(),
      feeAmount: environmentalFeeAmount(body),
      feeType: body.feeType ? String(body.feeType) : null,
      description: body.description ? String(body.description) : null,
      unit: body.unit || 'per_job',
      taxable: Boolean(body.taxable),
      active: body.active !== false && body.isActive !== false,
    },
  });
  return NextResponse.json({
    ...fee,
    amount: fee.feeAmount,
    isActive: fee.active,
    feeType: fee.feeType || 'other',
    description: fee.description || '',
  });
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await prisma.environmentalFee.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
