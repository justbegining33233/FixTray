import { shopCanReceiveConnectTransfer } from '@/lib/stripeConnectSplit';

/**
 * Whether a customer may be offered Pay.
 * Checkout already refuses a destination charge when the connected account
 * cannot receive transfers. The button must use that same result first.
 * A shop that can receive transfers is still offered Pay. An account id is
 * never treated as ready on its own.
 */
export const SHOP_CANNOT_TAKE_CARDS = 'This shop cannot take card payment yet.';

const CLOSED_STATUSES = new Set(['denied-estimate', 'cancelled', 'canceled', 'completed', 'closed']);

export type ConnectAccountSnapshot = {
  capabilities?: { transfers?: string | null } | null;
  payouts_enabled?: boolean | null;
};

export function cardPaymentOffer(input: {
  stripeConfigured: boolean;
  serviceFeeConfigured: boolean;
  connectedAccountId: string | null | undefined;
  account: ConnectAccountSnapshot | null | undefined;
}): { available: boolean; message: string | null } {
  const destination = typeof input.connectedAccountId === 'string' ? input.connectedAccountId.trim() : '';
  const available = input.stripeConfigured
    && input.serviceFeeConfigured
    && destination.startsWith('acct_')
    && shopCanReceiveConnectTransfer(input.account);
  if (available) return { available: true, message: null };
  return { available: false, message: SHOP_CANNOT_TAKE_CARDS };
}

/** Pay is shown only for an open invoice whose shop can take the destination charge. */
export function customerSeesPayButton(input: {
  paymentStatus?: string | null;
  status?: string | null;
  totalDue: number;
  cardPaymentAvailable: boolean;
}): boolean {
  if (!input.cardPaymentAvailable) return false;
  if (input.paymentStatus === 'paid') return false;
  if (CLOSED_STATUSES.has(String(input.status || '').toLowerCase())) return false;
  return input.totalDue > 0;
}
