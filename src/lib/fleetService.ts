import prisma from '@/lib/prisma';
import logger from '@/lib/logger';

/**
 * Fleet Management Service
 * Handles business logic for fleet account operations
 */

export interface FleetAccountStats {
  totalAccounts: number;
  activeAccounts: number;
  totalVehicles: number;
  totalRevenue: number;
  pendingInvoices: number;
  unpaidAmount: number;
}

/**
 * Get fleet account statistics for a shop
 */
export async function getFleetStats(shopId: string): Promise<FleetAccountStats> {
  try {
    const accounts = await prisma.fleetAccount.findMany({
      where: { shopId },
      include: {
        vehicles: { select: { id: true } },
        invoices: { select: { totalAmount: true, amountPaid: true, status: true } },
      },
    });

    const stats: FleetAccountStats = {
      totalAccounts: accounts.length,
      activeAccounts: accounts.filter(a => a.status === 'active').length,
      totalVehicles: accounts.reduce((sum, a) => sum + a.vehicles.length, 0),
      totalRevenue: 0,
      pendingInvoices: 0,
      unpaidAmount: 0,
    };

    accounts.forEach(account => {
      account.invoices.forEach(invoice => {
        stats.totalRevenue += invoice.totalAmount;
        if (invoice.status === 'unpaid') {
          stats.pendingInvoices++;
          stats.unpaidAmount += invoice.totalAmount - invoice.amountPaid;
        }
      });
    });

    return stats;
  } catch (error) {
    logger.error('Failed to get fleet stats', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * Generate fleet invoice for multiple work orders
 */
export async function generateFleetInvoice(
  fleetAccountId: string,
  workOrderIds: string[],
  dueDate?: Date
): Promise<string> {
  try {
    const fleetAccount = await prisma.fleetAccount.findUnique({
      where: { id: fleetAccountId },
      include: { Shop: true },
    });

    if (!fleetAccount) {
      throw new Error('Fleet account not found');
    }

    // Get work orders
    const workOrders = await prisma.workOrder.findMany({
      where: { id: { in: workOrderIds } },
    });

    const totalAmount = workOrders.reduce((sum, wo) => sum + (wo.estimatedCost || wo.amountPaid || 0), 0);

    // Generate invoice number
    const invoiceCount = await prisma.fleetInvoice.count({
      where: { fleetAccountId },
    });
    const invoiceNumber = `FLEET-${fleetAccountId.slice(-8).toUpperCase()}-${String(invoiceCount + 1).padStart(4, '0')}`;

    // Create invoice
    const invoice = await prisma.fleetInvoice.create({
      data: {
        fleetAccountId,
        shopId: fleetAccount.shopId,
        invoiceNumber,
        workOrderIds: workOrderIds.join(','),
        totalAmount,
        dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    logger.info('Fleet invoice generated', {
      fleetAccountId,
      invoiceId: invoice.id,
      invoiceNumber,
      workOrderCount: workOrderIds.length,
      totalAmount,
    });

    return invoice.id;
  } catch (error) {
    logger.error('Failed to generate fleet invoice', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * Record payment on fleet invoice
 */
export async function recordFleetPayment(
  invoiceId: string,
  paymentAmount: number
): Promise<boolean> {
  try {
    const invoice = await prisma.fleetInvoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const newAmountPaid = invoice.amountPaid + paymentAmount;
    const status = newAmountPaid >= invoice.totalAmount ? 'paid' : 'partial';

    await prisma.fleetInvoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: newAmountPaid,
        status,
        paidAt: status === 'paid' ? new Date() : invoice.paidAt,
      },
    });

    logger.info('Fleet payment recorded', {
      invoiceId,
      paymentAmount,
      newStatus: status,
    });

    return true;
  } catch (error) {
    logger.error('Failed to record fleet payment', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * Get fleet vehicles by account
 */
export async function getFleetVehicles(fleetAccountId: string) {
  try {
    return await prisma.fleetVehicle.findMany({
      where: { fleetAccountId },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    logger.error('Failed to get fleet vehicles', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * Get fleet invoices with aging
 */
export async function getFleetInvoicesWithAging(fleetAccountId: string) {
  try {
    const invoices = await prisma.fleetInvoice.findMany({
      where: { fleetAccountId },
      orderBy: { createdAt: 'desc' },
    });

    return invoices.map(inv => ({
      ...inv,
      daysOverdue: inv.status === 'unpaid' 
        ? Math.floor((new Date().getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0,
      amountDue: inv.totalAmount - inv.amountPaid,
    }));
  } catch (error) {
    logger.error('Failed to get fleet invoices with aging', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * Validate fleet account has credit available
 */
export async function hasAvailableCredit(fleetAccountId: string, amount: number): Promise<boolean> {
  try {
    const account = await prisma.fleetAccount.findUnique({
      where: { id: fleetAccountId },
      include: {
        invoices: {
          where: { status: 'unpaid' },
          select: { totalAmount: true, amountPaid: true },
        },
      },
    });

    if (!account) return false;

    const usedCredit = account.invoices.reduce(
      (sum, inv) => sum + (inv.totalAmount - inv.amountPaid),
      0
    );

    const availableCredit = account.creditLimit - usedCredit;
    return availableCredit >= amount;
  } catch (error) {
    logger.error('Failed to check available credit', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}
