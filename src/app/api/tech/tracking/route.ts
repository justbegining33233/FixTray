import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticateRequest, verifyToken } from '@/lib/auth';
import { geocodeAddresses } from '@/lib/geocodeAddress';
import { actorMayAccessShop, usableShopId } from '@/lib/shopAccess';
import { TRACKABLE_WORK_ORDER_STATUSES } from '@/lib/customerTracking';
import {
  addressesToGeocode,
  buildRoadCallMap,
  isTrackableRoadCall,
  readStoredPoint,
  shopAddressFromRecord,
  type RoadCallJobInput,
  type RoadCallTechInput,
} from '@/lib/roadCallMap';
import { isRoadsideLocation, ROADSIDE_LOCATION_VALUES } from '@/lib/waitingRoomBoard';

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

// GET /api/tech/tracking?shopId=current — shop pin + active road-call techs and jobs
export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['tech', 'manager', 'shop', 'admin', 'superadmin'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const resolved = trackingShopId(auth, new URL(request.url).searchParams.get('shopId'));
    if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });

    const shop = await prisma.shop.findUnique({
      where: { id: resolved.shopId },
      select: {
        id: true,
        shopName: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        shopLocations: {
          select: { address: true, city: true, state: true, zip: true, isMain: true, status: true },
        },
      },
    });
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

    const rows = await prisma.workOrder.findMany({
      where: {
        shopId: resolved.shopId,
        status: { in: [...TRACKABLE_WORK_ORDER_STATUSES] },
        serviceLocation: { in: [...ROADSIDE_LOCATION_VALUES], mode: 'insensitive' },
      },
      select: {
        id: true,
        status: true,
        serviceLocation: true,
        issueDescription: true,
        location: true,
        assignedTechId: true,
        customer: { select: { firstName: true, lastName: true } },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            latitude: true,
            longitude: true,
            lastLocationUpdate: true,
          },
        },
        tracking: { select: { latitude: true, longitude: true, updatedAt: true } },
        workOrderTimeEntries: {
          where: { clockOut: null, status: { not: 'completed' } },
          select: {
            tech: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                latitude: true,
                longitude: true,
                lastLocationUpdate: true,
              },
            },
          },
        },
      },
    });

    const jobs: RoadCallJobInput[] = rows.map((row) => ({
      id: row.id,
      status: row.status,
      serviceLocation: row.serviceLocation,
      issueDescription: row.issueDescription,
      location: row.location,
      assignedTechId: row.assignedTechId,
      customer: row.customer,
      assignedTo: row.assignedTo,
      tracking: row.tracking,
      clockedInTechs: row.workOrderTimeEntries.flatMap((entry) => {
        const tech = entry.tech;
        if (!tech?.id) return [];
        const rowTech: RoadCallTechInput = {
          id: tech.id,
          firstName: tech.firstName,
          lastName: tech.lastName,
          phone: tech.phone,
          latitude: tech.latitude,
          longitude: tech.longitude,
          lastLocationUpdate: tech.lastLocationUpdate,
        };
        return [rowTech];
      }),
    }));

    const address = shopAddressFromRecord(shop);
    const geocodes = await geocodeAddresses(addressesToGeocode(address, jobs));
    const map = buildRoadCallMap({
      shop: { id: shop.id, name: shop.shopName, address },
      jobs,
      geocodes,
    });

    return NextResponse.json(map);
  } catch (error) {
    console.error('Tracking list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/tech/tracking - Tech shares GPS only while on an active road call
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded || !['tech', 'manager'].includes(decoded.role)) {
      return NextResponse.json({ error: 'Tech account required' }, { status: 403 });
    }

    const body = await request.json();
    const point = readStoredPoint({ latitude: body?.latitude, longitude: body?.longitude });
    const workOrderId = typeof body?.workOrderId === 'string' ? body.workOrderId : '';
    if (!workOrderId || !point) {
      return NextResponse.json({ error: 'workOrderId, latitude, longitude are required' }, { status: 400 });
    }

    const workOrder = await prisma.workOrder.findFirst({
      where: {
        id: workOrderId,
        status: { in: [...TRACKABLE_WORK_ORDER_STATUSES] },
        OR: [
          { assignedTechId: decoded.id },
          {
            workOrderTimeEntries: {
              some: { techId: decoded.id, clockOut: null, status: { not: 'completed' } },
            },
          },
        ],
      },
      select: { id: true, serviceLocation: true, status: true },
    });
    if (!workOrder || !isTrackableRoadCall(workOrder)) {
      if (workOrder && !isRoadsideLocation(workOrder.serviceLocation)) {
        return NextResponse.json({ error: 'Location is shared only during an active road call' }, { status: 403 });
      }
      return NextResponse.json({ error: 'Work order not found or not assigned to you' }, { status: 404 });
    }

    const estimatedArrival = body?.estimatedArrival ? new Date(body.estimatedArrival) : null;
    const [tracking] = await Promise.all([
      prisma.techTracking.upsert({
        where: { workOrderId },
        create: {
          workOrderId,
          latitude: point.latitude,
          longitude: point.longitude,
          estimatedArrival,
        },
        update: {
          latitude: point.latitude,
          longitude: point.longitude,
          estimatedArrival,
        },
      }),
      prisma.tech.update({
        where: { id: decoded.id },
        data: {
          latitude: point.latitude,
          longitude: point.longitude,
          lastLocationUpdate: new Date(),
        },
      }),
    ]);

    return NextResponse.json({ tracking });
  } catch (error) {
    console.error('Tracking update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
