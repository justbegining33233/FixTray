import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';
import crypto from 'crypto';
import { validateDviCreate } from '@/lib/shopFormValidation';

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const shopId = auth.role === 'shop' ? auth.id : (auth as any).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });

  const inspections = await prisma.dVIInspection.findMany({
    where: { shopId },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(inspections);
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const shopId = auth.role === 'shop' ? auth.id : (auth as any).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const check = validateDviCreate(body);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
  const token = crypto.randomBytes(20).toString('hex');

  const inspection = await prisma.dVIInspection.create({
    data: {
      shopId,
      workOrderId: body.workOrderId || null,
      techId: auth.role === 'tech' ? auth.id : body.techId || null,
      customerId: body.customerId || null,
      vehicleDesc: body.vehicleDesc,
      mileage: body.mileage ? Number(body.mileage) : null,
      notes: body.notes,
      approvalToken: token,
      status: 'in-progress',
      items: {
        create: (body.items || []).map((item: { category: string; itemName: string; condition: string; notes?: string; estimatedCost?: number }) => ({
          category: item.category,
          itemName: item.itemName,
          condition: item.condition || 'green',
          notes: item.notes || null,
          estimatedCost: item.estimatedCost ? Number(item.estimatedCost) : null,
        })),
      },
    },
    include: { items: true },
  });
  return NextResponse.json(inspection, { status: 201 });
}
