import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

/**
 * Get all active reminders due today or overdue
 */
export async function getDueReminders(shopId?: string) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reminders = await prisma.recurringReminder.findMany({
      where: {
        status: 'active',
        nextReminderDate: { lte: today },
        ...(shopId && { shopId }),
      },
      include: {
        vehicle: true,
        shop: { select: { id: true, shopName: true } },
      },
      orderBy: { nextReminderDate: 'asc' },
    });

    logger.info('Retrieved due reminders', { count: reminders.length, shopId });
    return reminders;
  } catch (error) {
    logger.error('Error getting due reminders', { error });
    throw error;
  }
}

/**
 * Process reminder and schedule next one
 */
export async function processReminder(reminderId: string) {
  try {
    const reminder = await prisma.recurringReminder.findUnique({
      where: { id: reminderId },
    });

    if (!reminder) {
      throw new Error(`Reminder ${reminderId} not found`);
    }

    // Calculate next reminder date based on frequency
    const nextDate = calculateNextReminderDate(reminder.nextReminderDate, reminder.frequency);

    // Record sent reminder
    await prisma.sentReminder.create({
      data: {
        reminderId,
        sentAt: new Date(),
        notificationMethod: reminder.notificationMethod[0] || 'email',
        status: 'sent',
      },
    });

    // Update next reminder date
    await prisma.recurringReminder.update({
      where: { id: reminderId },
      data: { nextReminderDate: nextDate },
    });

    logger.info('Reminder processed', { reminderId, nextReminderDate: nextDate });
    return { success: true, nextReminderDate: nextDate };
  } catch (error) {
    logger.error('Error processing reminder', { reminderId, error });
    throw error;
  }
}

/**
 * Calculate next reminder date based on frequency
 */
function calculateNextReminderDate(currentDate: Date, frequency: string): Date {
  const next = new Date(currentDate);

  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'annually':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setDate(next.getDate() + 1);
  }

  return next;
}

/**
 * Get reminders for a vehicle
 */
export async function getVehicleReminders(vehicleId: string) {
  try {
    const reminders = await prisma.recurringReminder.findMany({
      where: { vehicleId },
      include: { shop: { select: { id: true, shopName: true } } },
      orderBy: { nextReminderDate: 'asc' },
    });

    logger.info('Retrieved vehicle reminders', { vehicleId, count: reminders.length });
    return reminders;
  } catch (error) {
    logger.error('Error getting vehicle reminders', { vehicleId, error });
    throw error;
  }
}

/**
 * Get reminder statistics
 */
export async function getReminderStats(shopId: string) {
  try {
    const [totalReminders, activeReminders, dueReminders, sentCount] = await Promise.all([
      prisma.recurringReminder.count({ where: { shopId } }),
      prisma.recurringReminder.count({ where: { shopId, status: 'active' } }),
      prisma.recurringReminder.count({
        where: {
          shopId,
          status: 'active',
          nextReminderDate: { lte: new Date() },
        },
      }),
      prisma.sentReminder.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
    ]);

    const stats = {
      totalReminders,
      activeReminders,
      dueReminders,
      sentInLastMonth: sentCount,
    };

    logger.info('Retrieved reminder statistics', { shopId, ...stats });
    return stats;
  } catch (error) {
    logger.error('Error getting reminder statistics', { shopId, error });
    throw error;
  }
}

/**
 * Get sent reminders history
 */
export async function getSentRemindersHistory(reminderId: string, limit = 10) {
  try {
    const sent = await prisma.sentReminder.findMany({
      where: { reminderId },
      orderBy: { sentAt: 'desc' },
      take: limit,
    });

    logger.info('Retrieved sent reminders history', { reminderId, count: sent.length });
    return sent;
  } catch (error) {
    logger.error('Error getting sent reminders history', { reminderId, error });
    throw error;
  }
}

/**
 * Pause all reminders for a vehicle
 */
export async function pauseVehicleReminders(vehicleId: string) {
  try {
    const result = await prisma.recurringReminder.updateMany({
      where: { vehicleId },
      data: { status: 'paused' },
    });

    logger.info('Vehicle reminders paused', { vehicleId, count: result.count });
    return result;
  } catch (error) {
    logger.error('Error pausing vehicle reminders', { vehicleId, error });
    throw error;
  }
}

/**
 * Resume all reminders for a vehicle
 */
export async function resumeVehicleReminders(vehicleId: string) {
  try {
    const result = await prisma.recurringReminder.updateMany({
      where: { vehicleId },
      data: { status: 'active' },
    });

    logger.info('Vehicle reminders resumed', { vehicleId, count: result.count });
    return result;
  } catch (error) {
    logger.error('Error resuming vehicle reminders', { vehicleId, error });
    throw error;
  }
}
