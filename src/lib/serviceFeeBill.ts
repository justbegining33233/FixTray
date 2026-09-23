/**
 * Quote and invoice totals that include the live FixTray service fee.
 *
 * The fee is USD from PlatformConfig (via getPlatformServiceFeeUsd). Do not
 * pass a hardcoded amount. A zero quote or a zero configured fee produces no
 * fee line — callers should hide the row when serviceFee is 0.
 */

export const FIXTRAY_SERVICE_FEE_LABEL = 'FixTray Service Fee';

export interface ServiceFeeBill {
  /** Services, parts, and tax. Does not include the platform fee. */
  subtotal: number;
  /** Live platform fee in USD. 0 when the quote is 0 or the configured fee is 0. */
  serviceFee: number;
  /** subtotal + serviceFee */
  total: number;
}

export function roundMoney(value: number): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

/** Apply a live platform fee (USD) to a services subtotal. */
export function billWithServiceFee(subtotalUsd: number, serviceFeeUsd: number): ServiceFeeBill {
  const subtotal = roundMoney(Math.max(0, Number(subtotalUsd) || 0));
  const configured = roundMoney(Math.max(0, Number(serviceFeeUsd) || 0));
  const serviceFee = subtotal > 0 ? configured : 0;
  return {
    subtotal,
    serviceFee,
    total: roundMoney(subtotal + serviceFee),
  };
}

/**
 * Customer payment row. estimatedCost is the quote (no fee).
 * amountPaid is only used when the quote was not stored, and is treated as
 * already including the fee so we do not subtract it twice.
 */
export function customerPaymentBill(input: {
  estimatedCost?: number | null;
  amountPaid?: number | null;
  serviceFeeUsd: number;
}): ServiceFeeBill {
  if (typeof input.estimatedCost === 'number' && input.estimatedCost > 0) {
    return billWithServiceFee(input.estimatedCost, input.serviceFeeUsd);
  }
  if (typeof input.amountPaid === 'number' && input.amountPaid > 0) {
    const fee = roundMoney(Math.max(0, Number(input.serviceFeeUsd) || 0));
    const subtotal = roundMoney(Math.max(0, input.amountPaid - fee));
    return billWithServiceFee(subtotal > 0 ? subtotal : input.amountPaid, input.serviceFeeUsd);
  }
  return billWithServiceFee(0, input.serviceFeeUsd);
}

/**
 * Payment-link display totals.
 * A link stored above the quote already baked the fee in (keep that snapshot).
 * A link stored at the quote omitted the fee — add the live platform fee.
 * Partial amounts (below the quote) are not inflated.
 */
export function paymentLinkFeeBreakdown(
  amountUsd: number,
  quoteUsd: number,
  liveFeeUsd: number
): ServiceFeeBill & { amount: number; serviceCost: number } {
  const amount = roundMoney(Math.max(0, Number(amountUsd) || 0));
  const quote = roundMoney(Math.max(0, Number(quoteUsd) || 0));
  if (amount <= 0) {
    return { serviceCost: 0, serviceFee: 0, amount: 0, subtotal: 0, total: 0 };
  }

  if (quote > 0 && amount + 0.001 >= quote) {
    const embedded = roundMoney(amount - quote);
    if (embedded > 0.009) {
      return {
        serviceCost: quote,
        subtotal: quote,
        serviceFee: embedded,
        amount,
        total: amount,
      };
    }
    const bill = billWithServiceFee(quote, liveFeeUsd);
    return {
      serviceCost: bill.subtotal,
      subtotal: bill.subtotal,
      serviceFee: bill.serviceFee,
      amount: bill.total,
      total: bill.total,
    };
  }

  const fee = roundMoney(Math.max(0, Number(liveFeeUsd) || 0));
  const serviceFee = Math.min(fee, amount);
  const serviceCost = roundMoney(Math.max(0, amount - serviceFee));
  return {
    serviceCost,
    subtotal: serviceCost,
    serviceFee,
    amount,
    total: amount,
  };
}
