/**
 * Who may see payroll rates, customer pay links, and FixTray fee settlement.
 * Techs never see coworkers' pay or invoice pay tokens.
 * Managers may see payroll (the manager payroll page) but never FixTray fee
 * amounts or the owner's fee-settlement actions.
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

export function managerMustNotSeePlatformFee(role: string | null | undefined): boolean {
  return String(role || '').trim().toLowerCase() === 'manager';
}

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

/** Drop FixTray fee dollars from a work-order payload. Job amounts stay. */
export function redactPlatformFeeForRole<T extends Record<string, unknown>>(role: string | null | undefined, value: T): T {
  if (!managerMustNotSeePlatformFee(role)) return value;
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
 * Managers can request payment. The stored charge still includes the fee.
 * The JSON they receive shows only the job amount, so the fee cannot be subtracted out.
 */
export function presentCloseoutForRole<T extends CloseoutPayload>(role: string | null | undefined, payload: T): T {
  if (!managerMustNotSeePlatformFee(role)) return payload;
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
