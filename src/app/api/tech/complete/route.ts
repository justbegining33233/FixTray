import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

// Compatibility endpoint used by legacy tech dashboard.
export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['tech', 'manager']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const workOrderId = body.workOrderId as string | undefined;

    if (!workOrderId) {
      return NextResponse.json({ error: 'workOrderId is required' }, { status: 400 });
    }

    const current = await prisma.workOrder.findFirst({
      where: { id: workOrderId, assignedTechId: auth.id },
      select: { id: true, status: true },
    });

    if (!current) {
      return NextResponse.json({ error: 'Work order not found or not assigned to you' }, { status: 404 });
    }

    const workOrder = await prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        status: 'closed',
        completedAt: new Date(),
      },
      select: { id: true, status: true, completedAt: true },
    });

    return NextResponse.json({ success: true, workOrder });
  } catch (error) {
    console.error('Tech completion error:', error);
    return NextResponse.json({ error: 'Failed to complete work order' }, { status: 500 });
  }
}
