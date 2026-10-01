import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { demoOutboundBlocked } from '@/lib/demoOutboundContext';
import { isDemoShopId } from '@/lib/demoShopLookup';

// GET /api/shop/customers/[id]/crm — Get customer CRM data (notes, tags, history, spend)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!['shop', 'manager', 'admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const shopId = auth.role === 'shop' ? auth.id : auth.shopId;
  const { id } = await params;

  try {
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        company: true,
        internalNotes: true,
        tags: true,
        createdAt: true,
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get work order history for this customer at this shop
    const workOrders = await prisma.workOrder.findMany({
      where: { customerId: id, shopId: shopId! },
      select: {
        id: true,
        status: true,
        vehicleType: true,
        estimatedCost: true,
        amountPaid: true,
        createdAt: true,
        completedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Calculate spend totals
    const totalSpend = workOrders.reduce((sum, wo) => sum + (wo.amountPaid || 0), 0);
    const totalJobs = workOrders.length;
    const completedJobs = workOrders.filter(wo => wo.status === 'closed').length;

    // Get vehicles
    const vehicles = await prisma.vehicle.findMany({
      where: { customerId: id },
      select: { id: true, make: true, model: true, year: true, licensePlate: true },
    });

    // Get reviews for this shop
    const reviews = await prisma.review.findMany({
      where: { customerId: id, shopId: shopId! },
      select: { id: true, rating: true, comment: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      customer: {
        ...customer,
        tags: customer.tags ? customer.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      },
      stats: {
        totalSpend: Math.round(totalSpend * 100) / 100,
        totalJobs,
        completedJobs,
        averageJobValue: totalJobs > 0 ? Math.round((totalSpend / totalJobs) * 100) / 100 : 0,
        memberSince: customer.createdAt,
      },
      workOrders,
      vehicles,
      reviews,
    });
  } catch (error) {
    console.error('Error fetching customer CRM:', error);
    return NextResponse.json({ error: 'Failed to fetch customer data' }, { status: 500 });
  }
}

// PUT /api/shop/customers/[id]/crm — Update notes and tags
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!['shop', 'manager', 'admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;
  const shopId = auth.role === 'shop' ? auth.id : auth.shopId;
  if (demoOutboundBlocked() || (shopId && await isDemoShopId(shopId))) {
    return NextResponse.json({ error: 'A demo shop cannot change a customer account.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { internalNotes, tags } = body;

    const updateData: Record<string, string | undefined> = {};
    if (typeof internalNotes === 'string') updateData.internalNotes = internalNotes;
    if (Array.isArray(tags)) updateData.tags = tags.join(',');

    const updated = await prisma.customer.update({
      where: { id },
      data: updateData,
      select: { id: true, internalNotes: true, tags: true },
    });

    return NextResponse.json({
      ...updated,
      tags: updated.tags ? updated.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    });
  } catch (error) {
    console.error('Error updating customer CRM:', error);
    return NextResponse.json({ error: 'Failed to update customer data' }, { status: 500 });
  }
}
