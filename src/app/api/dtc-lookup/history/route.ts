import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import logger from '@/lib/logger';

/**
 * GET /api/dtc-lookup/history — Retrieve DTC lookup history for authenticated tech
 * Phase 4: Integration fix - DTC lookups are logged but never retrieved
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['tech', 'shop', 'manager']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const workOrderId = searchParams.get('workOrderId');

    let where: any = {};
    
    if (auth.role === 'tech') {
      where.techId = auth.id;
    } else if (auth.role !== 'superadmin') {
      // Shop or manager can only see lookups for their own shop
      where.shopId = auth.id || auth.shopId;
    }

    if (workOrderId) {
      where.workOrderId = workOrderId;
    }

    const lookups = await prisma.dTCLookup.findMany({
      where,
      select: {
        id: true,
        code: true,
        system: true,
        description: true,
        workOrderId: true,
      },
      orderBy: { id: 'desc' },
      take: limit,
    });

    // Enrich with work order info if available
    const lookupIds = lookups
      .filter(l => l.workOrderId)
      .map(l => l.workOrderId)
      .filter((id): id is string => id !== null);

    const workOrders = lookupIds.length > 0
      ? await prisma.workOrder.findMany({
          where: { id: { in: lookupIds } },
          select: {
            id: true,
            customerId: true,
          },
        })
      : [];

    const woMap = new Map(workOrders.map(wo => [wo.id, wo]));

    const enriched = lookups.map(lookup => {
      const wo = lookup.workOrderId ? woMap.get(lookup.workOrderId) : null;
      return {
        ...lookup,
        workOrder: wo ? {
          id: wo.id,
          customerId: wo.customerId,
        } : null,
      };
    });

    return NextResponse.json({
      total: lookups.length,
      limit,
      lookups: enriched,
    });
  } catch (error) {
    logger.error('DTC lookup history GET error:', error, { endpoint: '/api/dtc-lookup/history' });
    return NextResponse.json({ error: 'Failed to fetch DTC lookup history' }, { status: 500 });
  }
}
