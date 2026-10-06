import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { activeWorkOrderWhere, pendingApprovalWhere, resolveShopId } from '@/lib/workOrderMetrics';
import { shopWeekRange, shopDayRange, dayKey } from '@/lib/books/periods';
import { loadShopFacts, shopTimeZone } from '@/lib/books/loadTruth';
import { rangeSnapshot } from '@/lib/books/truth';

// GET - Get shop dashboard stats
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

    const { searchParams } = new URL(request.url);
    const resolved = resolveShopId(decoded, searchParams.get('shopId'));
    if (!resolved.ok) {
      const status = resolved.error === 'forbidden' ? 403 : 400;
      return NextResponse.json(
        { error: resolved.error === 'forbidden' ? 'Forbidden' : 'Shop ID required' },
        { status },
      );
    }
    const shopId = resolved.shopId;

    if (decoded.role === 'manager' || decoded.role === 'tech') {
      const tech = await prisma.tech.findFirst({
        where: { id: decoded.id, shopId },
      });
      if (!tech) {
        return NextResponse.json({ error: 'Access denied to this shop' }, { status: 403 });
      }
    } else if (decoded.role !== 'shop' && decoded.role !== 'superadmin' && decoded.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Shop access only' }, { status: 403 });
    }

    const zone = await shopTimeZone(shopId);
    const now = new Date();
    const todayKey = dayKey(now, zone);
    const today = shopDayRange(todayKey, zone);
    const week = shopWeekRange(now, zone);
    const showRevenue = decoded.role === 'shop' || decoded.role === 'admin' || decoded.role === 'superadmin';
    const facts = await loadShopFacts(shopId);
    const todaySnap = rangeSnapshot(facts, today.start, today.end, zone);
    const weekSnap = rangeSnapshot(facts, week.start, week.end, zone);

    // Work order stats
    const [openJobs] = await Promise.all([
      prisma.workOrder.count({
        where: activeWorkOrderWhere({ shopId }),
      }),
    ]);
    const completedToday = todaySnap.completedCount;
    const weekJobs = weekSnap.completedCount;
    const todayRevenue = todaySnap.revenueCents / 100;
    const weekRevenue = weekSnap.revenueCents / 100;

    // Get team stats
    const [totalTechs, activeTechs, clockedInNow] = await Promise.all([
      prisma.tech.count({ where: { shopId } }),
      prisma.tech.count({ where: { shopId, available: true } }),
      prisma.timeEntry.findMany({
        where: {
          shopId,
          clockOut: null, // Currently clocked in
        },
        include: {
          tech: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      }),
    ]);

    // Get pending approvals (work orders waiting for estimates, etc.)
    const pendingApprovals = await prisma.workOrder.count({
      where: pendingApprovalWhere({ shopId }),
    });

    // Get inventory requests pending approval
    const pendingInventoryRequests = await prisma.inventoryRequest.count({
      where: {
        shopId,
        status: 'pending',
      },
    });

    return NextResponse.json({
      workOrders: {
        open: openJobs,
        completedToday,
        completedThisWeek: weekJobs,
        pendingApprovals,
      },
      revenue: showRevenue
        ? { today: todayRevenue, week: weekRevenue, revenueVisible: true }
        : { revenueVisible: false },
      team: {
        total: totalTechs,
        active: activeTechs,
        clockedIn: clockedInNow.length,
        currentlyWorking: clockedInNow.map(entry => ({
          id: entry.tech.id,
          name: `${entry.tech.firstName} ${entry.tech.lastName}`,
          role: entry.tech.role,
          clockedInAt: entry.clockIn,
          duration: Math.floor((Date.now() - entry.clockIn.getTime()) / (1000 * 60)), // minutes
        })),
      },
      inventory: {
        pendingRequests: pendingInventoryRequests,
      },
    });
  } catch (error) {
    console.error('Error fetching shop stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
