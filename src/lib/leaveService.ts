import prisma from '@/lib/prisma';
import logger from '@/lib/logger';

/**
 * Leave/PTO Management Service
 * Handles business logic for leave requests and PTO accrual
 */

export interface LeaveStats {
  totalRequests: number;
  approvedRequests: number;
  pendingRequests: number;
  deniedRequests: number;
  totalDaysRequested: number;
  totalDaysApproved: number;
}

// PTO accrual rate: 1.67 days per month (20 days per year)
const PTO_ACCRUAL_PER_MONTH = 1.67;
const MAX_PTO_CARRYOVER = 10; // Max days that can be carried over
const MAX_CONSECUTIVE_DAYS = 10; // Max consecutive leave days

/**
 * Get leave statistics for a shop
 */
export async function getLeaveStats(shopId: string): Promise<LeaveStats> {
  try {
    const requests = await prisma.leaveRequest.findMany({
      where: { shopId },
    });

    const stats: LeaveStats = {
      totalRequests: requests.length,
      approvedRequests: requests.filter(r => r.status === 'approved').length,
      pendingRequests: requests.filter(r => r.status === 'pending').length,
      deniedRequests: requests.filter(r => r.status === 'denied').length,
      totalDaysRequested: 0,
      totalDaysApproved: 0,
    };

    requests.forEach(req => {
      const days = Math.ceil((req.endDate.getTime() - req.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      stats.totalDaysRequested += days;
      if (req.status === 'approved') {
        stats.totalDaysApproved += days;
      }
    });

    return stats;
  } catch (error) {
    logger.error('Failed to get leave stats', error);
    throw error;
  }
}

/**
 * Calculate tech's available PTO for current year
 */
export async function getAvailablePTO(techId: string, year: number = new Date().getFullYear()): Promise<number> {
  try {
    const tech = await prisma.tech.findUnique({
      where: { id: techId },
      select: { createdAt: true },
    });

    if (!tech) {
      throw new Error('Tech not found');
    }

    // Calculate months of employment in current year
    const hireDate = new Date(tech.createdAt);
    const yearsEmployed = (new Date().getFullYear() - hireDate.getFullYear());
    
    let annualPTO = 20; // Default 20 days
    if (yearsEmployed >= 5) annualPTO = 25;
    if (yearsEmployed >= 10) annualPTO = 30;

    // Get approved leave for current year
    const currentYearStart = new Date(year, 0, 1);
    const currentYearEnd = new Date(year, 11, 31);

    const approvedLeave = await prisma.leaveRequest.findMany({
      where: {
        techId,
        status: 'approved',
        startDate: { gte: currentYearStart },
        endDate: { lte: currentYearEnd },
      },
    });

    let usedDays = 0;
    approvedLeave.forEach(leave => {
      const days = Math.ceil((leave.endDate.getTime() - leave.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      usedDays += days;
    });

    return Math.max(0, annualPTO - usedDays);
  } catch (error) {
    logger.error('Failed to get available PTO', error);
    throw error;
  }
}

/**
 * Validate leave request doesn't exceed limits
 */
export async function validateLeaveRequest(
  techId: string,
  startDate: Date,
  endDate: Date,
  leaveType: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Calculate days requested
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Check max consecutive days (vacation only)
    if (leaveType === 'vacation' && days > MAX_CONSECUTIVE_DAYS) {
      return {
        valid: false,
        error: `Maximum ${MAX_CONSECUTIVE_DAYS} consecutive vacation days allowed`,
      };
    }

    // Check available PTO
    const available = await getAvailablePTO(techId);
    if (days > available) {
      return {
        valid: false,
        error: `Only ${available} PTO days available`,
      };
    }

    // Check for overlapping approved leave
    const overlapping = await prisma.leaveRequest.findFirst({
      where: {
        techId,
        status: 'approved',
        OR: [
          {
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        ],
      },
    });

    if (overlapping) {
      return {
        valid: false,
        error: 'Overlapping approved leave found',
      };
    }

    return { valid: true };
  } catch (error) {
    logger.error('Failed to validate leave request', error);
    throw error;
  }
}

/**
 * Get tech's leave balance for current year
 */
export async function getLeaveBalance(techId: string, year: number = new Date().getFullYear()) {
  try {
    const available = await getAvailablePTO(techId, year);
    
    const currentYearStart = new Date(year, 0, 1);
    const currentYearEnd = new Date(year, 11, 31);

    const allLeave = await prisma.leaveRequest.findMany({
      where: {
        techId,
        status: 'approved',
        startDate: { gte: currentYearStart },
        endDate: { lte: currentYearEnd },
      },
    });

    const leaveByType: Record<string, number> = {
      vacation: 0,
      sick: 0,
      personal: 0,
      bereavement: 0,
      parental: 0,
    };

    allLeave.forEach(leave => {
      const days = Math.ceil((leave.endDate.getTime() - leave.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      leaveByType[leave.leaveType] = (leaveByType[leave.leaveType] || 0) + days;
    });

    return {
      year,
      available,
      used: Object.values(leaveByType).reduce((a, b) => a + b, 0),
      byType: leaveByType,
    };
  } catch (error) {
    logger.error('Failed to get leave balance', error);
    throw error;
  }
}

/**
 * Get tech's upcoming leave
 */
export async function getUpcomingLeave(
  techId: string,
  days: number = 30
): Promise<any[]> {
  try {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return await prisma.leaveRequest.findMany({
      where: {
        techId,
        status: 'approved',
        startDate: { gte: today, lte: futureDate },
      },
      orderBy: { startDate: 'asc' },
    });
  } catch (error) {
    logger.error('Failed to get upcoming leave', error);
    throw error;
  }
}

/**
 * Get all pending leave requests for manager review
 */
export async function getPendingLeaveRequests(
  shopId: string
): Promise<any[]> {
  try {
    return await prisma.leaveRequest.findMany({
      where: {
        shopId,
        status: 'pending',
      },
      include: {
        tech: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    logger.error('Failed to get pending leave requests', error);
    throw error;
  }
}

/**
 * Get month-by-month leave forecast
 */
export async function getLeavesForecast(
  shopId: string,
  year: number = new Date().getFullYear()
): Promise<Record<string, any>> {
  try {
    const monthlyData: Record<string, any> = {};

    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);

      const leaves = await prisma.leaveRequest.findMany({
        where: {
          shopId,
          status: 'approved',
          OR: [
            {
              startDate: { lte: monthEnd },
              endDate: { gte: monthStart },
            },
          ],
        },
      });

      const monthName = monthStart.toLocaleString('en-US', { month: 'long' });
      monthlyData[monthName] = {
        count: leaves.length,
        techs: [...new Set(leaves.map(l => l.techId))].length,
      };
    }

    return monthlyData;
  } catch (error) {
    logger.error('Failed to get leave forecast', error);
    throw error;
  }
}
