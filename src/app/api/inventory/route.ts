import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

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

    const where: any = { shopId };
    if (lowStockOnly) {
      // Items where quantity <= reorderPoint
      where.reorderPoint = { not: null };
      where.quantity = { lte: prisma.inventoryItem.fields.reorderPoint };
    }

    // For lowStock, we need a raw approach since Prisma can't compare two columns directly
    let items;
    if (lowStockOnly) {
      items = await prisma.inventoryItem.findMany({
        where: { shopId },
        orderBy: { updatedAt: 'desc' },
      });
      items = items.filter(item => item.reorderPoint != null && item.quantity <= (item.reorderPoint ?? 0));
    } else {
      items = await prisma.inventoryItem.findMany({
        where: { shopId },
        orderBy: { updatedAt: 'desc' },
      });
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
    const { shopId, type, name, sku, quantity, price, reorderPoint, rate } = body;

    if (!shopId || !type || !name) {
      return NextResponse.json({ error: 'shopId, type, and name are required' }, { status: 400 });
    }
    if (!['part', 'labor'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type. Must be part or labor' }, { status: 400 });
    }

    const item = await prisma.inventoryItem.create({
      data: {
        shopId,
        type,
        name: name.trim(),
        sku: sku?.trim() || null,
        quantity: Number(quantity) || 0,
        price: Number(price) || 0,
        reorderPoint: reorderPoint != null ? Number(reorderPoint) : null,
        rate: type === 'labor' ? (Number(rate) || 0) : null,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('Failed to create inventory item:', error);
    return NextResponse.json({ error: 'Failed to create inventory item' }, { status: 500 });
  }
}
