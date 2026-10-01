import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { normalizeInventoryType, optionalInventoryText } from '@/lib/inventoryItem';
import { syncLowStockReorderAsks } from '@/lib/lowStockReorderAsk';

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['shop', 'manager', 'tech', 'admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const shopId = searchParams.get('shopId');
    const lowStockOnly = searchParams.get('lowStockOnly') === 'true';

    if (!shopId) {
      return NextResponse.json({ error: 'shopId is required' }, { status: 400 });
    }

    const stock = await prisma.inventoryItem.findMany({
      where: { shopId },
      orderBy: { updatedAt: 'desc' },
    });
    const items = lowStockOnly
      ? stock.filter((item) => item.reorderPoint != null && item.quantity <= (item.reorderPoint ?? 0))
      : stock;

    try {
      await syncLowStockReorderAsks(shopId, stock);
    } catch (error) {
      console.error('Failed to ask manager about low stock:', error);
    }

    return NextResponse.json({ inventory: items });
  } catch (error) {
    console.error('Failed to load inventory:', error);
    return NextResponse.json({ error: 'Failed to load inventory' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['shop', 'manager', 'admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { shopId, type, name, sku, quantity, price, reorderPoint, rate, supplier, notes } = body;
    const normalizedType = normalizeInventoryType(type);

    if (!shopId || !type || !name) {
      return NextResponse.json({ error: 'shopId, type, and name are required' }, { status: 400 });
    }
    if (!normalizedType) {
      return NextResponse.json({ error: 'Invalid type. Must be Part or Labor' }, { status: 400 });
    }

    const item = await prisma.inventoryItem.create({
      data: {
        shopId,
        type: normalizedType,
        name: name.trim(),
        sku: sku?.trim() || null,
        quantity: Number(quantity) || 0,
        price: Number(price) || 0,
        reorderPoint: reorderPoint != null ? Number(reorderPoint) : null,
        rate: normalizedType === 'labor' ? (Number(rate) || 0) : null,
        supplier: optionalInventoryText(supplier) ?? null,
        notes: optionalInventoryText(notes) ?? null,
      },
    });

    try {
      await syncLowStockReorderAsks(shopId, [item]);
    } catch (error) {
      console.error('Failed to ask manager about low stock:', error);
    }

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('Failed to create inventory item:', error);
    return NextResponse.json({ error: 'Failed to create inventory item' }, { status: 500 });
  }
}
