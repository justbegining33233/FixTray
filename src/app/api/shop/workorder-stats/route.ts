import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole, AuthUser } from '@/lib/auth';
import {
  activeWorkOrderWhere,
  completedTodayWhere,
  overdueWorkOrderWhere,
  pendingApprovalWhere,
  pendingQueueWhere,
  resolveShopId,
  unassignedWorkOrderWhere,
} from '@/lib/workOrderMetrics';

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'manager', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const user = auth as AuthUser;
  const { searchParams } = new URL(request.url);
  const resolved = resolveShopId(user, searchParams.get('shopId'));
  if (!resolved.ok) {
    const status = resolved.error === 'forbidden' ? 403 : 400;
    const error = resolved.error === 'forbidden' ? 'Forbidden' : 'Shop ID is required';
    return NextResponse.json({ error }, { status });
  }
  const shopId = resolved.shopId;

  try {
    const scope = { shopId };
    const now = new Date();
    const pendingWhere = pendingQueueWhere(scope);

    const [openJobs, pendingQueue, pendingApprovals, unassigned, overdueJobs, completedToday, pendingJobs] = await Promise.all([
      prisma.workOrder.count({ where: activeWorkOrderWhere(scope) }),
      prisma.workOrder.count({ where: pendingWhere }),
      prisma.workOrder.count({ where: pendingApprovalWhere(scope) }),
      prisma.workOrder.count({ where: unassignedWorkOrderWhere(scope) }),
      prisma.workOrder.count({ where: overdueWorkOrderWhere(scope, now) }),
      prisma.workOrder.count({ where: completedTodayWhere(scope, now) }),
      prisma.workOrder.findMany({
        where: pendingWhere,
        orderBy: { createdAt: 'asc' },
        take: 100,
        include: {
          customer: { select: { firstName: true, lastName: true } },
          assignedTo: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    const stats = {
      openJobs,
      activeJobs: openJobs,
      pendingQueue,
      pendingApprovals,
      unassigned,
      pendingAssignments: unassigned,
      overdueJobs,
      completedToday,
    };

    return NextResponse.json({ stats, pendingJobs });
  } catch (error) {
    console.error('Error fetching work order stats:', error);
    return NextResponse.json({ error: 'Failed to fetch work order stats' }, { status: 500 });
  }
}
