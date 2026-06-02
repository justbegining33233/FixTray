/**
 * GET    /api/recurring-workorders/[id]  — Get single schedule
 * PUT    /api/recurring-workorders/[id]  — Update (pause/resume, change frequency)
 * DELETE /api/recurring-workorders/[id]  — Delete schedule
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const schedule = await prisma.recurringWorkOrder.findUnique({
    where: { id },
    include: {
      customer: { select: { firstName: true, lastName: true, email: true } },
      shop: { select: { shopName: true } },
      vehicle: { select: { make: true, model: true, year: true } },
    },
  });

  if (!schedule) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const allowed =
    (auth.role === 'superadmin') ||
    (auth.role === 'shop' && schedule.shopId === auth.id) ||
    ((auth.role === 'tech' || auth.role === 'manager') && schedule.shopId === auth.shopId) ||
    (auth.role === 'customer' && schedule.customerId === auth.id);

  if (!allowed) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  return NextResponse.json({ success: true, schedule });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = await prisma.recurringWorkOrder.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const allowed =
    (auth.role === 'superadmin') ||
    (auth.role === 'shop' && existing.shopId === auth.id) ||
    ((auth.role === 'tech' || auth.role === 'manager') && existing.shopId === auth.shopId);

  if (!allowed) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  try {
    const body = await request.json();
    const updated = await prisma.recurringWorkOrder.update({
      where: { id },
      data: {
        title: body.title ?? existing.title,
        issueDescription: body.issueDescription ?? existing.issueDescription,
        frequency: body.frequency ?? existing.frequency,
        estimatedCost: body.estimatedCost != null ? parseFloat(body.estimatedCost) : existing.estimatedCost,
        notes: body.notes ?? existing.notes,
        active: body.active != null ? body.active : existing.active,
        requiresApproval: body.requiresApproval != null ? body.requiresApproval : existing.requiresApproval,
        nextRunAt: body.nextRunAt ? new Date(body.nextRunAt) : existing.nextRunAt,
      },
    });
    return NextResponse.json({ success: true, schedule: updated });
  } catch (err) {
    console.error('Recurring WO update error:', err);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = await prisma.recurringWorkOrder.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const allowed =
    (auth.role === 'superadmin') ||
    (auth.role === 'shop' && existing.shopId === auth.id) ||
    ((auth.role === 'tech' || auth.role === 'manager') && existing.shopId === auth.shopId);

  if (!allowed) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  await prisma.recurringWorkOrder.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
