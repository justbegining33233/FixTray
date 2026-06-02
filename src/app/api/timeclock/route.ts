import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

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
      return NextResponse.json({ error: 'Tech not found' }, { status: 404 });
    }

    // Enforce ownership: caller must be this tech, belong to the same shop, or be admin
    if (auth.id !== userId && (auth.role !== 'superadmin')) {
      const callerShopId = auth.role === 'shop' ? auth.id : auth.shopId;
      if (!callerShopId || callerShopId !== tech.shopId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

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

    const isClockedIn = !!activeEntry;

    return NextResponse.json({
      isClockedIn,
      currentEntry: activeEntry ? {
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

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { userId, action, location, notes, photo } = body;

    if (!userId || !action) {
      return NextResponse.json({ error: 'userId and action required' }, { status: 400 });
    }

    // Verify the user is a tech/manager
    const tech = await prisma.tech.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        shopId: true,
        role: true,
      },
    });

    if (!tech) {
      return NextResponse.json({ error: 'Tech not found' }, { status: 404 });
    }

    // Enforce ownership: caller must be this tech, belong to the same shop, or be admin
    if (auth.id !== userId && (auth.role !== 'superadmin')) {
      const callerShopId = auth.role === 'shop' ? auth.id : auth.shopId;
      if (!callerShopId || callerShopId !== tech.shopId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Check current status
    const activeEntry = await prisma.timeEntry.findFirst({
      where: {
        techId: userId,
        clockOut: null,
      },
      orderBy: {
        clockIn: 'desc',
      },
    });

    if (action === 'clock-in') {
      if (activeEntry) {
        return NextResponse.json({ error: 'Already clocked in' }, { status: 400 });
      }

      // Create new time entry
      const newEntry = await prisma.timeEntry.create({
        data: {
          techId: userId,
          shopId: tech.shopId,
          clockIn: new Date(),
          location: location || null,
          notes: notes || null,
          clockInPhoto: photo || null,
        },
      });

      // Update tech availability
      await prisma.tech.update({
        where: { id: userId },
        data: { available: true },
      });

      return NextResponse.json({
        success: true,
        message: 'Clocked in successfully',
        entry: newEntry,
      });

    } else if (action === 'clock-out') {
      if (!activeEntry) {
        return NextResponse.json({ error: 'Not currently clocked in' }, { status: 400 });
      }

      // Update the time entry
      const updatedEntry = await prisma.timeEntry.update({
        where: { id: activeEntry.id },
        data: {
          clockOut: new Date(),
          clockOutPhoto: photo || null,
          hoursWorked: Math.round(
            (new Date().getTime() - activeEntry.clockIn.getTime()) / (1000 * 60 * 60) * 100
          ) / 100, // Hours with 2 decimal places
        },
      });

      // Update tech availability
      await prisma.tech.update({
        where: { id: userId },
        data: { available: false },
      });

      return NextResponse.json({
        success: true,
        message: 'Clocked out successfully',
        entry: updatedEntry,
      });

    } else if (action === 'break-start') {
      if (!activeEntry) {
        return NextResponse.json({ error: 'Not currently clocked in' }, { status: 400 });
      }

      if (activeEntry.breakStart && !activeEntry.breakEnd) {
        return NextResponse.json({ error: 'Already on break' }, { status: 400 });
      }

      const updatedEntry = await prisma.timeEntry.update({
        where: { id: activeEntry.id },
        data: {
          breakStart: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Break started',
        entry: updatedEntry,
      });

    } else if (action === 'break-end') {
      if (!activeEntry || !activeEntry.breakStart || activeEntry.breakEnd) {
        return NextResponse.json({ error: 'Not currently on break' }, { status: 400 });
      }

      const breakDuration = Math.round(
        (new Date().getTime() - activeEntry.breakStart.getTime()) / (1000 * 60) * 100
      ) / 100; // Minutes with 2 decimal places

      const updatedEntry = await prisma.timeEntry.update({
        where: { id: activeEntry.id },
        data: {
          breakEnd: new Date(),
          breakDuration: breakDuration,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Break ended',
        entry: updatedEntry,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Timeclock action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}