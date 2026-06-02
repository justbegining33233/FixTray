import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!['shop', 'manager', 'tech', 'admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const shopId = auth.role === 'shop' ? auth.id : auth.shopId;
  if (!shopId) {
    return NextResponse.json({ error: 'Shop not found' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ customers: [], workOrders: [], vehicles: [], parts: [], laborRates: [] });
  }

  try {
    // Search customers
    const customers = await prisma.customer.findMany({
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
    });

    // Search work orders by ID prefix or description
    const workOrders = await prisma.workOrder.findMany({
      where: {
        shopId,
        OR: [
          { id: { startsWith: q } },
          { issueDescription: { contains: q, mode: 'insensitive' } },
          { vehicleType: { contains: q, mode: 'insensitive' } },
        ],
      },
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
    const vehicles = await prisma.vehicle.findMany({
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
    });

    // Search parts/inventory
    const parts = await prisma.inventoryItem.findMany({
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
    });

    // Search labor rates
    const laborRates = await prisma.shopLaborRate.findMany({
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
    });

    return NextResponse.json({ customers, workOrders, vehicles, parts, laborRates });
  } catch (error) {
    console.error('Global search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
