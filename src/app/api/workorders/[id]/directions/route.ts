import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { geocodeAddress } from '@/lib/geocodeAddress';
import { shopAddressFromRecord } from '@/lib/roadCallMap';
import {
  browserDirectionLinks,
  jobNeedsDirections,
  osrmRouteUrl,
  parseOsrmRoute,
  readOriginParam,
  resolveDirectionTarget,
} from '@/lib/turnByTurn';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const workOrder = await prisma.workOrder.findUnique({
    where: { id },
    select: {
      id: true,
      shopId: true,
      serviceLocation: true,
      location: true,
      assignedTechId: true,
      status: true,
      shop: {
        select: {
          address: true,
          city: true,
          state: true,
          zipCode: true,
          shopLocations: {
            select: { address: true, city: true, state: true, zip: true, isMain: true, status: true },
          },
        },
      },
    },
  });

  if (!workOrder) {
    return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
  }

  const sameShop = auth.role === 'superadmin'
    || (auth.role === 'shop' && workOrder.shopId === auth.id)
    || ((auth.role === 'tech' || auth.role === 'manager') && workOrder.shopId === auth.shopId);
  if (!sameShop) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  if (!jobNeedsDirections({
    viewerRole: auth.role,
    serviceLocation: workOrder.serviceLocation,
    assignedTechId: workOrder.assignedTechId,
  })) {
    return NextResponse.json({ available: false, steps: [], external: null });
  }

  const shopAddress = workOrder.shop ? shopAddressFromRecord(workOrder.shop) : '';
  const preliminary = resolveDirectionTarget({
    serviceLocation: workOrder.serviceLocation,
    location: workOrder.location,
    shopAddress,
  });
  if (!preliminary) {
    return NextResponse.json({
      available: true,
      destination: null,
      steps: [],
      line: [],
      external: null,
      message: 'This job has no address to route to yet.',
    });
  }

  let point = preliminary.point;
  if (!point && preliminary.address) {
    point = await geocodeAddress(preliminary.address);
  }
  if (!point) {
    return NextResponse.json({
      available: true,
      destination: {
        kind: preliminary.kind,
        label: preliminary.label,
        address: preliminary.address,
        latitude: null,
        longitude: null,
      },
      steps: [],
      line: [],
      external: null,
      message: 'The address is on the job, but it could not be placed on the map.',
    });
  }

  const url = new URL(request.url);
  const origin = readOriginParam(url.searchParams.get('originLat'), url.searchParams.get('originLng'));
  const external = browserDirectionLinks(point, origin);
  const destination = {
    kind: preliminary.kind,
    label: preliminary.label,
    address: preliminary.address,
    latitude: point.latitude,
    longitude: point.longitude,
  };

  if (!origin) {
    return NextResponse.json({
      available: true,
      destination,
      steps: [],
      line: [],
      distanceMeters: null,
      durationSeconds: null,
      external,
      message: 'Allow location, then start turn-by-turn. Starting directions does not change the job.',
    });
  }

  try {
    const res = await fetch(osrmRouteUrl(origin, point), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'FixTray/1.0 (turn-by-turn; https://fixtray.app)',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return NextResponse.json({
        available: true,
        destination,
        steps: [],
        line: [],
        external,
        message: 'Turn-by-turn steps did not load. Open driving directions in the browser.',
      });
    }
    const route = parseOsrmRoute(await res.json());
    if (!route) {
      return NextResponse.json({
        available: true,
        destination,
        steps: [],
        line: [],
        external,
        message: 'No driving route was found. Open driving directions in the browser.',
      });
    }
    return NextResponse.json({
      available: true,
      destination,
      steps: route.steps,
      line: route.line,
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      external,
    });
  } catch {
    return NextResponse.json({
      available: true,
      destination,
      steps: [],
      line: [],
      external,
      message: 'Turn-by-turn steps did not load. Open driving directions in the browser.',
    });
  }
}
