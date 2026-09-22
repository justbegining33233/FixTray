import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticateRequest, verifyToken } from '@/lib/auth';
import { actorMayAccessShop, usableShopId } from '@/lib/shopAccess';
import { workOrderTitle } from '@/lib/workOrderMetrics';

function trackingShopId(actor: { id: string; role: string; shopId?: string | null }, requested: unknown): { shopId: string } | { error: string; status: number } {
  const requestedId = usableShopId(requested);
  const own = actor.role === 'shop' ? (usableShopId(actor.shopId) || actor.id) : usableShopId(actor.shopId);
  if (actor.role === 'admin' || actor.role === 'superadmin') {
    if (!requestedId) return { error: 'shopId required', status: 400 };
    return { shopId: requestedId };
  }
  if (!own) return { error: 'shopId required', status: 400 };
  if (requestedId && !actorMayAccessShop(actor, requestedId)) return { error: 'Forbidden', status: 403 };
  return { shopId: own };
}

// GET /api/tech/tracking?shopId=current — manager/shop live locations
export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['tech', 'manager', 'shop', 'admin', 'superadmin'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const resolved = trackingShopId(auth, new URL(request.url).searchParams.get('shopId'));
    if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });

    const [techs, pins] = await Promise.all([
      prisma.tech.findMany({
        where: { shopId: resolved.shopId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          latitude: true,
          longitude: true,
          lastLocationUpdate: true,
          available: true,
        },
      }),
      prisma.techTracking.findMany({
        where: { workOrder: { shopId: resolved.shopId } },
        include: {
          workOrder: {
            select: { id: true, assignedTechId: true, issueDescription: true, status: true },
          },
        },
      }),
    ]);

    const pinByTech = new Map(pins.filter((pin) => pin.workOrder.assignedTechId).map((pin) => [pin.workOrder.assignedTechId as string, pin]));
    const located = techs.flatMap((tech) => {
      const pin = pinByTech.get(tech.id);
      const latitude = pin?.latitude ?? tech.latitude;
      const longitude = pin?.longitude ?? tech.longitude;
      if (latitude == null || longitude == null) return [];
      const onJob = !!pin && ['in-progress', 'en-route', 'assigned'].includes(pin.workOrder.status);
      const updated = pin?.updatedAt || tech.lastLocationUpdate;
      return [{
        id: tech.id,
        name: `${tech.firstName} ${tech.lastName}`.trim() || 'Technician',
        phone: tech.phone || '',
        latitude,
        longitude,
        status: onJob ? 'on-job' : tech.available ? 'clocked-in' : 'clocked-out',
        currentJob: onJob ? workOrderTitle(pin.workOrder) : undefined,
        lastUpdate: updated ? new Date(updated).toLocaleString() : 'Unknown',
      }];
    });

    return NextResponse.json({ techs: located });
  } catch (error) {
    console.error('Tracking list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/tech/tracking - Tech updates their GPS location
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded || !['tech', 'manager'].includes(decoded.role)) {
      return NextResponse.json({ error: 'Tech account required' }, { status: 403 });
    }

    const { workOrderId, latitude, longitude, estimatedArrival } = await request.json();
    if (!workOrderId || latitude == null || longitude == null) {
      return NextResponse.json({ error: 'workOrderId, latitude, longitude are required' }, { status: 400 });
    }

    // Verify work order is assigned to this tech
    const workOrder = await prisma.workOrder.findFirst({
      where: { id: workOrderId, assignedTechId: decoded.id, status: { in: ['in-progress', 'en-route', 'assigned'] } },
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
        estimatedArrival: estimatedArrival ? new Date(estimatedArrival) : null,
      },
      update: {
        latitude,
        longitude,
        estimatedArrival: estimatedArrival ? new Date(estimatedArrival) : null,
      },
    });

    return NextResponse.json({ tracking });
  } catch (error) {
    console.error('Tracking update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
