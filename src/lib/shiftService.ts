import prisma from '@/lib/prisma';
import logger from '@/lib/logger';

/**
 * Shift Scheduling Service
 * Handles business logic for shift management and swap requests
 */

export interface ShiftStats {
  totalShifts: number;
  confirmedShifts: number;
  completedShifts: number;
  averageTechsPerDay: number;
  openSwapRequests: number;
  approvedSwapRequests: number;
}

/**
 * Get shift statistics for a shop
 */
export async function getShiftStats(shopId: string): Promise<ShiftStats> {
  try {
    const shifts = await prisma.shift.findMany({
      where: { shopId },
      select: { status: true },
    });

    const swaps = await prisma.shiftSwapRequest.findMany({
      where: { shopId },
      select: { status: true },
    });

    const stats: ShiftStats = {
      totalShifts: shifts.length,
      confirmedShifts: shifts.filter(s => s.status === 'confirmed').length,
      completedShifts: shifts.filter(s => s.status === 'completed').length,
      averageTechsPerDay: 0,
      openSwapRequests: swaps.filter(s => s.status === 'pending').length,
      approvedSwapRequests: swaps.filter(s => s.status === 'approved').length,
    };

    // Calculate average techs per day
    const groupedByDate = shifts.reduce((acc, shift) => {
      const date = shift.status; // placeholder for logic
      return acc;
    }, {} as Record<string, number>);

    return stats;
  } catch (error) {
    logger.error('Failed to get shift stats', error);
    throw error;
  }
}

/**
 * Get shifts for a specific date range and tech
 */
export async function getShiftsForTech(
  techId: string,
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  try {
    return await prisma.shift.findMany({
      where: {
        techId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        swapRequests: true,
      },
      orderBy: { date: 'asc' },
    });
  } catch (error) {
    logger.error('Failed to get shifts for tech', error);
    throw error;
  }
}

/**
 * Check for shift conflicts
 */
export async function hasShiftConflict(
  techId: string,
  date: Date,
  excludeShiftId?: string
): Promise<boolean> {
  try {
    const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dateEnd = new Date(dateStart);
    dateEnd.setDate(dateEnd.getDate() + 1);

    const conflict = await prisma.shift.findFirst({
      where: {
        techId,
        date: {
          gte: dateStart,
          lt: dateEnd,
        },
        status: { not: 'cancelled' },
        ...(excludeShiftId && { id: { not: excludeShiftId } }),
      },
    });

    return !!conflict;
  } catch (error) {
    logger.error('Failed to check shift conflict', error);
    throw error;
  }
}

/**
 * Get pending swap requests for a shift
 */
export async function getPendingSwapRequests(shiftId: string): Promise<any[]> {
  try {
    return await prisma.shiftSwapRequest.findMany({
      where: {
        shiftId,
        status: 'pending',
      },
      include: {
        requester: true,
        target: true,
      },
    });
  } catch (error) {
    logger.error('Failed to get pending swap requests', error);
    throw error;
  }
}

/**
 * Get swap requests for a tech (as requester)
 */
export async function getSwapRequestsForTech(
  techId: string,
  status?: string
): Promise<any[]> {
  try {
    const where: any = { requesterId: techId };
    if (status) where.status = status;

    return await prisma.shiftSwapRequest.findMany({
      where,
      include: {
        shift: { include: { tech: true } },
        target: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    logger.error('Failed to get swap requests for tech', error);
    throw error;
  }
}

/**
 * Calculate total hours worked in a period
 */
export async function calculateHoursWorked(
  techId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  try {
    const shifts = await prisma.shift.findMany({
      where: {
        techId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        status: 'completed',
      },
      select: {
        startTime: true,
        endTime: true,
        lateMinutes: true,
        earlyDepartureMins: true,
      },
    });

    let totalHours = 0;
    shifts.forEach(shift => {
      const [startHour, startMin] = shift.startTime.split(':').map(Number);
      const [endHour, endMin] = shift.endTime.split(':').map(Number);
      
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      const scheduledMinutes = endMinutes - startMinutes;
      const actualMinutes = scheduledMinutes - shift.lateMinutes - shift.earlyDepartureMins;
      
      totalHours += actualMinutes / 60;
    });

    return Math.round(totalHours * 100) / 100; // Round to 2 decimals
  } catch (error) {
    logger.error('Failed to calculate hours worked', error);
    throw error;
  }
}

/**
 * Get shift schedule for manager dashboard
 */
export async function getShiftSchedule(
  shopId: string,
  startDate: Date,
  endDate: Date
): Promise<any> {
  try {
    const shifts = await prisma.shift.findMany({
      where: {
        shopId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        tech: { select: { id: true, firstName: true, lastName: true } },
        swapRequests: { where: { status: 'pending' } },
      },
      orderBy: { date: 'asc' },
    });

    // Group by date
    const schedule = shifts.reduce((acc, shift) => {
      const dateStr = shift.date.toISOString().split('T')[0];
      if (!acc[dateStr]) {
        acc[dateStr] = [];
      }
      acc[dateStr].push(shift);
      return acc;
    }, {} as Record<string, any[]>);

    return schedule;
  } catch (error) {
    logger.error('Failed to get shift schedule', error);
    throw error;
  }
}

/**
 * Cancel all shifts for a tech on a date
 */
export async function cancelShiftsForDate(
  techId: string,
  date: Date
): Promise<number> {
  try {
    const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dateEnd = new Date(dateStart);
    dateEnd.setDate(dateEnd.getDate() + 1);

    const result = await prisma.shift.updateMany({
      where: {
        techId,
        date: {
          gte: dateStart,
          lt: dateEnd,
        },
        status: { not: 'completed' },
      },
      data: { status: 'cancelled' },
    });

    logger.info('Shifts cancelled', {
      techId,
      date,
      count: result.count,
    });

    return result.count;
  } catch (error) {
    logger.error('Failed to cancel shifts', error);
    throw error;
  }
}
