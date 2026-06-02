import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

interface PartUsage {
  name?: string;
  sku?: string;
  quantity?: number;
  unitPrice?: number;
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'manager', 'admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId') || (auth.role === 'shop' ? auth.id : auth.shopId);
    const format = (searchParams.get('format') || 'json').toLowerCase();

    if (!shopId) {
      return NextResponse.json({ error: 'shopId is required' }, { status: 400 });
    }

    const inventory = await prisma.inventoryItem.findMany({
      where: { shopId },
      orderBy: { name: 'asc' },
    });

    const workOrders = await prisma.workOrder.findMany({
      where: {
        shopId,
        status: { in: ['waiting-for-payment', 'closed'] },
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        partsUsed: true,
      },
    });

    const usageMap = new Map<string, { key: string; name: string; sku?: string; quantity: number; totalValue: number; orderCount: number }>();

    for (const order of workOrders) {
      const parts = Array.isArray(order.partsUsed) ? (order.partsUsed as unknown as PartUsage[]) : [];
      for (const part of parts) {
        const qty = Number(part.quantity) || 0;
        if (qty <= 0) continue;
        const key = part.sku || part.name || 'unknown';
        const existing = usageMap.get(key) || {
          key,
          name: part.name || 'Unnamed part',
          sku: part.sku,
          quantity: 0,
          totalValue: 0,
          orderCount: 0,
        };
        existing.quantity += qty;
        existing.totalValue += qty * (Number(part.unitPrice) || 0);
        existing.orderCount += 1;
        usageMap.set(key, existing);
      }
    }

    const usageStats = Array.from(usageMap.values()).sort((a, b) => b.quantity - a.quantity);

    const stockLevels = inventory.map((item) => {
      const isLowStock = item.reorderPoint != null && item.quantity <= item.reorderPoint;
      const suggestedOrderQty = item.reorderPoint != null
        ? Math.max((item.reorderPoint * 2) - item.quantity, 0)
        : 0;

      return {
        id: item.id,
        sku: item.sku,
        name: item.name,
        type: item.type,
        quantity: item.quantity,
        reorderPoint: item.reorderPoint,
        isLowStock,
        price: item.price,
        inventoryValue: Number((item.quantity * item.price).toFixed(2)),
        suggestedOrderQty,
      };
    });

    const reorderRecommendations = stockLevels
      .filter((item) => item.isLowStock)
      .sort((a, b) => (a.quantity - (a.reorderPoint || 0)) - (b.quantity - (b.reorderPoint || 0)));

    const summary = {
      totalItems: stockLevels.length,
      lowStockItems: reorderRecommendations.length,
      totalInventoryValue: Number(stockLevels.reduce((sum, item) => sum + item.inventoryValue, 0).toFixed(2)),
      totalUsageQuantity: usageStats.reduce((sum, item) => sum + item.quantity, 0),
      totalUsageValue: Number(usageStats.reduce((sum, item) => sum + item.totalValue, 0).toFixed(2)),
    };

    if (format === 'csv') {
      const section = (searchParams.get('section') || 'stock').toLowerCase();
      const rows = section === 'usage' ? usageStats : section === 'reorder' ? reorderRecommendations : stockLevels;

      const headers = section === 'usage'
        ? ['name', 'sku', 'quantity', 'totalValue', 'orderCount']
        : ['name', 'sku', 'type', 'quantity', 'reorderPoint', 'isLowStock', 'inventoryValue', 'suggestedOrderQty'];

      const csv = [
        headers.join(','),
        ...rows.map((row: any) => headers.map((header) => JSON.stringify(row[header] ?? '')).join(',')),
      ].join('\n');

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="inventory-${section}-report.csv"`,
        },
      });
    }

    return NextResponse.json({ summary, stockLevels, usageStats, reorderRecommendations });
  } catch (error) {
    console.error('Inventory report error:', error);
    return NextResponse.json({ error: 'Failed to generate inventory report' }, { status: 500 });
  }
}
