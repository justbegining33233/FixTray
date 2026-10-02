/**
 * Customer insights and the payments page share one definition of money.
 *
 * Total spent and total paid are the amounts recorded on paid work orders
 * (`amountPaid`). An open invoice is still due at the quote plus the live
 * platform fee, and that due amount is not added onto a payment already recorded.
 */

import { customerPaymentBill, roundMoney } from '@/lib/serviceFeeBill';

const COMPLETED_STATUSES = new Set(['closed', 'completed']);

export interface CustomerLedgerOrder {
  status?: string | null;
  paymentStatus?: string | null;
  amountPaid?: number | null;
  estimatedCost?: number | null;
  createdAt?: string | Date | null;
}

export function isCompletedService(status?: string | null): boolean {
  return COMPLETED_STATUSES.has(String(status || '').trim().toLowerCase());
}

export function isPaidRecord(order: { paymentStatus?: string | null }): boolean {
  return String(order.paymentStatus || '').trim().toLowerCase() === 'paid';
}

/** Money recorded for a paid work order. A missing amount is not the quote or the live fee. */
export function recordedPaidUsd(order: {
  paymentStatus?: string | null;
  amountPaid?: number | null;
}): number {
  if (!isPaidRecord(order)) return 0;
  const paid = Number(order.amountPaid);
  if (!Number.isFinite(paid) || paid <= 0) return 0;
  return roundMoney(paid);
}

export interface CustomerChargeDisplay {
  amount: number;
  serviceCost: number;
  fixtrayFee: number;
}

/**
 * Paid rows show the recorded charge. The live fee is not added again.
 * Unpaid rows show the open bill: quote plus the current platform fee.
 */
export function customerChargeDisplay(
  order: CustomerLedgerOrder,
  serviceFeeUsd: number,
): CustomerChargeDisplay {
  if (isPaidRecord(order)) {
    const recorded = recordedPaidUsd(order);
    const quote = Number(order.estimatedCost);
    if (Number.isFinite(quote) && quote > 0 && recorded > quote + 0.009) {
      return {
        amount: recorded,
        serviceCost: roundMoney(quote),
        fixtrayFee: roundMoney(recorded - quote),
      };
    }
    return { amount: recorded, serviceCost: recorded, fixtrayFee: 0 };
  }

  const bill = customerPaymentBill({
    estimatedCost: order.estimatedCost,
    amountPaid: order.amountPaid,
    serviceFeeUsd,
  });
  return {
    amount: bill.total,
    serviceCost: bill.subtotal,
    fixtrayFee: bill.serviceFee,
  };
}

export interface CustomerLedgerSummary {
  totalPaid: number;
  totalSpent: number;
  paidCount: number;
  servicesCompleted: number;
  totalPending: number;
  pendingCount: number;
}

/** Spent and paid are the same recorded payments. Pending is unpaid bills only. */
export function customerLedgerSummary(
  orders: CustomerLedgerOrder[],
  serviceFeeUsd: number,
): CustomerLedgerSummary {
  let totalPaid = 0;
  let paidCount = 0;
  let totalPending = 0;
  let pendingCount = 0;
  let servicesCompleted = 0;

  for (const order of orders) {
    if (isCompletedService(order.status)) servicesCompleted += 1;
    if (isPaidRecord(order)) {
      const paid = recordedPaidUsd(order);
      if (paid > 0) {
        totalPaid += paid;
        paidCount += 1;
      }
      continue;
    }
    const due = customerChargeDisplay(order, serviceFeeUsd).amount;
    if (due > 0) {
      totalPending += due;
      pendingCount += 1;
    }
  }

  const paid = roundMoney(totalPaid);
  return {
    totalPaid: paid,
    totalSpent: paid,
    paidCount,
    servicesCompleted,
    totalPending: roundMoney(totalPending),
    pendingCount,
  };
}
