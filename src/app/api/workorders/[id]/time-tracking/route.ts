import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import logger from '@/lib/logger';

/**
 * Work Order Time Tracking API
 * 
 * This endpoint manages time tracking SPECIFIC TO A WORK ORDER/JOB
 * Different from: /api/time-tracking (hourly wage/payroll timesheet)
 * 
 * Purpose:
 * - Track actual time spent on individual jobs
 * - Calculate tech turn-over rate
 * - Track job profitability and tech performance
 * - Know which technician performed specific work
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  let id: string = '';
  try {
    const resolved = await params;
    id = resolved.id;

    // Verify work order exists and user has access
    const workOrder = await prisma.workOrder.findUnique({
      where: { id },
      select: { id: true, shopId: true, customerId: true },
    });

    if (!workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }

    // Authorization check
    const authorized =
      auth.role === 'superadmin' ||
      (auth.role === 'shop' && workOrder.shopId === auth.id) ||
      ((auth.role === 'tech' || auth.role === 'manager') && workOrder.shopId === auth.shopId) ||
      (auth.role === 'customer' && workOrder.customerId === auth.id);

    if (!authorized) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get all time entries for this work order
    const timeEntries = await prisma.workOrderTimeEntry.findMany({
      where: { workOrderId: id },
      include: {
        tech: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { clockIn: 'desc' },
    });

    // Calculate totals
    const totalHoursSpent = timeEntries
      .filter(e => e.hoursSpent !== null)
      .reduce((sum, e) => sum + (e.hoursSpent || 0), 0);

    const activeEntries = timeEntries.filter(e => !e.clockOut);

    return NextResponse.json({
      success: true,
      workOrderId: id,
      timeEntries,
      totals: {
        totalHoursSpent: parseFloat(totalHoursSpent.toFixed(2)),
        entriesCount: timeEntries.length,
        activeEntriesCount: activeEntries.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching work order time entries', { error: error instanceof Error ? error.message : String(error), workOrderId: id });
    return NextResponse.json({ error: 'Failed to fetch time entries' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  let id: string = '';
  try {
    const resolved = await params;
    id = resolved.id;
    const { action, techId, notes } = await request.json();

    if (!action || !techId) {
      return NextResponse.json(
        { error: 'Missing required fields: action, techId' },
        { status: 400 }
      );
    }

    // Verify work order exists
    const workOrder = await prisma.workOrder.findUnique({
      where: { id },
      select: { id: true, shopId: true, assignedTechId: true },
    });

    if (!workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }

    // Authorization check - only shop staff can manage job time tracking
    if (auth.role !== 'superadmin' && auth.role !== 'shop' && auth.role !== 'manager' && auth.role !== 'tech') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const shopId = auth.role === 'shop' ? auth.id : (auth.shopId || undefined);
    if (!shopId || (auth.role !== 'superadmin' && shopId !== workOrder.shopId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (action === 'clock-in') {
      // Check if already clocked in on this job
      const existingEntry = await prisma.workOrderTimeEntry.findFirst({
        where: {
          workOrderId: id,
          techId,
          clockOut: null,
        },
      });

      if (existingEntry) {
        return NextResponse.json(
          { error: 'Tech is already clocked in on this work order' },
          { status: 400 }
        );
      }

      // Create new work order time entry
      const entry = await prisma.workOrderTimeEntry.create({
        data: {
          workOrderId: id,
          techId,
          shopId: workOrder.shopId,
          clockIn: new Date(),
          notes: notes || null,
          status: 'active',
        },
        include: {
          tech: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Clocked in to work order',
        entry,
      });
    } else if (action === 'clock-out') {
      // Find active time entry
      const activeEntry = await prisma.workOrderTimeEntry.findFirst({
        where: {
          workOrderId: id,
          techId,
          clockOut: null,
        },
      });

      if (!activeEntry) {
        return NextResponse.json(
          { error: 'No active clock-in found for this tech on this work order' },
          { status: 400 }
        );
      }

      const clockOut = new Date();
      const hoursSpent = (clockOut.getTime() - activeEntry.clockIn.getTime()) / (1000 * 60 * 60);

      // Update entry with clock out
      const updatedEntry = await prisma.workOrderTimeEntry.update({
        where: { id: activeEntry.id },
        data: {
          clockOut,
          hoursSpent: parseFloat(hoursSpent.toFixed(2)),
          status: 'completed',
        },
        include: {
          tech: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Clocked out from work order',
        entry: updatedEntry,
      });
    } else if (action === 'pause') {
      // Pause tracking (for breaks during a job)
      const activeEntry = await prisma.workOrderTimeEntry.findFirst({
        where: {
          workOrderId: id,
          techId,
          clockOut: null,
          status: 'active',
        },
      });

      if (!activeEntry) {
        return NextResponse.json({ error: 'No active clock-in found' }, { status: 400 });
      }

      const updated = await prisma.workOrderTimeEntry.update({
        where: { id: activeEntry.id },
        data: { status: 'paused' },
      });

      return NextResponse.json({
        success: true,
        message: 'Job tracking paused',
        entry: updated,
      });
    } else if (action === 'resume') {
      // Resume tracking
      const pausedEntry = await prisma.workOrderTimeEntry.findFirst({
        where: {
          workOrderId: id,
          techId,
          clockOut: null,
          status: 'paused',
        },
      });

      if (!pausedEntry) {
        return NextResponse.json({ error: 'No paused clock-in found' }, { status: 400 });
      }

      const updated = await prisma.workOrderTimeEntry.update({
        where: { id: pausedEntry.id },
        data: { status: 'active' },
      });

      return NextResponse.json({
        success: true,
        message: 'Job tracking resumed',
        entry: updated,
      });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    logger.error('Error managing work order time entry', { error: error instanceof Error ? error.message : String(error), workOrderId: id });
    return NextResponse.json({ error: 'Failed to update time entry' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  let id: string = '';
  try {
    const resolved = await params;
    id = resolved.id;
    const { entryId, notes } = await request.json();

    if (!entryId) {
      return NextResponse.json({ error: 'entryId required' }, { status: 400 });
    }

    // Verify work order exists and user has access
    const workOrder = await prisma.workOrder.findUnique({
      where: { id },
      select: { shopId: true },
    });

    if (!workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }

    // Authorization
    if (auth.role !== 'superadmin' && (auth.role === 'shop' ? auth.id !== workOrder.shopId : auth.shopId !== workOrder.shopId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Update notes
    const updated = await prisma.workOrderTimeEntry.update({
      where: { id: entryId },
      data: { notes: notes || null },
    });

    return NextResponse.json({
      success: true,
      message: 'Entry updated',
      entry: updated,
    });
  } catch (error) {
    logger.error('Error updating work order time entry', { error: error instanceof Error ? error.message : String(error), workOrderId: id });
    return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 });
  }
}
