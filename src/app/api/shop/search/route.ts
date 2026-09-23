import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { workOrderSearchScope, workOrderTextMatch } from '@/lib/workOrderSearch';

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!['shop', 'manager', 'tech', 'admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const shopId = auth.role === 'shop' ? auth.id : auth.shopId;
  const techScope = auth.role === 'tech'
    ? workOrderSearchScope({ role: 'tech', id: auth.id, shopId: shopId || null })
    : null;
  if (!shopId && !techScope) {
    return NextResponse.json({ error: 'Shop not found' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ customers: [], workOrders: [], vehicles: [], parts: [], laborRates: [] });
  }

  try {
    const emptyCatalog = { customers: [], vehicles: [], parts: [], laborRates: [] };
    // Search customers
    const customers = shopId ? await prisma.customer.findMany({
      where: {
        AND: [
          { workOrders: { some: { shopId } } },
          {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      take: 5,
    }) : emptyCatalog.customers;

    // Match the labels the UI actually shows (WO- + id suffix/prefix), the raw id,
    // and either letter case. Techs also match jobs assigned to them.
    const textMatch = workOrderTextMatch(q);
    const workOrderWhere = techScope
      ? { AND: [techScope, textMatch] }
      : { shopId, ...textMatch };
    const workOrders = await prisma.workOrder.findMany({
      where: workOrderWhere,
      select: {
        id: true,
        status: true,
        vehicleType: true,
        createdAt: true,
        customer: { select: { firstName: true, lastName: true } },
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    // Search vehicles
    const vehicles = shopId ? await prisma.vehicle.findMany({
      where: {
        customer: { workOrders: { some: { shopId } } },
        OR: [
          { make: { contains: q, mode: 'insensitive' } },
          { model: { contains: q, mode: 'insensitive' } },
          { licensePlate: { contains: q, mode: 'insensitive' } },
          { vin: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        make: true,
        model: true,
        year: true,
        licensePlate: true,
        customerId: true,
        customer: { select: { firstName: true, lastName: true } },
      },
      take: 5,
    }) : emptyCatalog.vehicles;

    // Search parts/inventory
    const parts = shopId ? await prisma.inventoryItem.findMany({
      where: {
        shopId,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
          { type: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        sku: true,
        type: true,
        quantity: true,
        price: true,
      },
      take: 5,
      orderBy: { updatedAt: 'desc' },
    }) : emptyCatalog.parts;

    // Search labor rates
    const laborRates = shopId ? await prisma.shopLaborRate.findMany({
      where: {
        shopId,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        category: true,
        rate: true,
      },
      take: 5,
      orderBy: { updatedAt: 'desc' },
    }) : emptyCatalog.laborRates;

    return NextResponse.json({ customers, workOrders, vehicles, parts, laborRates });
  } catch (error) {
    console.error('Global search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
