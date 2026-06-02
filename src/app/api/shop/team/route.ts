import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// GET - Get detailed team information including clock status and recent timesheets
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
      if (decoded.id !== shopId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    } else if (decoded.role === 'manager' || decoded.role === 'tech') {
      const tech = await prisma.tech.findFirst({
        where: { id: decoded.id, shopId },
      });
      if (!tech) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Shop owners and managers can see hourlyRate; techs cannot
    const canSeePayroll = decoded.role === 'shop' || decoded.role === 'manager';

    // Get all team members for this shop
    const teamMembers = await prisma.tech.findMany({
      where: { shopId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        available: true,
        hourlyRate: true,
        createdAt: true,
      },
      orderBy: [
        { role: 'asc' }, // managers first
        { firstName: 'asc' },
      ],
    });

    // Get current clock-in status for each team member
    const teamMemberIds = teamMembers.map(m => m.id);
    const activeTimeEntries = await prisma.timeEntry.findMany({
      where: {
        techId: { in: teamMemberIds },
        clockOut: null,
      },
      select: {
        techId: true,
        clockIn: true,
        breakStart: true,
        notes: true,
        location: true,
      },
    });

    // Get recent time entries (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentTimeEntries = await prisma.timeEntry.findMany({
      where: {
        techId: { in: teamMemberIds },
        clockIn: { gte: sevenDaysAgo },
      },
      select: {
        techId: true,
        clockIn: true,
        clockOut: true,
        hoursWorked: true,
        breakDuration: true,
      },
      orderBy: { clockIn: 'desc' },
    });

    // Build comprehensive team data
    const teamData = teamMembers.map(member => {
      const activeEntry = activeTimeEntries.find(e => e.techId === member.id);
      const recentEntries = recentTimeEntries.filter(e => e.techId === member.id);
      
      // Calculate weekly hours
      const weeklyHours = recentEntries
        .filter(e => e.hoursWorked)
        .reduce((sum, e) => sum + (e.hoursWorked || 0), 0);
      
      // Calculate current session duration if clocked in
      let currentSessionMinutes = 0;
      if (activeEntry) {
        currentSessionMinutes = Math.floor(
          (Date.now() - new Date(activeEntry.clockIn).getTime()) / (1000 * 60)
        );
      }

      return {
        id: member.id,
        name: `${member.firstName} ${member.lastName}`,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        phone: member.phone,
        role: member.role,
        available: member.available,
        ...(canSeePayroll ? { hourlyRate: member.hourlyRate } : {}),
        joinedAt: member.createdAt,
        
        // Clock status
        isClockedIn: !!activeEntry,
        clockedInAt: activeEntry?.clockIn,
        clockedInLocation: activeEntry?.location,
        clockedInNotes: activeEntry?.notes,
        onBreak: !!activeEntry?.breakStart,
        currentSessionMinutes,
        
        // Statistics
        weeklyHours: Math.round(weeklyHours * 100) / 100,
        recentShifts: recentEntries.length,
      };
    });

    return NextResponse.json({ team: teamData });
  } catch (error) {
    console.error('Error fetching team data:', error);
    return NextResponse.json({ error: 'Failed to fetch team data' }, { status: 500 });
  }
}
