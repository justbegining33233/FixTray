import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

// Compatibility endpoint for shop customer messaging picker.
export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'manager', 'admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const requestedShopId = searchParams.get('shopId');
    const shopId = auth.role === 'shop' ? auth.id : (requestedShopId || auth.shopId);

    if (!shopId) {
      return NextResponse.json({ error: 'shopId is required' }, { status: 400 });
    }

    if (auth.role !== 'superadmin') {
      const allowedShopId = auth.role === 'shop' ? auth.id : auth.shopId;
      if (!allowedShopId || allowedShopId !== shopId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const workOrders = await prisma.workOrder.findMany({
      where: { shopId },
      select: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const unique = new Map<string, { id: string; name: string; email: string }>();
    for (const row of workOrders) {
      const customer = row.customer;
      if (!customer || unique.has(customer.id)) continue;
      unique.set(customer.id, {
        id: customer.id,
        name: `${customer.firstName} ${customer.lastName}`.trim(),
        email: customer.email,
      });
    }

    return NextResponse.json({ customers: Array.from(unique.values()) });
  } catch (error) {
    console.error('Customers list error:', error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}
