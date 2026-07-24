import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

/**
 * Get loaner vehicle statistics for a shop
 */
export async function getLoanerStats(shopId: string) {
  try {
    const vehicles = await prisma.loanerVehicle.findMany({
      where: { shopId },
    });

    const available = vehicles.filter(v => v.status === 'available').length;
    const checkedOut = vehicles.filter(v => v.status === 'checked-out').length;
    const maintenance = vehicles.filter(v => v.status === 'maintenance').length;

    logger.info(`Loaner stats retrieved for shop ${shopId}`, { available, checkedOut, maintenance });

    return {
      total: vehicles.length,
      available,
      checkedOut,
      maintenance,
    };
  } catch (error) {
    logger.error('Error getting loaner stats', { shopId, error });
    throw error;
  }
}

/**
 * Get list of available loaner vehicles for checkout
 */
export async function getAvailableLoaners(shopId: string) {
  try {
    const vehicles = await prisma.loanerVehicle.findMany({
      where: {
        shopId,
        status: 'available',
      },
    });

    logger.info(`Retrieved ${vehicles.length} available loaners for shop ${shopId}`);
    return vehicles;
  } catch (error) {
    logger.error('Error getting available loaners', { shopId, error });
    throw error;
  }
}

/**
 * Calculate late charges for a vehicle checkout
 */
export async function calculateLateCharges(
  vehicleId: string,
  expectedBackDate: Date,
  actualBackDate: Date,
  dailyRate: number = 50 // Default $50/day
): Promise<{ days: number; charge: number; isLate: boolean }> {
  try {
    const msPerDay = 24 * 60 * 60 * 1000;
    const expectedTime = expectedBackDate.getTime();
    const actualTime = actualBackDate.getTime();

    if (actualTime <= expectedTime) {
      return { days: 0, charge: 0, isLate: false };
    }

    const lateDays = Math.ceil((actualTime - expectedTime) / msPerDay);
    const charge = lateDays * dailyRate;

    logger.info(`Calculated late charges for vehicle ${vehicleId}`, { lateDays, charge });

    return {
      days: lateDays,
      charge,
      isLate: true,
    };
  } catch (error) {
    logger.error('Error calculating late charges', { vehicleId, error });
    throw error;
  }
}

/**
 * Get checkout/checkin history for a vehicle
 */
export async function getVehicleHistory(vehicleId: string) {
  try {
    const vehicle = await prisma.loanerVehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new Error(`Vehicle ${vehicleId} not found`);
    }

    logger.info(`Retrieved history for vehicle ${vehicleId}`, {
      status: vehicle.status,
    });

    return vehicle;
  } catch (error) {
    logger.error('Error getting vehicle history', { vehicleId, error });
    throw error;
  }
}

/**
 * Generate return reminders for vehicles due back soon
 */
export async function generateReturnReminders(shopId: string, daysUntilDue: number = 7) {
  try {
    const today = new Date();
    const reminderDate = new Date(today.getTime() + daysUntilDue * 24 * 60 * 60 * 1000);

    const vehicles = await prisma.loanerVehicle.findMany({
      where: {
        shopId,
        status: 'checked-out',
        expectedBack: {
          gte: today,
          lte: reminderDate,
        },
      },
    });

    logger.info(`Generated ${vehicles.length} return reminders for shop ${shopId}`, {
      daysUntilDue,
    });

    return vehicles;
  } catch (error) {
    logger.error('Error generating return reminders', { shopId, error });
    throw error;
  }
}

/**
 * Get overdue vehicles (not returned by expected date)
 */
export async function getOverdueVehicles(shopId: string) {
  try {
    const today = new Date();

    const overdue = await prisma.loanerVehicle.findMany({
      where: {
        shopId,
        status: 'checked-out',
        expectedBackDate: {
          lt: today,
        },
      },
    });

    logger.info(`Found ${overdue.length} overdue vehicles for shop ${shopId}`);

    return overdue;
  } catch (error) {
    logger.error('Error getting overdue vehicles', { shopId, error });
    throw error;
  }
}

/**
 * Get total mileage driven by a vehicle during checkout period
 */
export function calculateMileageDriven(
  mileageOut: number,
  mileageIn: number
): number {
  const driven = mileageIn - mileageOut;
  return Math.max(0, driven); // Don't return negative values
}

/**
 * Validate loaner vehicle data before checkout
 */
export function validateCheckoutData(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.customerId) errors.push('Customer ID is required');
  if (!data.mileageOut || data.mileageOut < 0) errors.push('Valid mileage out is required');
  if (!data.fuelLevelOut) errors.push('Fuel level out is required');
  if (!data.expectedBackDate) errors.push('Expected back date is required');

  // Validate fuel level enum
  const validFuelLevels = ['empty', 'quarter', 'half', 'three-quarter', 'full'];
  if (data.fuelLevelOut && !validFuelLevels.includes(data.fuelLevelOut)) {
    errors.push('Invalid fuel level');
  }

  // Validate expected back date is in future
  const expectedDate = new Date(data.expectedBackDate);
  if (expectedDate < new Date()) {
    errors.push('Expected back date must be in the future');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate loaner vehicle checkin data
 */
export function validateCheckinData(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (data.mileageIn === null || data.mileageIn === undefined || data.mileageIn < 0) {
    errors.push('Valid mileage in is required');
  }
  if (!data.fuelLevelIn) errors.push('Fuel level in is required');

  // Validate fuel level enum
  const validFuelLevels = ['empty', 'quarter', 'half', 'three-quarter', 'full'];
  if (data.fuelLevelIn && !validFuelLevels.includes(data.fuelLevelIn)) {
    errors.push('Invalid fuel level');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
