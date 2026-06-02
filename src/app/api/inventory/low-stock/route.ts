import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { rateLimit, rateLimitConfigs } from '@/lib/rateLimit';

// GET - Get low stock items
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(rateLimitConfigs.api)(request);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = requireRole(request, ['shop', 'manager', 'tech']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');

    if (!shopId) {
      return NextResponse.json({ error: 'Shop ID required' }, { status: 400 });
    }

    // Verify access
    const userShopId = auth.role === 'shop' ? auth.id : auth.shopId;
    if (shopId !== userShopId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get all inventory items
    const inventory = await prisma.inventoryItem.findMany({
      where: { shopId },
      orderBy: { name: 'asc' },
    });

    // Filter for low stock
    const lowStock = inventory.filter(item => {
      if (item.reorderPoint === null) return false;
      return item.quantity <= item.reorderPoint;
    });

    return NextResponse.json({ 
      lowStock,
      count: lowStock.length,
    });
  } catch (error) {
    console.error('Error fetching low stock items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch low stock items' },
      { status: 500 }
    );
  }
}


