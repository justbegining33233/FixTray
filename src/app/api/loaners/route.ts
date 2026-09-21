import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';
import { validateLoanerVehicle } from '@/lib/shopFormValidation';

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const shopId = auth.role === 'shop' ? auth.id : (auth as any).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });

  const loaners = await prisma.loanerVehicle.findMany({ where: { shopId }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json(loaners);
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const shopId = auth.role === 'shop' ? auth.id : (auth as any).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const check = validateLoanerVehicle(body);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
  const loaner = await prisma.loanerVehicle.create({
    data: {
      shopId,
      make: String(body.make).trim(),
      model: String(body.model).trim(),
      year: Number(body.year),
      color: body.color,
      licensePlate: body.licensePlate,
      vin: body.vin,
      status: 'available',
    },
  });
  return NextResponse.json(loaner, { status: 201 });
}
