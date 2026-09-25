import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { ACTIVE_WORK_ORDER_STATUSES } from '@/lib/workOrderMetrics';
import logger from '@/lib/logger';

export const runtime = 'nodejs';

/** Assigned active jobs plus the catalog a tech needs to add lines offline. */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== 'tech' && auth.role !== 'manager') {
    return NextResponse.json({ error: 'Technicians only' }, { status: 403 });
  }

  try {
    const tech = await prisma.tech.findUnique({
      where: { id: auth.id },
      select: { id: true, shopId: true, firstName: true, lastName: true },
    });
    if (!tech) return NextResponse.json({ error: 'Tech not found' }, { status: 404 });

    const [workOrders, settings, catalog, clock] = await Promise.all([
      prisma.workOrder.findMany({
        where: {
          assignedTechId: tech.id,
          shopId: tech.shopId,
          status: { in: [...ACTIVE_WORK_ORDER_STATUSES] },
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        select: {
          id: true,
          status: true,
          updatedAt: true,
          issueDescription: true,
          serviceLocation: true,
          vehicleType: true,
          estimatedCost: true,
          techLabor: true,
          partsUsed: true,
          workPhotos: true,
          completion: true,
          customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
          vehicle: {
            select: { id: true, year: true, make: true, model: true, licensePlate: true, vin: true, vehicleType: true },
          },
        },
      }),
      prisma.shopSettings.findUnique({
        where: { shopId: tech.shopId },
        select: { defaultLaborRate: true },
      }),
      prisma.inventoryItem.findMany({
        where: { shopId: tech.shopId },
        take: 200,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, sku: true, price: true, rate: true, type: true },
      }),
      prisma.timeEntry.findFirst({
        where: { techId: tech.id, clockOut: null },
        orderBy: { clockIn: 'desc' },
        select: { id: true, clockIn: true, notes: true, workOrderId: true, clientMutationId: true },
      }),
    ]);

    return NextResponse.json({
      techId: tech.id,
      shopId: tech.shopId,
      techName: `${tech.firstName} ${tech.lastName}`.trim(),
      laborRate: settings?.defaultLaborRate ?? 0,
      catalog,
      clock,
      workOrders,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Offline bundle failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to download jobs' }, { status: 500 });
  }
}
