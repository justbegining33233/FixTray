/**
 * GET  /api/recurring-workorders   — List recurring WOs (shop sees own, admin sees all)
 * POST /api/recurring-workorders   — Create a recurring WO schedule
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

function nextRunDate(frequency: string, from: Date = new Date()): Date {
  const d = new Date(from);
  switch (frequency) {
    case 'weekly':    d.setDate(d.getDate() + 7); break;
    case 'biweekly':  d.setDate(d.getDate() + 14); break;
    case 'monthly':   d.setMonth(d.getMonth() + 1); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'annually':  d.setFullYear(d.getFullYear() + 1); break;
    default:          d.setMonth(d.getMonth() + 1);
  }
  return d;
}

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const where =
    (auth.role === 'superadmin')
      ? {}
      : auth.role === 'shop'
      ? { shopId: auth.id }
      : auth.role === 'tech' || auth.role === 'manager'
      ? { shopId: auth.shopId! }
      : auth.role === 'customer'
      ? { customerId: auth.id }
      : null;

  if (where === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const schedules = await prisma.recurringWorkOrder.findMany({
    where: where as object,
    include: {
      customer: { select: { firstName: true, lastName: true, email: true } },
      shop: { select: { shopName: true } },
      vehicle: { select: { make: true, model: true, year: true } },
    },
    orderBy: { nextRunAt: 'asc' },
  });

  return NextResponse.json({ success: true, schedules });
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!['shop', 'tech', 'manager', 'admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Only shops/techs can create recurring schedules' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      customerId,
      vehicleId,
      title,
      issueDescription,
      frequency,
      vehicleType,
      serviceLocation,
      estimatedCost,
      notes,
      startDate,
    } = body;

    if (!customerId || !title || !issueDescription || !frequency) {
      return NextResponse.json({ error: 'customerId, title, issueDescription, and frequency are required' }, { status: 400 });
    }

    const shopId = auth.role === 'shop' ? auth.id : auth.shopId!;

    const firstRun = startDate ? new Date(startDate) : nextRunDate(frequency);

    const schedule = await prisma.recurringWorkOrder.create({
      data: {
        shopId,
        customerId,
        vehicleId: vehicleId || null,
        title,
        issueDescription,
        frequency,
        vehicleType: vehicleType || 'car',
        serviceLocation: serviceLocation || 'in-shop',
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null,
        notes: notes || null,
        nextRunAt: firstRun,
        active: true,
        requiresApproval: body.requiresApproval !== false, // default true
      },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        vehicle: { select: { make: true, model: true, year: true } },
      },
    });

    return NextResponse.json({ success: true, schedule }, { status: 201 });
  } catch (err) {
    console.error('Recurring WO create error:', err);
    return NextResponse.json({ error: 'Failed to create recurring schedule' }, { status: 500 });
  }
}
