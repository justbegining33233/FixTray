import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

/**
 * Get pending DVI approvals
 */
export async function getPendingApprovals(shopId?: string) {
  try {
    const approvals = await prisma.dviApproval.findMany({
      where: {
        approvalStatus: 'pending',
        ...(shopId && { shopId }),
      },
      include: {
        vehicle: true,
        shop: { select: { id: true, shopName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    logger.info('Retrieved pending DVI approvals', { count: approvals.length, shopId });
    return approvals;
  } catch (error) {
    logger.error('Error getting pending approvals', { error });
    throw error;
  }
}

/**
 * Check if vehicle can be used (DVI approved)
 */
export async function isVehicleApprovedForUse(vehicleId: string): Promise<boolean> {
  try {
    const latestApproval = await prisma.dviApproval.findFirst({
      where: { vehicleId, approvalStatus: 'approved' },
      orderBy: { approvedAt: 'desc' },
    });

    if (!latestApproval) {
      logger.warn('No approved DVI found for vehicle', { vehicleId });
      return false;
    }

    // Check if approval is expired
    if (latestApproval.nextInspectionDue && new Date() > latestApproval.nextInspectionDue) {
      logger.warn('DVI approval expired for vehicle', { vehicleId });
      return false;
    }

    logger.debug('Vehicle DVI check passed', { vehicleId });
    return true;
  } catch (error) {
    logger.error('Error checking vehicle approval status', { vehicleId, error });
    throw error;
  }
}

/**
 * Get approval history for a vehicle
 */
export async function getVehicleApprovalHistory(vehicleId: string) {
  try {
    const history = await prisma.dviApproval.findMany({
      where: { vehicleId },
      include: {
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { approvedAt: 'desc' },
    });

    logger.info('Retrieved vehicle approval history', { vehicleId, count: history.length });
    return history;
  } catch (error) {
    logger.error('Error getting vehicle approval history', { vehicleId, error });
    throw error;
  }
}

/**
 * Get DVI statistics
 */
export async function getDVIStats(shopId: string) {
  try {
    const [totalApprovals, pendingApprovals, approvedApprovals, rejectedApprovals] = await Promise.all([
      prisma.dviApproval.count({ where: { shopId } }),
      prisma.dviApproval.count({ where: { shopId, approvalStatus: 'pending' } }),
      prisma.dviApproval.count({ where: { shopId, approvalStatus: 'approved' } }),
      prisma.dviApproval.count({ where: { shopId, approvalStatus: 'rejected' } }),
    ]);

    const stats = {
      totalApprovals,
      pendingApprovals,
      approvedApprovals,
      rejectedApprovals,
      approvalRate: totalApprovals > 0 ? ((approvedApprovals / totalApprovals) * 100).toFixed(1) : '0',
    };

    logger.info('Retrieved DVI statistics', { shopId, ...stats });
    return stats;
  } catch (error) {
    logger.error('Error getting DVI statistics', { shopId, error });
    throw error;
  }
}

/**
 * Get vehicles needing DVI renewal
 */
export async function getVehiclesNeedingDVIRenewal(shopId: string, daysThreshold = 30) {
  try {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    const vehicles = await prisma.vehicle.findMany({
      where: {
        shopId,
        dviApprovals: {
          some: {
            approvalStatus: 'approved',
            nextInspectionDue: {
              lte: thresholdDate,
              gt: new Date(),
            },
          },
        },
      },
      include: {
        dviApprovals: {
          where: { approvalStatus: 'approved' },
          orderBy: { approvedAt: 'desc' },
          take: 1,
        },
      },
    });

    logger.info('Retrieved vehicles needing DVI renewal', { shopId, count: vehicles.length, daysThreshold });
    return vehicles;
  } catch (error) {
    logger.error('Error getting vehicles needing DVI renewal', { shopId, error });
    throw error;
  }
}

/**
 * Get vehicles with expired DVI
 */
export async function getVehiclesWithExpiredDVI(shopId: string) {
  try {
    const now = new Date();

    const vehicles = await prisma.vehicle.findMany({
      where: {
        shopId,
        dviApprovals: {
          some: {
            approvalStatus: 'approved',
            nextInspectionDue: { lt: now },
          },
        },
      },
      include: {
        dviApprovals: {
          where: { approvalStatus: 'approved' },
          orderBy: { approvedAt: 'desc' },
          take: 1,
        },
      },
    });

    logger.info('Retrieved vehicles with expired DVI', { shopId, count: vehicles.length });
    return vehicles;
  } catch (error) {
    logger.error('Error getting vehicles with expired DVI', { shopId, error });
    throw error;
  }
}

/**
 * Reject all pending approvals for a vehicle (after maintenance)
 */
export async function rejectVehicleApprovals(vehicleId: string, reason: string) {
  try {
    const result = await prisma.dviApproval.updateMany({
      where: {
        vehicleId,
        approvalStatus: 'pending',
      },
      data: {
        approvalStatus: 'rejected',
        notes: reason,
      },
    });

    logger.info('Vehicle approvals rejected', { vehicleId, count: result.count, reason });
    return result;
  } catch (error) {
    logger.error('Error rejecting vehicle approvals', { vehicleId, error });
    throw error;
  }
}

/**
 * Get ready-to-use vehicles (approved DVI, not expired)
 */
export async function getReadyToUseVehicles(shopId: string) {
  try {
    const now = new Date();

    const vehicles = await prisma.vehicle.findMany({
      where: {
        shopId,
        dviApprovals: {
          some: {
            approvalStatus: 'approved',
            OR: [
              { nextInspectionDue: null },
              { nextInspectionDue: { gt: now } },
            ],
          },
        },
      },
      include: {
        dviApprovals: {
          where: { approvalStatus: 'approved' },
          orderBy: { approvedAt: 'desc' },
          take: 1,
        },
      },
    });

    logger.info('Retrieved ready-to-use vehicles', { shopId, count: vehicles.length });
    return vehicles;
  } catch (error) {
    logger.error('Error getting ready-to-use vehicles', { shopId, error });
    throw error;
  }
}
