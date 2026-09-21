import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import {
  activeWorkOrderWhere,
  completedTodayWhere,
  pendingQueueWhere,
  resolveShopId,
  unassignedWorkOrderWhere,
} from '@/lib/workOrderMetrics';

// GET - Get manager dashboard data
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded || (decoded.role !== 'manager' && decoded.role !== 'shop')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const resolvedShop = resolveShopId(
      { id: decoded.id, role: decoded.role, shopId: decoded.shopId },
      null,
    );
    if (!resolvedShop.ok) {
      return NextResponse.json({ error: 'Shop ID not found' }, { status: 400 });
    }
    const shopId = resolvedShop.shopId;

    // Get work orders summary
    const workOrders = await prisma.workOrder.findMany({
      where: { shopId },
      include: {
        customer: {
          select: { firstName: true, lastName: true },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const scope = { shopId };
    const now = new Date();
    const [openJobs, pendingJobs, unassigned, completedToday] = await Promise.all([
      prisma.workOrder.count({ where: activeWorkOrderWhere(scope) }),
      prisma.workOrder.count({ where: pendingQueueWhere(scope) }),
      prisma.workOrder.count({ where: unassignedWorkOrderWhere(scope) }),
      prisma.workOrder.count({ where: completedTodayWhere(scope, now) }),
    ]);

    // Get team members
    const techs = await prisma.tech.findMany({
      where: { shopId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        assignedWorkOrders: {
          where: {
            status: { in: ['assigned', 'in-progress'] },
          },
          select: { id: true },
        },
      },
    });

    // Get pending inventory requests
    const inventoryRequests = await prisma.inventoryRequest.findMany({
      where: {
        shopId,
        status: 'pending',
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return NextResponse.json({
      stats: {
        openJobs,
        pendingJobs,
        unassigned,
        completedToday,
        totalTechs: techs.length,
        activeTechs: techs.filter((t) => t.assignedWorkOrders.length > 0).length,
        pendingInventoryRequests: inventoryRequests.length,
      },
      recentWorkOrders: workOrders.slice(0, 10),
      teamMembers: techs,
      inventoryRequests,
    });
  } catch (error) {
    console.error('Error fetching manager dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
