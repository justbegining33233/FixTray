import stripe from '@/lib/stripe';
import { getConfiguredPlatformServiceFeeUsd } from '@/lib/platformFee';
import { isStripeAccountId, stripePlatformConfigured } from '@/lib/stripeConnectOnboarding';
import { cardPaymentOffer, type ConnectAccountSnapshot } from '@/lib/customerCardPay';

/**
 * Live Connect read for the customer Pay decision.
 * A retrieve failure fails closed. The account id is not returned to the client.
 */
export async function cardPaymentOfferForShop(
  connectedAccountId: string | null | undefined,
  options?: {
    serviceFeeUsd?: number | null;
    cache?: Map<string, ConnectAccountSnapshot | null>;
  },
): Promise<{ available: boolean; message: string | null }> {
  const stripeConfigured = stripePlatformConfigured();
  const serviceFeeUsd = options && 'serviceFeeUsd' in options
    ? options.serviceFeeUsd
    : await getConfiguredPlatformServiceFeeUsd();
  const id = isStripeAccountId(connectedAccountId) ? connectedAccountId.trim() : '';
  let account: ConnectAccountSnapshot | null = null;
  if (stripeConfigured && id) {
    const cached = options?.cache?.get(id);
    if (options?.cache && options.cache.has(id)) {
      account = cached ?? null;
    } else {
      try {
        account = await stripe.accounts.retrieve(id);
      } catch {
        account = null;
      }
      options?.cache?.set(id, account);
    }
  }
  return cardPaymentOffer({
    stripeConfigured,
    serviceFeeConfigured: serviceFeeUsd !== null && serviceFeeUsd !== undefined,
    connectedAccountId: id,
    account,
  });
}
