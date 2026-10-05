/**
 * Platform fee totals from books rows. Nothing here multiplies a job count
 * by the current PlatformConfig fee.
 */

import prisma from '@/lib/prisma';
import { feeMovements, platformFeeYear, type FeeMovement, type PlatformFeeYear } from '@/lib/books/money';
import { dayKey, monthName, reportTimeZone } from '@/lib/books/periods';

export interface FeeMonthBucket extends PlatformFeeYear {
  month: string;
  label: string;
}

export async function loadFeeMovements(): Promise<FeeMovement[]> {
  const [orders, entries] = await Promise.all([
    prisma.workOrder.findMany({
      select: {
        id: true,
        shopId: true,
        estimatedCost: true,
        amountPaid: true,
        paymentStatus: true,
        createdAt: true,
      },
    }),
    prisma.booksEntry.findMany({
      where: { appliesTo: 'fee' },
      select: {
        id: true,
        workOrderId: true,
        shopId: true,
        kind: true,
        appliesTo: true,
        amountCents: true,
        status: true,
        sourceId: true,
        note: true,
        createdAt: true,
      },
    }),
  ]);
  return feeMovements(orders, entries);
}

export async function reportZone(): Promise<string> {
  try {
    const config = await prisma.platformConfig.findUnique({ where: { id: 'global' }, select: { timezone: true } });
    return reportTimeZone(config?.timezone);
  } catch {
    return reportTimeZone(null);
  }
}

export function groupFeeMovementsByMonth(movements: FeeMovement[], timeZone: string): FeeMonthBucket[] {
  const groups = new Map<string, FeeMovement[]>();
  for (const movement of movements) {
    const instant = new Date(movement.at);
    if (Number.isNaN(instant.getTime())) continue;
    const month = dayKey(instant, timeZone).slice(0, 7);
    const list = groups.get(month) || [];
    list.push(movement);
    groups.set(month, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, rows]) => ({
      month,
      label: `${monthName(month)} ${month.slice(0, 4)}`,
      ...platformFeeYear(rows),
    }));
}

export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

export function dollars(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}
