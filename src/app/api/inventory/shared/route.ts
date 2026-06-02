import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

// GET /api/inventory/shared — view inventory across multiple shops
export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const lowStockOnly = searchParams.get('lowStockOnly') === 'true';

    let shopIds: string[] = [];
    if (auth.role === 'superadmin') {
      const shops = await prisma.shop.findMany({ where: { status: 'approved' }, select: { id: true } });
      shopIds = shops.map(s => s.id);
    } else if (auth.role === 'shop') {
      const currentShop = await prisma.shop.findUnique({ where: { id: auth.id }, select: { email: true } });
      if (currentShop) {
        const owned = await prisma.shop.findMany({ where: { email: currentShop.email, status: 'approved' }, select: { id: true } });
        shopIds = owned.map(s => s.id);
      }
    } else {
      shopIds = auth.shopId ? [auth.shopId] : [];
    }

    if (shopIds.length === 0) {
      return NextResponse.json({ inventory: [] });
    }

    const where: any = { shopId: { in: shopIds } };
    if (lowStockOnly) {
      where.type = 'part';
      where.reorderPoint = { not: null };
    }

    const inventory = await prisma.inventoryItem.findMany({
      where,
      include: {
        shop: { select: { id: true, shopName: true } },
      },
      orderBy: { name: 'asc' },
    });

    // If lowStockOnly, filter items at/below reorder point
    const items = lowStockOnly
      ? inventory.filter(i => i.quantity <= (i.reorderPoint ?? 0))
      : inventory;

    return NextResponse.json({
      shopsIncluded: shopIds.length,
      totalItems: items.length,
      inventory: items.map(i => ({
        id: i.id,
        shopId: i.shopId,
        shopName: i.shop.shopName,
        name: i.name,
        sku: i.sku,
        type: i.type,
        quantity: i.quantity,
        price: i.price,
        reorderPoint: i.reorderPoint,
        rate: i.rate,
      })),
    });
  } catch (error) {
    console.error('Error fetching shared inventory:', error);
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
  }
}

// POST /api/inventory/shared — transfer inventory between shops
export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { fromShopId, toShopId, itemId, quantity } = await request.json();

    if (!fromShopId || !toShopId || !itemId || !quantity || quantity <= 0) {
      return NextResponse.json({ error: 'fromShopId, toShopId, itemId, and quantity (>0) are required' }, { status: 400 });
    }

    if (fromShopId === toShopId) {
      return NextResponse.json({ error: 'Cannot transfer to the same shop' }, { status: 400 });
    }

    // Verify ownership of both shops
    if (auth.role === 'shop') {
      const currentShop = await prisma.shop.findUnique({ where: { id: auth.id }, select: { email: true } });
      if (!currentShop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
      const owned = await prisma.shop.findMany({ where: { email: currentShop.email }, select: { id: true } });
      const ownedIds = owned.map(s => s.id);
      if (!ownedIds.includes(fromShopId) || !ownedIds.includes(toShopId)) {
        return NextResponse.json({ error: 'You can only transfer between your own shops' }, { status: 403 });
      }
    }

    // Get source item
    const sourceItem = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
    if (!sourceItem || sourceItem.shopId !== fromShopId) {
      return NextResponse.json({ error: 'Source item not found in the specified shop' }, { status: 404 });
    }

    if (sourceItem.quantity < quantity) {
      return NextResponse.json({ error: `Insufficient stock. Available: ${sourceItem.quantity}` }, { status: 400 });
    }

    // Deduct from source
    await prisma.inventoryItem.update({
      where: { id: itemId },
      data: { quantity: { decrement: quantity } },
    });

    // Find or create matching item in target shop
    let targetItem = await prisma.inventoryItem.findFirst({
      where: { shopId: toShopId, name: sourceItem.name, sku: sourceItem.sku },
    });

    if (targetItem) {
      await prisma.inventoryItem.update({
        where: { id: targetItem.id },
        data: { quantity: { increment: quantity } },
      });
    } else {
      targetItem = await prisma.inventoryItem.create({
        data: {
          shopId: toShopId,
          name: sourceItem.name,
          sku: sourceItem.sku,
          type: sourceItem.type,
          quantity,
          price: sourceItem.price,
          reorderPoint: sourceItem.reorderPoint,
          rate: sourceItem.rate,
        },
      });
    }

    // Log the transfer as an activity
    await prisma.activityLog.create({
      data: {
        type: 'shop',
        action: 'inventory_transfer',
        details: `Transferred ${quantity}x "${sourceItem.name}" from shop ${fromShopId} to ${toShopId}`,
        severity: 'info',
        user: auth.id,
        shopId: fromShopId,
      },
    });

    return NextResponse.json({
      success: true,
      transfer: {
        item: sourceItem.name,
        quantity,
        fromShopId,
        toShopId,
        sourceRemainingQty: sourceItem.quantity - quantity,
      },
    });
  } catch (error) {
    console.error('Error transferring inventory:', error);
    return NextResponse.json({ error: 'Failed to transfer inventory' }, { status: 500 });
  }
}
