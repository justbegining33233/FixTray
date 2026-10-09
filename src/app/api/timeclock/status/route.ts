import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { closeStaleOpenPunches, openPunchLive } from '@/lib/staffClock';

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId parameter required' }, { status: 400 });
    }

    // Check if user is a tech/manager and get their current clock status
    const tech = await prisma.tech.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        shopId: true,
        role: true,
        available: true,
      },
    });

    if (!tech) {
      if (auth.role === 'shop' || auth.role === 'admin' || auth.role === 'superadmin') {
        return NextResponse.json({
          applicable: false,
          isClockedIn: false,
          reason: 'Owners do not clock in',
        });
      }
      return NextResponse.json({ error: 'Tech not found' }, { status: 404 });
    }

    const now = new Date();
    await closeStaleOpenPunches({ techId: userId }, now);

    // Check for active time entry (not clocked out)
    const activeEntry = await prisma.timeEntry.findFirst({
      where: {
        techId: userId,
        clockOut: null,
      },
      orderBy: {
        clockIn: 'desc',
      },
    });

    const isClockedIn = !!activeEntry && openPunchLive(activeEntry.clockIn, now);

    return NextResponse.json({
      isClockedIn,
      applicable: true,
      currentEntry: isClockedIn && activeEntry ? {
        id: activeEntry.id,
        clockIn: activeEntry.clockIn,
        breakStart: activeEntry.breakStart,
        breakEnd: activeEntry.breakEnd,
        location: activeEntry.location,
        notes: activeEntry.notes,
      } : null,
      tech: {
        id: tech.id,
        name: `${tech.firstName} ${tech.lastName}`,
        role: tech.role,
        available: tech.available,
      },
    });

  } catch (error) {
    console.error('Timeclock status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}