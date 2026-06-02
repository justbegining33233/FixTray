import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

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
    const shopId = searchParams.get('shopId');
    // Data isolation: the requested shopId must belong to the authenticated user
    // (admins/superadmins can query any shop)
    if (decoded.role !== 'superadmin' && shopId && shopId !== decoded.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }


    if (!shopId) {
      return NextResponse.json({ error: 'Shop ID required' }, { status: 400 });
    }

    // Verify user has access to this shop
    if (decoded.role === 'shop') {
      // For shop owners, verify they own this shop
      if (decoded.id !== shopId) {
        return NextResponse.json({ error: 'Access denied to this shop' }, { status: 403 });
      }
    } else if (decoded.role === 'manager' || decoded.role === 'tech') {
      // For managers and techs, verify they belong to this shop
      const tech = await prisma.tech.findFirst({
        where: {
          id: decoded.id,
          shopId: shopId,
        },
      });
      
      if (!tech) {
        return NextResponse.json({ error: 'Access denied to this shop' }, { status: 403 });
      }
    } else {
      // Reject any other roles
      return NextResponse.json({ error: 'Unauthorized - Shop access only' }, { status: 403 });
    }

    // Get all work orders for the shop
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Work order stats
    const [openJobs, completedToday, weekJobs, allJobs] = await Promise.all([
      prisma.workOrder.count({
        where: {
          shopId,
          status: { in: ['pending', 'assigned', 'in-progress'] },
        },
      }),
      prisma.workOrder.count({
        where: {
          shopId,
          status: 'closed',
          completedAt: { gte: today, lt: tomorrow },
        },
      }),
      prisma.workOrder.count({
        where: {
          shopId,
          completedAt: { gte: weekAgo },
        },
      }),
      prisma.workOrder.findMany({
        where: { shopId },
        select: {
          status: true,
          amountPaid: true,
          completedAt: true,
        },
      }),
    ]);

    // Calculate revenue
    const todayRevenue = allJobs
      .filter(j => j.completedAt && j.completedAt >= today && j.completedAt < tomorrow)
      .reduce((sum, j) => sum + (j.amountPaid || 0), 0);

    const weekRevenue = allJobs
      .filter(j => j.completedAt && j.completedAt >= weekAgo)
      .reduce((sum, j) => sum + (j.amountPaid || 0), 0);

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
      where: {
        shopId,
        status: { in: ['waiting-estimate', 'waiting-for-payment'] },
      },
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
      revenue: {
        today: todayRevenue,
        week: weekRevenue,
      },
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
