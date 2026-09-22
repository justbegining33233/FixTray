import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { calendarDateToUtcNoon } from '@/lib/calendarDate';
import { validatePurchaseOrder } from '@/lib/shopFormValidation';

// GET /api/purchase-orders?shopId=...
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Shop owners, managers, techs (own shop), and admins can view purchase orders
    if (!['shop', 'manager', 'tech', 'admin', 'superadmin'].includes(decoded.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');

    if (!shopId) {
      return NextResponse.json({ error: 'Shop ID required' }, { status: 400 });
    }

    // Enforce ownership: shops/managers can only see their own POs
    if (decoded.role === 'shop' && decoded.id !== shopId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if ((decoded.role === 'manager' || decoded.role === 'tech') && decoded.shopId !== shopId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orders = await prisma.purchaseOrder.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
      },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    return NextResponse.json({ error: 'Failed to fetch purchase orders' }, { status: 500 });
  }
}

// POST /api/purchase-orders
// Body: { shopId, vendor?, expectedDate?, notes?, createdById?, items: [{ itemName, sku?, quantity, unitCost, workOrderId?, inventoryStockId? }] }
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded || (decoded.role !== 'shop' && decoded.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized - shop admin or manager only' }, { status: 403 });
    }

    const body = await request.json();
    const { shopId, vendor, expectedDate, notes, createdById, items } = body;
    const poCheck = validatePurchaseOrder({ vendor, items });
    if (!shopId || !poCheck.ok) {
      return NextResponse.json({ error: poCheck.ok ? 'Shop ID is required' : poCheck.error }, { status: 400 });
    }

    let expected: Date | undefined;
    if (expectedDate) {
      const parsed = calendarDateToUtcNoon(expectedDate);
      if (!parsed) return NextResponse.json({ error: 'Expected date is invalid.' }, { status: 400 });
      expected = parsed;
    }

    const totalCost = items.reduce((sum: number, item: any) => sum + (Number(item.unitCost) || 0) * (Number(item.quantity) || 0), 0);

    const order = await prisma.purchaseOrder.create({
      data: {
        shopId,
        vendor: String(vendor).trim(),
        expectedDate: expected,
        notes,
        status: 'ordered',
        createdById: createdById || decoded.id,
        totalCost,
        items: {
          create: items.map((item: any) => ({
            itemName: String(item.itemName || item.description).trim(),
            sku: item.sku,
            quantity: Number(item.quantity ?? item.qty),
            unitCost: Number(item.unitCost),
            workOrderId: item.workOrderId || null,
            inventoryStockId: item.inventoryStockId || null,
          })),
        },
      },
      include: { items: true },
    });

    return NextResponse.json({ order, message: 'Purchase order created' }, { status: 201 });
  } catch (error) {
    console.error('Error creating purchase order:', error);
    return NextResponse.json({ error: 'Failed to create purchase order' }, { status: 500 });
  }
}
