/**
 * Quote and invoice totals that include one FixTray service fee.
 *
 * Callers pass the saved PlatformConfig fee (what the platform nets after
 * Stripe). The returned serviceFee is the customer-facing fee for that shop
 * bill, grossed up so the usual US card rate (2.9% of the whole charge plus
 * 30 cents) still leaves the saved fee. There is no separate card-processing
 * line. A zero quote or a zero saved fee produces no fee line.
 */

export const FIXTRAY_SERVICE_FEE_LABEL = 'FixTray Service Fee';

/** Stripe US card rate: 2.9% (29/1000) of the whole charge, plus 30 cents. */
const STRIPE_PERCENT_NUMERATOR = 29;
const STRIPE_PERCENT_DENOMINATOR = 1000;
const STRIPE_FIXED_CENTS = 30;
const STRIPE_KEEP_DENOMINATOR = STRIPE_PERCENT_DENOMINATOR - STRIPE_PERCENT_NUMERATOR;

export interface ServiceFeeBill {
  /** Services, parts, and tax. Does not include the platform fee. */
  subtotal: number;
  /** Customer-facing FixTray fee in USD. 0 when the quote or the saved fee is 0. */
  serviceFee: number;
  /** subtotal + serviceFee */
  total: number;
}

function roundHalfUp(numerator: number, denominator: number): number {
  return Math.floor((numerator * 2 + denominator) / (denominator * 2));
}

/** Nearest-cent Stripe US card fee on a charge amount, in cents. */
export function stripeUsCardFeeCents(chargeCents: number): number {
  const charge = Math.max(0, Math.round(chargeCents));
  const percent = roundHalfUp(charge * STRIPE_PERCENT_NUMERATOR, STRIPE_PERCENT_DENOMINATOR);
  return percent + STRIPE_FIXED_CENTS;
}

/**
 * Customer-facing fee in cents.
 * serviceFee = (savedFee + 0.30 + 0.029 * shopBill) / 0.971
 * Nearest cent, then up one cent at a time if that would net less than savedFee
 * after 2.9% plus 30 cents of the whole charge.
 */
export function customerFacingServiceFeeCents(shopBillCents: number, savedFeeCents: number): number {
  const shop = Math.max(0, Math.round(shopBillCents));
  const saved = Math.max(0, Math.round(savedFeeCents));
  if (shop <= 0 || saved <= 0) return 0;

  const numerator = (saved + STRIPE_FIXED_CENTS) * STRIPE_PERCENT_DENOMINATOR
    + STRIPE_PERCENT_NUMERATOR * shop;
  let fee = roundHalfUp(numerator, STRIPE_KEEP_DENOMINATOR);

  const netsSavedFee = (candidate: number) => {
    const charge = shop + candidate;
    const stripeFee = roundHalfUp(charge * STRIPE_PERCENT_NUMERATOR, STRIPE_PERCENT_DENOMINATOR) + STRIPE_FIXED_CENTS;
    return candidate - stripeFee >= saved;
  };

  if (!netsSavedFee(fee)) {
    const cap = fee + shop + saved + 100;
    while (!netsSavedFee(fee) && fee < cap) fee += 1;
  }
  return fee;
}

export function usdToCents(usd: number): number {
  const amount = Number(usd);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(Math.max(0, amount) * 100);
}

export function centsToUsd(cents: number): number {
  return Math.round(cents) / 100;
}

export function roundMoney(value: number): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

/**
 * Apply the saved platform fee (USD) to a shop bill.
 * The returned serviceFee is the one customer-facing amount for that bill.
 */
export function billWithServiceFee(subtotalUsd: number, savedFeeUsd: number): ServiceFeeBill {
  const subtotal = roundMoney(Math.max(0, Number(subtotalUsd) || 0));
  const saved = roundMoney(Math.max(0, Number(savedFeeUsd) || 0));
  const serviceFeeCents = customerFacingServiceFeeCents(usdToCents(subtotal), usdToCents(saved));
  const serviceFee = centsToUsd(serviceFeeCents);
  return {
    subtotal,
    serviceFee,
    total: centsToUsd(usdToCents(subtotal) + serviceFeeCents),
  };
}

/**
 * Customer payment row. estimatedCost is the shop quote (no fee).
 * amountPaid is only used when the quote was not stored. The saved fee is
 * removed to recover a shop bill, then the customer-facing fee is applied.
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
 * Payment-link display totals for an amount already stored.
 * A link stored above the quote already baked the fee in (keep that snapshot,
 * including a historical flat fee on a paid charge).
 * A link stored at the quote omitted the fee — add the customer-facing fee.
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

/**
 * Open invoice shown to the customer. A stored link that already baked in an
 * older flat fee is not what checkout charges. Partial amounts below the quote
 * stay as stored.
 */
export function unpaidInvoiceDisplay(
  storedAmountUsd: number,
  quoteUsd: number,
  savedFeeUsd: number,
): ServiceFeeBill & { amount: number; serviceCost: number } {
  const amount = roundMoney(Math.max(0, Number(storedAmountUsd) || 0));
  const quote = roundMoney(Math.max(0, Number(quoteUsd) || 0));
  if (quote > 0 && amount + 0.001 >= quote) {
    const bill = billWithServiceFee(quote, savedFeeUsd);
    return {
      serviceCost: bill.subtotal,
      subtotal: bill.subtotal,
      serviceFee: bill.serviceFee,
      amount: bill.total,
      total: bill.total,
    };
  }
  return paymentLinkFeeBreakdown(amount, quote, savedFeeUsd);
}
