import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

// Compatibility endpoint for legacy mobile offline sync.
export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['tech', 'manager']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const workOrderId = body.workOrderId as string | undefined;
    const latitude = typeof body.latitude === 'number' ? body.latitude : undefined;
    const longitude = typeof body.longitude === 'number' ? body.longitude : undefined;

    if (!workOrderId || latitude == null || longitude == null) {
      return NextResponse.json({ error: 'workOrderId, latitude, longitude are required' }, { status: 400 });
    }

    const workOrder = await prisma.workOrder.findFirst({
      where: {
        id: workOrderId,
        assignedTechId: auth.id,
        status: { in: ['assigned', 'en-route', 'in-progress'] },
      },
      select: { id: true },
    });

    if (!workOrder) {
      return NextResponse.json({ error: 'Work order not found or not assigned to you' }, { status: 404 });
    }

    const tracking = await prisma.techTracking.upsert({
      where: { workOrderId },
      create: {
        workOrderId,
        latitude,
        longitude,
        estimatedArrival: body.estimatedArrival ? new Date(body.estimatedArrival) : null,
      },
      update: {
        latitude,
        longitude,
        estimatedArrival: body.estimatedArrival ? new Date(body.estimatedArrival) : null,
      },
    });

    return NextResponse.json({ success: true, tracking });
  } catch (error) {
    console.error('Location update error:', error);
    return NextResponse.json({ error: 'Failed to update location' }, { status: 500 });
  }
}
