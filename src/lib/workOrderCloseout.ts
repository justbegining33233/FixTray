/**
 * Work-order closeout: invoice (payment link for this job) → paid → complete.
 * Marking paid does not complete the job.
 *
 * Invoice totals include the FixTray service fee (see FIXTRAY_SERVICE_FEE),
 * matching Stripe checkout, PDF invoices, and the customer payment UI.
 */

import { FIXTRAY_SERVICE_FEE } from '@/lib/constants';

export type CloseoutAction = 'invoice' | 'paid' | 'complete';

export interface CloseoutWorkOrder {
  status?: string | null;
  paymentStatus?: string | null;
  estimatedCost?: number | null;
  estimate?: unknown;
}

export type CloseoutResult =
  | { ok: false; error: string }
  | {
      ok: true;
      action: CloseoutAction;
      status: string;
      paymentStatus: string;
      /** Quote / services subtotal (excludes FixTray fee) */
      quoteAmount: number;
      /** FixTray platform service fee included on the final bill */
      serviceFee: number;
      /** Total charged to the customer (quote + service fee) */
      amount: number;
    };

const INVOICE_STATUSES = new Set(['in-progress', 'assigned', 'waiting-for-payment']);

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Services & parts subtotal from the authorized estimate (no platform fee). */
export function quoteAmount(workOrder: CloseoutWorkOrder): number {
  if (typeof workOrder.estimatedCost === 'number' && workOrder.estimatedCost > 0) {
    return round2(workOrder.estimatedCost);
  }

  if (!workOrder.estimate || typeof workOrder.estimate !== 'object') return 0;

  const estimate = workOrder.estimate as Record<string, unknown>;
  const candidates = [estimate.total, estimate.amount, estimate.grandTotal];
  for (const value of candidates) {
    const amount = Number(value);
    if (Number.isFinite(amount) && amount > 0) return round2(amount);
  }

  return 0;
}

/** FixTray fee applied on every invoiced work order (USD). */
export function fixtrayServiceFee(): number {
  return FIXTRAY_SERVICE_FEE;
}

/** Final bill total: quote subtotal + FixTray service fee. */
export function invoiceTotal(workOrder: CloseoutWorkOrder): {
  quoteAmount: number;
  serviceFee: number;
  amount: number;
} {
  const quote = quoteAmount(workOrder);
  const serviceFee = quote > 0 ? fixtrayServiceFee() : 0;
  return {
    quoteAmount: quote,
    serviceFee,
    amount: round2(quote + serviceFee),
  };
}

export function closeoutTransition(workOrder: CloseoutWorkOrder, action: unknown): CloseoutResult {
  const status = String(workOrder.status || '').toLowerCase();
  const paymentStatus = String(workOrder.paymentStatus || 'unpaid').toLowerCase();
  const { quoteAmount: quote, serviceFee, amount } = invoiceTotal(workOrder);

  if (action !== 'invoice' && action !== 'paid' && action !== 'complete') {
    return { ok: false, error: 'Unknown closeout action.' };
  }

  if (action === 'invoice') {
    if (status === 'estimate-submitted') {
      return { ok: false, error: 'The customer must accept and sign the estimate before you can invoice.' };
    }
    if (status === 'denied-estimate') {
      return { ok: false, error: 'This quote was denied. There is no work authorization to invoice.' };
    }
    if (status === 'completed' || status === 'closed') {
      return { ok: false, error: 'This job is already complete.' };
    }
    if (!INVOICE_STATUSES.has(status)) {
      return { ok: false, error: 'Invoice this job after the customer has signed and work is in progress.' };
    }
    if (quote <= 0) {
      return { ok: false, error: 'Add an estimate total before requesting payment.' };
    }
    return {
      ok: true,
      action: 'invoice',
      status: 'waiting-for-payment',
      paymentStatus: paymentStatus === 'paid' ? 'paid' : 'unpaid',
      quoteAmount: quote,
      serviceFee,
      amount,
    };
  }

  if (action === 'paid') {
    if (paymentStatus === 'paid' && status === 'waiting-for-payment') {
      return {
        ok: true,
        action: 'paid',
        status: 'waiting-for-payment',
        paymentStatus: 'paid',
        quoteAmount: quote,
        serviceFee,
        amount,
      };
    }
    if (status !== 'waiting-for-payment') {
      return { ok: false, error: 'Request payment before marking this job paid.' };
    }
    return {
      ok: true,
      action: 'paid',
      status: 'waiting-for-payment',
      paymentStatus: 'paid',
      quoteAmount: quote,
      serviceFee,
      amount,
    };
  }

  if (paymentStatus !== 'paid') {
    return { ok: false, error: 'Mark the invoice paid before completing the job.' };
  }
  if (status === 'completed' || status === 'closed') {
    return { ok: false, error: 'This job is already complete.' };
  }
  return {
    ok: true,
    action: 'complete',
    status: 'completed',
    paymentStatus: 'paid',
    quoteAmount: quote,
    serviceFee,
    amount,
  };
}
