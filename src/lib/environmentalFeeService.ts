import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

/**
 * Calculate total environmental fees for a work order
 */
export async function calculateEnvironmentalFees(shopId: string, serviceType?: string): Promise<number> {
  try {
    const fees = await prisma.environmentalFee.findMany({
      where: { shopId, active: true },
    });

    const total = fees.reduce((sum, fee) => {
      if (fee.unit === 'fixed') return sum + fee.feeAmount;
      if (fee.unit === 'per-job') return sum + fee.feeAmount;
      if (fee.unit === 'per-service' && serviceType) return sum + fee.feeAmount;
      return sum;
    }, 0);

    logger.info('Calculated environmental fees', { shopId, total });
    return total;
  } catch (error) {
    logger.error('Error calculating environmental fees', { shopId, error });
    throw error;
  }
}

/**
 * Get all active environmental fees
 */
export async function getActiveFees(shopId: string) {
  try {
    const fees = await prisma.environmentalFee.findMany({
      where: { shopId, active: true },
      orderBy: { name: 'asc' },
    });

    logger.info(`Retrieved ${fees.length} active fees for shop ${shopId}`);
    return fees;
  } catch (error) {
    logger.error('Error getting active fees', { shopId, error });
    throw error;
  }
}

/**
 * Apply environmental fees to work order
 */
export async function applyFeesToWorkOrder(workOrderId: string, shopId: string) {
  try {
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
    });

    if (!workOrder) {
      throw new Error(`Work order ${workOrderId} not found`);
    }

    const fees = await calculateEnvironmentalFees(shopId);

    logger.info('Applied environmental fees to work order', { workOrderId, fees });
    return fees;
  } catch (error) {
    logger.error('Error applying fees to work order', { workOrderId, error });
    throw error;
  }
}
