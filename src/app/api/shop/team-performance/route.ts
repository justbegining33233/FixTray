import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole, AuthUser } from '@/lib/auth';
import { staffPunchMinutes } from '@/lib/books/clocks';

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
    // Get team members with their performance data
    const teamMembers = await prisma.tech.findMany({
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
    });

    const now = new Date();
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
        isActive: member.available,
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