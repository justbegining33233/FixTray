import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'manager', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const shopId = (auth.role === 'superadmin')
    ? new URL(request.url).searchParams.get('shopId') || undefined
    : auth.role === 'shop' ? auth.id : auth.shopId;

  if (!shopId) {
    return NextResponse.json({ error: 'Shop ID required' }, { status: 400 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get('days') || '30'), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Fetch completed work orders within the time period
    const workOrders = await prisma.workOrder.findMany({
      where: {
        shopId,
        createdAt: { gte: since },
        status: { in: ['closed', 'completed', 'Completed', 'waiting-for-payment'] },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        completedAt: true,
        dueDate: true,
        assignedTechId: true,
        estimatedCost: true,
        amountPaid: true,
        assignedTo: { select: { firstName: true, lastName: true } },
      },
    });

    // All work orders (including open) for overall stats
    const allWOs = await prisma.workOrder.findMany({
      where: { shopId, createdAt: { gte: since } },
      select: { id: true, status: true, createdAt: true, completedAt: true, dueDate: true, assignedTechId: true },
    });

    // SLA compliance: % of WOs completed before due date
    const withDueDate = workOrders.filter(wo => wo.dueDate && wo.completedAt);
    const onTime = withDueDate.filter(wo => new Date(wo.completedAt!) <= new Date(wo.dueDate!));
    const slaComplianceRate = withDueDate.length > 0 ? Math.round((onTime.length / withDueDate.length) * 100) : 100;

    // Average completion time (hours from creation to completion)
    const completionTimes = workOrders
      .filter(wo => wo.completedAt)
      .map(wo => (new Date(wo.completedAt!).getTime() - new Date(wo.createdAt).getTime()) / (1000 * 60 * 60));
    const avgCompletionHours = completionTimes.length > 0
      ? Math.round((completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length) * 10) / 10
      : 0;

    // Per-tech performance
    const techMap = new Map<string, { name: string; completed: number; onTime: number; totalHours: number; revenue: number }>();
    for (const wo of workOrders) {
      if (!wo.assignedTechId) continue;
      const entry = techMap.get(wo.assignedTechId) || {
        name: wo.assignedTo ? `${wo.assignedTo.firstName} ${wo.assignedTo.lastName}` : 'Unassigned',
        completed: 0,
        onTime: 0,
        totalHours: 0,
        revenue: 0,
      };
      entry.completed++;
      if (wo.dueDate && wo.completedAt && new Date(wo.completedAt) <= new Date(wo.dueDate)) {
        entry.onTime++;
      }
      if (wo.completedAt) {
        entry.totalHours += (new Date(wo.completedAt).getTime() - new Date(wo.createdAt).getTime()) / (1000 * 60 * 60);
      }
      entry.revenue += wo.amountPaid || wo.estimatedCost || 0;
      techMap.set(wo.assignedTechId, entry);
    }

    const techPerformance = Array.from(techMap.entries()).map(([techId, data]) => ({
      techId,
      name: data.name,
      completedJobs: data.completed,
      slaComplianceRate: data.completed > 0 ? Math.round((data.onTime / data.completed) * 100) : 100,
      avgCompletionHours: data.completed > 0 ? Math.round((data.totalHours / data.completed) * 10) / 10 : 0,
      revenue: Math.round(data.revenue * 100) / 100,
    })).sort((a, b) => b.completedJobs - a.completedJobs);

    // Status breakdown
    const statusCounts: Record<string, number> = {};
    for (const wo of allWOs) {
      statusCounts[wo.status] = (statusCounts[wo.status] || 0) + 1;
    }

    return NextResponse.json({
      period: { days, since: since.toISOString() },
      overview: {
        totalWorkOrders: allWOs.length,
        completedWorkOrders: workOrders.length,
        slaComplianceRate,
        avgCompletionHours,
        onTimeCount: onTime.length,
        lateCount: withDueDate.length - onTime.length,
      },
      statusBreakdown: statusCounts,
      techPerformance,
    });
  } catch (error) {
    console.error('Error fetching SLA metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}
