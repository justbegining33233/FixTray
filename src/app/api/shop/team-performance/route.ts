import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole, AuthUser } from '@/lib/auth';
import { staffPunchMinutes } from '@/lib/books/clocks';
import { closeStaleOpenPunches, openPunchLive } from '@/lib/staffClock';
import { ACTIVE_WORK_ORDER_STATUSES } from '@/lib/workOrderMetrics';

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'manager', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const user = auth as AuthUser;
  const { searchParams } = new URL(request.url);
  const shopId = user.role === 'admin'
    ? searchParams.get('shopId')
    : (user.shopId ?? user.id);

  if (!shopId) {
    return NextResponse.json({ error: 'Shop ID is required' }, { status: 400 });
  }

  try {
    const now = new Date();
    await closeStaleOpenPunches({ shopId }, now);
    const [teamMembers, openPunches, openAssignments] = await Promise.all([
    prisma.tech.findMany({
      where: { shopId },
      include: {
        timeEntries: {
          where: {
            clockIn: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)), // Today
            },
          },
        },
        assignedWorkOrders: {
          where: {
            status: 'closed',
            updatedAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)), // Today
            },
          },
        },
      },
    }),
    prisma.timeEntry.findMany({
      where: { shopId, clockOut: null },
      select: { techId: true, clockIn: true },
    }),
    prisma.workOrder.findMany({
      where: {
        shopId,
        assignedTechId: { not: null },
        status: { in: [...ACTIVE_WORK_ORDER_STATUSES] },
      },
      select: { assignedTechId: true },
    }),
    ]);

    const liveTechIds = new Set(
      openPunches.filter((entry) => openPunchLive(entry.clockIn, now)).map((entry) => entry.techId),
    );
    const onJobIds = new Set(openAssignments.map((row) => row.assignedTechId).filter((id): id is string => !!id));
    const performance = teamMembers.map(member => {
      const todayMinutes = member.timeEntries.reduce((acc, entry) => acc + staffPunchMinutes({
        clockIn: entry.clockIn,
        clockOut: entry.clockOut,
        hoursWorked: entry.hoursWorked,
        breakMinutes: entry.breakDuration,
      }, now), 0);
      const todayHours = todayMinutes / 60;

      return {
        id: member.id,
        name: `${member.firstName} ${member.lastName}`,
        isActive: liveTechIds.has(member.id),
        isClockedIn: liveTechIds.has(member.id),
        onJob: onJobIds.has(member.id),
        completedJobs: member.assignedWorkOrders.length,
        hoursToday: Math.round(todayHours * 100) / 100,
      };
    });

    return NextResponse.json({ performance });
  } catch (error) {
    console.error('Error fetching team performance:', error);
    return NextResponse.json({ error: 'Failed to fetch team performance' }, { status: 500 });
  }
}