import { NextRequest, NextResponse } from 'next/server';
import { ownerClockEmail, resolveActorClockTech } from '@/lib/ownerClock';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';


// Helper function to calculate distance between two GPS coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// GET - Get time entries for a tech/manager
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

    // Only shop owners, managers, techs, and admins can view time entries
    if (!['shop', 'manager', 'tech', 'admin', 'superadmin'].includes(decoded.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const techId = searchParams.get('techId');
    const shopId = searchParams.get('shopId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build query
    const where: any = {};
    
    if (techId) {
      // Techs can only view their own entries
      if (decoded.role === 'tech' && decoded.id !== techId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      where.techId = techId;
      if (decoded.role === 'shop' && techId === decoded.id) {
        const owner = await prisma.tech.findUnique({
          where: { email: ownerClockEmail(decoded.id) },
          select: { id: true },
        });
        if (owner) where.techId = owner.id;
      }
    } else if (shopId) {
      // Shops can only view their own shop's entries
      if (decoded.role === 'shop' && decoded.id !== shopId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (decoded.role === 'manager' && decoded.shopId !== shopId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      where.shopId = shopId;
    } else {
      return NextResponse.json({ error: 'Either techId or shopId required' }, { status: 400 });
    }

    if (startDate && endDate) {
      where.clockIn = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const timeEntries = await prisma.timeEntry.findMany({
      where,
      include: {
        tech: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            hourlyRate: true,
          },
        },
      },
      orderBy: { clockIn: 'desc' },
    });

    return NextResponse.json({ timeEntries });
  } catch (error) {
    console.error('Error fetching time entries:', error);
    return NextResponse.json({ error: 'Failed to fetch time entries' }, { status: 500 });
  }
}

// POST - Clock in or clock out
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { action, shopId, notes, location, photo } = body;
    let { techId } = body;

    if (!action || !techId || !shopId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (decoded.role === 'shop' || decoded.role === 'tech') {
      const resolved = await resolveActorClockTech({
        role: decoded.role,
        actorId: decoded.id,
        requestedTechId: techId,
        shopId,
      });
      if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 });
      techId = resolved.techId;
    }

    if (action === 'clock-in') {
      // Check if already clocked in
      const existingEntry = await prisma.timeEntry.findFirst({
        where: {
          techId,
          clockOut: null,
        },
      });

      if (existingEntry) {
        return NextResponse.json({ 
          error: 'Already clocked in', 
          entry: existingEntry 
        }, { status: 400 });
      }

      // Verify GPS location if enabled
      if (location) {
        const shopSettings = await prisma.shopSettings.findFirst({
          where: { shopId },
        });

        if (shopSettings?.gpsVerificationEnabled && shopSettings.shopLatitude && shopSettings.shopLongitude) {
          const distance = calculateDistance(
            location.lat,
            location.lon,
            shopSettings.shopLatitude,
            shopSettings.shopLongitude
          );

          const radiusMeters = shopSettings.gpsRadiusMeters || 100;
          if (distance > radiusMeters) {
            return NextResponse.json({ 
              error: `You must be within ${radiusMeters}m of the shop to clock in (currently ${Math.round(distance)}m away)` 
            }, { status: 400 });
          }
        }
      }

      // Create new time entry
      const timeEntry = await prisma.timeEntry.create({
        data: {
          techId,
          shopId,
          clockIn: new Date(),
          notes,
          location,
          clockInPhoto: photo,
        },
        include: {
          tech: {
            select: {
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Clocked in successfully',
        timeEntry 
      });
    } else if (action === 'clock-out') {
      // Find the active time entry
      const activeEntry = await prisma.timeEntry.findFirst({
        where: {
          techId,
          clockOut: null,
        },
      });

      if (!activeEntry) {
        return NextResponse.json({ error: 'No active clock-in found' }, { status: 400 });
      }

      const clockOut = new Date();
      let workDuration = clockOut.getTime() - activeEntry.clockIn.getTime();

      // Subtract break time if any
      if (activeEntry.breakStart && activeEntry.breakEnd) {
        const breakDuration = new Date(activeEntry.breakEnd).getTime() - new Date(activeEntry.breakStart).getTime();
        workDuration -= breakDuration;
      }

      const hoursWorked = workDuration / (1000 * 60 * 60);

      // Update time entry with clock out
      const updatedEntry = await prisma.timeEntry.update({
        where: { id: activeEntry.id },
        data: {
          clockOut,
          hoursWorked: Math.round(hoursWorked * 100) / 100,
          notes: notes || activeEntry.notes,
          clockOutPhoto: photo,
        },
        include: {
          tech: {
            select: {
              firstName: true,
              lastName: true,
              role: true,
              hourlyRate: true,
            },
          },
        },
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Clocked out successfully',
        timeEntry: updatedEntry,
        hoursWorked: updatedEntry.hoursWorked,
      });
    } else if (action === 'break-start') {
      const activeEntry = await prisma.timeEntry.findFirst({
        where: {
          techId,
          clockOut: null,
        },
      });

      if (!activeEntry) {
        return NextResponse.json({ error: 'No active clock-in found' }, { status: 400 });
      }

      // Append a break record into the JSON `breaks` field (supports multiple breaks)
      const _existingBreaks = (activeEntry as any).breaks || [];
      const newBreak = { start: new Date().toISOString(), end: null, durationMinutes: null, type: 'break' };

      const updatedEntry = await prisma.timeEntry.update({
        where: { id: activeEntry.id },
        data: {
          breaks: { push: newBreak },
          // maintain backward-compatible single-break fields for older UI
          breakStart: new Date(),
          breakEnd: null,
        },
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Break started',
        timeEntry: updatedEntry,
      });
    } else if (action === 'break-end') {
      const activeEntry = await prisma.timeEntry.findFirst({
        where: {
          techId,
          clockOut: null,
        },
      });

      if (!activeEntry) {
        return NextResponse.json({ error: 'No active clock-in found' }, { status: 400 });
      }

      // Find last break without an end
      const breaksArray: any[] = (activeEntry as any).breaks || [];
      const lastIdx = breaksArray.length - 1;
      if (lastIdx < 0 || breaksArray[lastIdx].end) {
        // fallback to legacy single breakStart
        if (!activeEntry.breakStart) {
          return NextResponse.json({ error: 'No break in progress' }, { status: 400 });
        }
        const breakEndLegacy = new Date();
        const breakDurationLegacy = (breakEndLegacy.getTime() - new Date(activeEntry.breakStart).getTime()) / (1000 * 60); // minutes

        const updatedEntryLegacy = await prisma.timeEntry.update({
          where: { id: activeEntry.id },
          data: {
            breakEnd: breakEndLegacy,
            breakDuration: Math.round(breakDurationLegacy * 100) / 100,
            // also push into JSON breaks for consistency
            breaks: { push: { start: activeEntry.breakStart.toISOString(), end: breakEndLegacy.toISOString(), durationMinutes: Math.round(breakDurationLegacy * 100) / 100, type: 'break' } },
          },
        });

        return NextResponse.json({ success: true, message: 'Break ended', timeEntry: updatedEntryLegacy, breakDuration: updatedEntryLegacy.breakDuration });
      }

      const breakEnd = new Date();
      const started = new Date(breaksArray[lastIdx].start);
      const breakDuration = (breakEnd.getTime() - started.getTime()) / (1000 * 60); // minutes

      // update the breaks array entry and cumulative breakDuration
      breaksArray[lastIdx].end = breakEnd.toISOString();
      breaksArray[lastIdx].durationMinutes = Math.round(breakDuration * 100) / 100;

      // compute total breakDuration (minutes)
      const totalBreakMinutes = breaksArray.reduce((acc, b) => acc + (b.durationMinutes || 0), 0);

      const updatedEntry = await prisma.timeEntry.update({
        where: { id: activeEntry.id },
        data: {
          breaks: breaksArray,
          breakEnd: breakEnd,
          breakDuration: Math.round(totalBreakMinutes * 100) / 100,
        },
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Break ended',
        timeEntry: updatedEntry,
        breakDuration: updatedEntry.breakDuration,
      });
    } else if (action === 'manual-entry') {
      // Create manual / PTO or retroactive time entry (manager or tech)
      const { clockIn: ci, clockOut: co, notes: manualNotes, isPto } = await request.json();
      if (!ci || !co) return NextResponse.json({ error: 'clockIn and clockOut required for manual entries' }, { status: 400 });

      const clockIn = new Date(ci);
      const clockOut = new Date(co);
      const ms = clockOut.getTime() - clockIn.getTime();
      const hoursWorked = Math.round((ms / (1000 * 60 * 60)) * 100) / 100;

      const timeEntry = await prisma.timeEntry.create({
        data: {
          techId,
          shopId,
          clockIn,
          clockOut,
          isPto: !!isPto,
          hoursWorked,
          notes: manualNotes || (isPto ? 'PTO' : ''),
        },
      });

      return NextResponse.json({ success: true, timeEntry });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error with time tracking:', error);
    return NextResponse.json({ error: 'Time tracking operation failed' }, { status: 500 });
  }
}
