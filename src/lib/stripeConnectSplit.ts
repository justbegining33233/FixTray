/**
 * Stripe Connect destination charge for a work-order payment.
 *
 * The customer is charged quote + the live FixTray service fee.
 * FixTray keeps only that fee (application_fee_amount).
 * Labor, parts, and other shop charges transfer to the shop's connected account.
 *
 * A charge is never shaped for the platform alone. If the shop has no Connect
 * destination, callers must refuse the payment instead of retaining shop funds.
 */

import { roundMoney } from '@/lib/serviceFeeBill';

export interface ConnectDestinationSplit {
  ok: true;
  destination: string;
  /** Shop services, parts, labor, and shop fees, in cents. */
  quoteCents: number;
  /** Live platform fee in cents. Zero is omitted from Stripe (the API rejects 0). */
  applicationFeeCents: number;
  /** Amount the customer pays, in cents. */
  chargeCents: number;
  /** Amount transferred to the shop, in cents. Equals quoteCents. */
  shopPayoutCents: number;
  /**
   * Checkout payment_intent_data / PaymentIntent fields.
   * Stripe allows application_fee_amount or transfer_data.amount, not both.
   * The application fee is the platform's only take. Omitting transfer amount
   * sends charge minus that fee to the connected account.
   */
  paymentIntentData: {
    transfer_data: { destination: string };
    application_fee_amount?: number;
  };
}

export type ConnectSplitResult =
  | ConnectDestinationSplit
  | { ok: false; status: 400 | 409; error: string };

function usdToCents(usd: number): number {
  return Math.round(roundMoney(Math.max(0, Number(usd) || 0)) * 100);
}

export function buildConnectDestinationSplit(input: {
  quoteUsd: number;
  serviceFeeUsd: number;
  connectedAccountId: string | null | undefined;
}): ConnectSplitResult {
  const quoteCents = usdToCents(input.quoteUsd);
  const applicationFeeCents = usdToCents(input.serviceFeeUsd);

  if (quoteCents <= 0) {
    return { ok: false, status: 400, error: 'No estimate on this work order yet' };
  }

  const destination = typeof input.connectedAccountId === 'string' ? input.connectedAccountId.trim() : '';
  if (!destination.startsWith('acct_')) {
    return {
      ok: false,
      status: 409,
      error:
        'This shop has not connected Stripe. Work payments go to the shop, so FixTray will not charge this invoice until the shop connects a payout account.',
    };
  }

  const chargeCents = quoteCents + applicationFeeCents;
  const shopPayoutCents = quoteCents;
  if (applicationFeeCents >= chargeCents || shopPayoutCents <= 0) {
    return {
      ok: false,
      status: 400,
      error: 'The platform service fee must be only the FixTray fee, and less than the charge total.',
    };
  }

  return {
    ok: true,
    destination,
    quoteCents,
    applicationFeeCents,
    chargeCents,
    shopPayoutCents,
    paymentIntentData: {
      transfer_data: { destination },
      ...(applicationFeeCents > 0 ? { application_fee_amount: applicationFeeCents } : {}),
    },
  };
}

/** PaymentIntent create params for a destination charge. Amount is in cents. */
export function destinationChargeParams(
  split: ConnectDestinationSplit,
  metadata: Record<string, string>
): {
  amount: number;
  currency: 'usd';
  metadata: Record<string, string>;
  transfer_data: { destination: string };
  application_fee_amount?: number;
} {
  return {
    amount: split.chargeCents,
    currency: 'usd',
    metadata: {
      ...metadata,
      fixtrayServiceFeeCents: String(split.applicationFeeCents),
      shopPayoutCents: String(split.shopPayoutCents),
    },
    ...split.paymentIntentData,
  };
}

/**
 * Destination charges require the connected account to be able to receive
 * transfers. An incomplete Express account must not be charged, or Stripe
 * can hold the shop's funds on the platform.
 */
export function shopCanReceiveConnectTransfer(account: {
  capabilities?: { transfers?: string | null } | null;
  payouts_enabled?: boolean | null;
} | null | undefined): boolean {
  if (!account) return false;
  const transfers = account.capabilities?.transfers;
  if (typeof transfers === 'string' && transfers.length > 0) {
    return transfers === 'active';
  }
  return account.payouts_enabled === true;
}
