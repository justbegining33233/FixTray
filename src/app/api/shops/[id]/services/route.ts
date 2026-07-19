import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import logger from '@/lib/logger';

/**
 * GET /api/shops/[id]/services — List all services offered by a shop
 * Phase 4: Integration fix - Services are saved but not retrievable by customers
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, ['customer', 'shop', 'admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const shop = await prisma.shop.findUnique({
      where: { id },
      select: { id: true, shopName: true, services: true },
    });

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    // Group services by category for easier frontend consumption
    const servicesByCategory = new Map<string, string[]>();
    for (const service of shop.services) {
      const category = service.category || 'other';
      if (!servicesByCategory.has(category)) {
        servicesByCategory.set(category, []);
      }
      servicesByCategory.get(category)!.push(service.serviceName);
    }

    return NextResponse.json({
      shopId: shop.id,
      shopName: shop.shopName,
      totalServices: shop.services.length,
      servicesByCategory: Object.fromEntries(servicesByCategory),
      allServices: shop.services.map(s => ({
        name: s.serviceName,
        category: s.category,
      })),
    });
  } catch (error) {
    logger.error('Shop services GET error:', error, { endpoint: '/api/shops/[id]/services' });
    return NextResponse.json({ error: 'Failed to fetch shop services' }, { status: 500 });
  }
}
