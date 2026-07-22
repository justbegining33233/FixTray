import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

/**
 * Get state inspection statistics for a shop
 */
export async function getInspectionStats(shopId: string) {
  try {
    const inspections = await prisma.stateInspection.findMany({
      where: { shopId },
    });

    const passed = inspections.filter(i => i.result === 'pass').length;
    const failed = inspections.filter(i => i.result === 'fail').length;
    const conditional = inspections.filter(i => i.result === 'conditional').length;

    logger.info(`Inspection stats retrieved for shop ${shopId}`, { passed, failed, conditional });

    return {
      total: inspections.length,
      passed,
      failed,
      conditional,
    };
  } catch (error) {
    logger.error('Error getting inspection stats', { shopId, error });
    throw error;
  }
}

/**
 * Get expired inspections (past due date)
 */
export async function getExpiredInspections(shopId: string) {
  try {
    const today = new Date();

    const expired = await prisma.stateInspection.findMany({
      where: {
        shopId,
        expiresAt: {
          lt: today,
        },
      },
    });

    logger.info(`Found ${expired.length} expired inspections for shop ${shopId}`);

    return expired;
  } catch (error) {
    logger.error('Error getting expired inspections', { shopId, error });
    throw error;
  }
}

/**
 * Get inspections due for renewal soon (within 30 days)
 */
export async function getDueForInspection(shopId: string, daysUntilDue: number = 30) {
  try {
    const today = new Date();
    const dueDate = new Date(today.getTime() + daysUntilDue * 24 * 60 * 60 * 1000);

    const dueSoon = await prisma.stateInspection.findMany({
      where: {
        shopId,
        expiresAt: {
          gte: today,
          lte: dueDate,
        },
      },
    });

    logger.info(`Found ${dueSoon.length} inspections due within ${daysUntilDue} days for shop ${shopId}`);

    return dueSoon;
  } catch (error) {
    logger.error('Error getting due inspections', { shopId, error });
    throw error;
  }
}

/**
 * Get all inspections for a specific VIN
 */
export async function getInspectionsByVIN(vin: string) {
  try {
    const inspections = await prisma.stateInspection.findMany({
      where: { vin },
      orderBy: { createdAt: 'desc' },
    });

    logger.info(`Retrieved ${inspections.length} inspections for VIN ${vin}`);

    return inspections;
  } catch (error) {
    logger.error('Error getting inspections by VIN', { vin, error });
    throw error;
  }
}

/**
 * Get compliance dashboard data
 */
export async function getComplianceDashboard(shopId: string) {
  try {
    const stats = await getInspectionStats(shopId);
    const expired = await getExpiredInspections(shopId);
    const dueSoon = await getDueForInspection(shopId);
    const allInspections = await prisma.stateInspection.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    logger.info('Generated compliance dashboard for shop', { shopId });

    return {
      stats,
      alerts: {
        expired: expired.length,
        dueSoon: dueSoon.length,
      },
      recentInspections: allInspections,
    };
  } catch (error) {
    logger.error('Error generating compliance dashboard', { shopId, error });
    throw error;
  }
}

/**
 * Generate compliance report for a shop
 */
export async function generateComplianceReport(shopId: string, startDate: Date, endDate: Date) {
  try {
    const inspections = await prisma.stateInspection.findMany({
      where: {
        shopId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const report = {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      totalInspections: inspections.length,
      byResult: {
        passed: inspections.filter(i => i.result === 'pass').length,
        failed: inspections.filter(i => i.result === 'fail').length,
        conditional: inspections.filter(i => i.result === 'conditional').length,
      },
      byType: {
        state: inspections.filter(i => i.inspectionType === 'state').length,
        emissions: inspections.filter(i => i.inspectionType === 'emissions').length,
        safety: inspections.filter(i => i.inspectionType === 'safety').length,
      },
      inspections,
    };

    logger.info('Generated compliance report for shop', { shopId });

    return report;
  } catch (error) {
    logger.error('Error generating compliance report', { shopId, error });
    throw error;
  }
}

/**
 * Calculate inspection expiration date based on result
 */
export function calculateExpirationDate(result: string): Date | null {
  if (result === 'pass') {
    // Pass expires in 1 year
    const expiration = new Date();
    expiration.setFullYear(expiration.getFullYear() + 1);
    return expiration;
  }
  // Fail and conditional don't have expiration
  return null;
}

/**
 * Validate inspection data
 */
export function validateInspectionData(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.vin) errors.push('VIN is required');
  if (!data.licensePlate) errors.push('License plate is required');
  if (!data.inspectionType) errors.push('Inspection type is required');
  if (!data.result) errors.push('Result is required');

  // Validate enums
  const validTypes = ['state', 'emissions', 'safety'];
  if (data.inspectionType && !validTypes.includes(data.inspectionType)) {
    errors.push('Invalid inspection type');
  }

  const validResults = ['pass', 'fail', 'conditional'];
  if (data.result && !validResults.includes(data.result)) {
    errors.push('Invalid result');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get days until inspection expires
 */
export function daysUntilExpiration(expiresAt: Date | null): number | string {
  if (!expiresAt) return 'N/A';

  const today = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysLeft = Math.ceil((expiresAt.getTime() - today.getTime()) / msPerDay);

  return Math.max(0, daysLeft);
}
