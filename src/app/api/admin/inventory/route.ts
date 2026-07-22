import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

/**
 * GET /api/admin/inventory
 * Returns platform-wide inventory overview
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;

  try {
    // Get all inventory items across all shops
    const items = await prisma.inventoryStock.findMany({
      include: {
        shop: { select: { shopName: true } },
      },
      orderBy: { quantity: 'asc' },
      take: 1000,
    });

    // Calculate stats
    const lowStockItems = items.filter(i => i.quantity <= (i.reorderPoint || 10)).length;
    const outOfStockItems = items.filter(i => i.quantity === 0).length;
    const totalValue = items.reduce((sum, i) => sum + (i.unitCost * i.quantity), 0);
    const value30Days = items.reduce((sum, i) => {
      if (i.lastRestocked && new Date(i.lastRestocked) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
        return sum + (i.unitCost * i.quantity);
      }
      return sum;
    }, 0);

    return NextResponse.json({
      items: items.map(i => ({
        id: i.id,
        shopId: i.shopId,
        itemName: i.itemName,
        sku: i.sku,
        quantity: i.quantity,
        unitCost: i.unitCost,
        sellingPrice: i.sellingPrice,
        reorderPoint: i.reorderPoint,
        reorderQuantity: i.reorderQuantity,
        category: i.category,
        lastRestocked: i.lastRestocked,
      })),
      stats: {
        totalItems: items.length,
        lowStockItems,
        outOfStockItems,
        totalValue,
        value30Days,
        averageQuantity: items.reduce((sum, i) => sum + i.quantity, 0) / items.length || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
  }
}
