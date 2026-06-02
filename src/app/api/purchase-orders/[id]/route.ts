import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

function getAuthToken(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  return verifyToken(token);
}

// GET /api/purchase-orders/:id
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const decoded = getAuthToken(request);
    if (!decoded || (decoded.role !== 'shop' && decoded.role !== 'manager' && (decoded.role !== 'superadmin'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error('Error fetching purchase order:', error);
    return NextResponse.json({ error: 'Failed to fetch purchase order' }, { status: 500 });
  }
}

// PATCH /api/purchase-orders/:id
// Body: { status?, notes?, expectedDate?, receiveItems?: boolean }
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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
    const { status, notes, expectedDate, receiveItems } = body;

    const { id: paramsId } = await context.params;
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: paramsId },
      include: { items: true, shop: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    const updates: any = {};
    if (status) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    if (expectedDate) updates.expectedDate = new Date(expectedDate);

    let updatedOrder = await prisma.purchaseOrder.update({
      where: { id: paramsId },
      data: updates,
      include: { items: true },
    });

    if (receiveItems) {
      const shopSettings = await prisma.shopSettings.findUnique({
        where: { shopId: order.shopId },
        select: { inventoryMarkup: true },
      });
      const markup = shopSettings?.inventoryMarkup ?? 0.3;

      await prisma.$transaction(async tx => {
        for (const item of order.items) {
          const existing = await tx.inventoryStock.findFirst({
            where: {
              shopId: order.shopId,
              itemName: { equals: item.itemName },
            },
          });

          let inventoryId = item.inventoryStockId;

          if (existing) {
            await tx.inventoryStock.update({
              where: { id: existing.id },
              data: { quantity: existing.quantity + item.quantity, lastRestocked: new Date() },
            });
            inventoryId = existing.id;
          } else {
            const created = await tx.inventoryStock.create({
              data: {
                shopId: order.shopId,
                itemName: item.itemName,
                sku: item.sku,
                quantity: item.quantity,
                unitCost: item.unitCost,
                sellingPrice: item.unitCost * (1 + markup),
                reorderPoint: 10,
                reorderQuantity: 50,
                lastRestocked: new Date(),
              },
            });
            inventoryId = created.id;
          }

          await tx.purchaseOrderItem.update({
            where: { id: item.id },
            data: { status: 'received', inventoryStockId: inventoryId },
          });
        }

        await tx.purchaseOrder.update({
          where: { id: paramsId },
          data: { status: status || 'received', updatedAt: new Date() },
        });
      });

      updatedOrder = await prisma.purchaseOrder.findUnique({
        where: { id: paramsId },
        include: { items: true },
      }) as any;
    }

    return NextResponse.json({ order: updatedOrder });
  } catch (error) {
    console.error('Error updating purchase order:', error);
    return NextResponse.json({ error: 'Failed to update purchase order' }, { status: 500 });
  }
}
