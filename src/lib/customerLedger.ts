/**
 * Customer insights and the payments page share one definition of money.
 *
 * Total spent and total paid are the amounts recorded on paid work orders
 * (`amountPaid`). An open invoice is still due at the quote plus the live
 * platform fee, and that due amount is not added onto a payment already recorded.
 */

import { billWithServiceFee, customerPaymentBill, roundMoney, type ServiceFeeBill } from '@/lib/serviceFeeBill';

const COMPLETED_STATUSES = new Set(['closed', 'completed']);

export interface CustomerLedgerOrder {
  status?: string | null;
  paymentStatus?: string | null;
  amountPaid?: number | null;
  estimatedCost?: number | null;
  createdAt?: string | Date | null;
  /** Customer-facing fee frozen at checkout, in USD. Unpaid bills use this instead of the live platform fee. */
  frozenCustomerFeeUsd?: number | null;
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
 * Unpaid rows show the open bill: quote plus the fee frozen at checkout,
 * or the current platform fee when checkout has not fixed one yet.
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

  if (typeof order.frozenCustomerFeeUsd === 'number' && Number.isFinite(order.frozenCustomerFeeUsd)) {
    const quote = roundMoney(Math.max(0, Number(order.estimatedCost) || 0));
    const fee = roundMoney(Math.max(0, order.frozenCustomerFeeUsd));
    return {
      amount: roundMoney(quote + fee),
      serviceCost: quote,
      fixtrayFee: fee,
    };
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

/**
 * Estimate and invoice rows. A recorded payment keeps the fee that was charged.
 * An open bill uses the customer-facing fee for that shop quote.
 */
export function estimateBillForOrder(order: CustomerLedgerOrder, savedFeeUsd: number): ServiceFeeBill {
  const quote = typeof order.estimatedCost === 'number' && Number.isFinite(order.estimatedCost)
    ? roundMoney(Math.max(0, order.estimatedCost))
    : 0;
  if (isPaidRecord(order) && recordedPaidUsd(order) > 0) {
    const charge = customerChargeDisplay({ ...order, estimatedCost: quote }, savedFeeUsd);
    return { subtotal: charge.serviceCost, serviceFee: charge.fixtrayFee, total: charge.amount };
  }
  if (typeof order.frozenCustomerFeeUsd === 'number' && Number.isFinite(order.frozenCustomerFeeUsd)) {
    const fee = roundMoney(Math.max(0, order.frozenCustomerFeeUsd));
    return { subtotal: quote, serviceFee: fee, total: roundMoney(quote + fee) };
  }
  return billWithServiceFee(quote, savedFeeUsd);
}

/**
 * The customer total shown on a work-order detail page.
 * Uses the same estimate bill the estimates list already attached.
 * A missing bill falls back to the same live fee calculation as that list.
 */
export function matchingEstimateBill(input: {
  estimatedCost?: number | null;
  lineItemTotal?: number | null;
  estimateBill?: { subtotal?: number; serviceFee?: number; total?: number } | null;
  platformFeeUsd?: number | null;
}): ServiceFeeBill {
  const estimated = typeof input.estimatedCost === 'number' && Number.isFinite(input.estimatedCost) && input.estimatedCost > 0
    ? roundMoney(input.estimatedCost)
    : 0;
  const lines = typeof input.lineItemTotal === 'number' && Number.isFinite(input.lineItemTotal) && input.lineItemTotal > 0
    ? roundMoney(input.lineItemTotal)
    : 0;
  const quote = estimated > 0 ? estimated : lines;
  const server = input.estimateBill;
  if (
    server
    && typeof server.subtotal === 'number'
    && typeof server.serviceFee === 'number'
    && typeof server.total === 'number'
    && Number.isFinite(server.total)
    && Math.abs(roundMoney(server.subtotal) - quote) < 0.02
  ) {
    return {
      subtotal: roundMoney(server.subtotal),
      serviceFee: roundMoney(Math.max(0, server.serviceFee)),
      total: roundMoney(server.total),
    };
  }
  return billWithServiceFee(quote, Number(input.platformFeeUsd) || 0);
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
