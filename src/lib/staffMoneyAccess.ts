/**
 * Who may see payroll rates, customer pay links, and FixTray fee settlement.
 * Techs never see coworkers' pay or invoice pay tokens.
 * Managers and techs see the FixTray fee on one work order and the customer
 * total that includes it. Weekly owed, year-end, the owed panel, and fee
 * totals across jobs stay with the shop owner and platform views.
 */

export function mayReadPayrollRates(role: string | null | undefined): boolean {
  const normalized = String(role || '').trim().toLowerCase();
  return normalized === 'shop' || normalized === 'manager';
}

/** Authenticated list of a shop's payment links. Token lookup stays public. */
export function mayListPaymentLinks(role: string | null | undefined): boolean {
  const normalized = String(role || '').trim().toLowerCase();
  return normalized === 'shop' || normalized === 'manager';
}

/** Pay FixTray and email the fee invoice are the shop owner's actions. */
export function maySettlePlatformFee(role: string | null | undefined): boolean {
  return String(role || '').trim().toLowerCase() === 'shop';
}

/** The fee line and customer total on one work order. */
export function maySeePerJobPlatformFee(role: string | null | undefined): boolean {
  const normalized = String(role || '').trim().toLowerCase();
  return normalized === 'shop'
    || normalized === 'manager'
    || normalized === 'tech'
    || normalized === 'customer'
    || normalized === 'accountant'
    || normalized === 'admin'
    || normalized === 'superadmin';
}

/**
 * Weekly owed, fee year-end, the FixTray owed panel, cumulative fee revenue,
 * and fee totals across jobs. Shop owner and platform views only.
 */
export function maySeeAggregatePlatformFee(role: string | null | undefined): boolean {
  const normalized = String(role || '').trim().toLowerCase();
  return normalized === 'shop' || normalized === 'admin' || normalized === 'superadmin';
}

export function hidesAggregatePlatformFee(role: string | null | undefined): boolean {
  return !maySeeAggregatePlatformFee(role);
}

/**
 * Per-job fee is visible. This stays false so older callers do not strip it.
 * Aggregate totals use hidesAggregatePlatformFee.
 */
export function managerMustNotSeePlatformFee(_role: string | null | undefined): boolean {
  return false;
}

export const PER_JOB_FEE_NOTE =
  'FixTray fee, collected on top of the job and owed to FixTray weekly. The amount stored at checkout is not recalculated.';

type FeeBill = {
  subtotal?: number;
  serviceCost?: number;
  serviceFee?: number;
  total?: number;
  fixtrayFee?: number;
};

const FEE_SNAPSHOT_KEY = 'fixtrayFeeSnapshot';

/** Remove the frozen fee snapshot so a manager cannot read it off completion JSON. */
export function stripPlatformFeeFromCompletion(completion: unknown): unknown {
  if (!completion || typeof completion !== 'object' || Array.isArray(completion)) return completion;
  const next = { ...(completion as Record<string, unknown>) };
  delete next[FEE_SNAPSHOT_KEY];
  delete next.customerFacingFeeCents;
  delete next.platformFeeCents;
  return next;
}

function jobSubtotal(bill: FeeBill): number {
  if (typeof bill.subtotal === 'number') return bill.subtotal;
  if (typeof bill.serviceCost === 'number') return bill.serviceCost;
  return Math.max(0, Number(bill.total || 0) - Number(bill.serviceFee || 0));
}

/** Keep the per-job fee. Roles that cannot see a work-order fee still have it removed. */
export function redactPlatformFeeForRole<T extends Record<string, unknown>>(role: string | null | undefined, value: T): T {
  if (maySeePerJobPlatformFee(role)) return value;
  const next: Record<string, unknown> = { ...value };
  delete next.fixtrayServiceFee;
  delete next.platformFeeCents;
  delete next.platformFee;
  delete next.customerFacingFeeCents;
  delete next.feeDeductedFromShop;
  if ('completion' in next) next.completion = stripPlatformFeeFromCompletion(next.completion);
  const bill = next.estimateBill;
  if (bill && typeof bill === 'object') {
    const source = bill as FeeBill;
    next.estimateBill = { ...source, serviceFee: 0, fixtrayFee: 0, total: jobSubtotal(source) };
  }
  const nested = next.workOrder;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    next.workOrder = redactPlatformFeeForRole(role, nested as Record<string, unknown>);
  }
  const rows = next.workOrders;
  if (Array.isArray(rows)) {
    next.workOrders = rows.map((row) => (
      row && typeof row === 'object' ? redactPlatformFeeForRole(role, row as Record<string, unknown>) : row
    ));
  }
  return next as T;
}

type CloseoutPayload = {
  workOrder?: { completion?: unknown } | null;
  invoice?: { quoteAmount?: number; serviceFee?: number; totalDue?: number } | null;
  paymentLink?: Record<string, unknown> | null;
};

/**
 * Closeout shows the per-job fee and the customer total that includes it.
 * Roles that cannot see that fee receive the job amount only.
 */
export function presentCloseoutForRole<T extends CloseoutPayload>(role: string | null | undefined, payload: T): T {
  if (maySeePerJobPlatformFee(role)) return payload;
  const quote = Number(payload.invoice?.quoteAmount) || 0;
  const workOrder = payload.workOrder
    ? { ...payload.workOrder, completion: stripPlatformFeeFromCompletion(payload.workOrder.completion) }
    : payload.workOrder;
  return {
    ...payload,
    workOrder,
    invoice: payload.invoice
      ? { ...payload.invoice, quoteAmount: quote, serviceFee: 0, totalDue: quote }
      : payload.invoice,
    paymentLink: payload.paymentLink
      ? { ...payload.paymentLink, amount: quote, serviceFee: 0, quoteAmount: quote }
      : payload.paymentLink,
  };
}
