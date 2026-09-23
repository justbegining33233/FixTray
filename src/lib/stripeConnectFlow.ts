import prisma from '@/lib/prisma';
import stripe from '@/lib/stripe';
import { shopCanReceiveConnectTransfer } from '@/lib/stripeConnectSplit';
import {
  accountLinkType,
  appBaseUrl,
  connectRefreshUrl,
  connectReturnPath,
  expressAccountCreateParams,
  isMissingStripeAccount,
  isStripeAccountId,
  isStripeAccountLinkUrl,
  publicConnectStatus,
  shopConnectUiState,
  stripePlatformConfigured,
  type ConnectReturnOrigin,
  type ShopConnectPublicStatus,
} from '@/lib/stripeConnectOnboarding';

export class StripeConnectHttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function getShopStripeConnectStatus(shopId: string): Promise<ShopConnectPublicStatus> {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { stripeAccountId: true },
  });
  if (!shop) throw new StripeConnectHttpError('Shop not found', 404);

  const platformConfigured = stripePlatformConfigured();
  const storedId = isStripeAccountId(shop.stripeAccountId) ? shop.stripeAccountId.trim() : '';

  if (!platformConfigured || !storedId) {
    return publicConnectStatus({
      platformConfigured,
      connected: false,
      payoutsReady: false,
      state: shopConnectUiState({
        platformConfigured,
        stripeAccountId: storedId,
        payoutsReady: false,
      }),
    });
  }

  try {
    const account = await stripe.accounts.retrieve(storedId);
    const payoutsReady = shopCanReceiveConnectTransfer(account);
    return publicConnectStatus({
      platformConfigured: true,
      connected: true,
      payoutsReady,
      state: shopConnectUiState({
        platformConfigured: true,
        stripeAccountId: storedId,
        payoutsReady,
      }),
    });
  } catch (err) {
    if (isMissingStripeAccount(err)) {
      return publicConnectStatus({
        platformConfigured: true,
        connected: false,
        payoutsReady: false,
        state: 'not_connected',
      });
    }
    console.error('[stripe/connect/status] Could not read connected account');
    return publicConnectStatus({
      platformConfigured: true,
      connected: true,
      payoutsReady: false,
      state: 'finish_onboarding',
    });
  }
}

async function ensureExpressAccount(shop: {
  id: string;
  email: string | null;
  stripeAccountId: string | null;
}): Promise<{ accountId: string; payoutsReady: boolean }> {
  let accountId = isStripeAccountId(shop.stripeAccountId) ? shop.stripeAccountId.trim() : '';

  if (accountId) {
    try {
      const account = await stripe.accounts.retrieve(accountId);
      return { accountId, payoutsReady: shopCanReceiveConnectTransfer(account) };
    } catch (err) {
      if (!isMissingStripeAccount(err)) throw err;
      accountId = '';
    }
  }

  const created = await stripe.accounts.create(expressAccountCreateParams(shop));
  if (!isStripeAccountId(created.id)) {
    throw new StripeConnectHttpError('Stripe did not return a connected account id.', 502);
  }
  accountId = created.id;
  await prisma.shop.update({
    where: { id: shop.id },
    data: { stripeAccountId: accountId },
  });
  return { accountId, payoutsReady: shopCanReceiveConnectTransfer(created) };
}

export async function createShopAccountLink(
  accountId: string,
  shopId: string,
  origin: ConnectReturnOrigin,
  payoutsReady: boolean,
): Promise<string> {
  const appUrl = appBaseUrl();
  const refresh_url = connectRefreshUrl(appUrl, shopId, origin);
  const return_url = connectReturnPath(origin, appUrl, 'return');
  const primary = accountLinkType(payoutsReady);
  const secondary = primary === 'account_onboarding' ? 'account_update' : 'account_onboarding';

  const create = (type: 'account_onboarding' | 'account_update') =>
    stripe.accountLinks.create({
      account: accountId,
      refresh_url,
      return_url,
      type,
    });

  try {
    const link = await create(primary);
    if (!isStripeAccountLinkUrl(link.url)) {
      throw new StripeConnectHttpError('Stripe returned an unexpected onboarding link.', 502);
    }
    return link.url;
  } catch (err) {
    if (err instanceof StripeConnectHttpError || isMissingStripeAccount(err)) throw err;
    const link = await create(secondary);
    if (!isStripeAccountLinkUrl(link.url)) {
      throw new StripeConnectHttpError('Stripe returned an unexpected onboarding link.', 502);
    }
    return link.url;
  }
}

export async function startShopStripeConnect(
  shopId: string,
  origin: ConnectReturnOrigin,
): Promise<{ url: string }> {
  if (!stripePlatformConfigured()) {
    throw new StripeConnectHttpError('Stripe is not configured for this platform.', 503);
  }

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { id: true, email: true, stripeAccountId: true },
  });
  if (!shop) throw new StripeConnectHttpError('Shop not found', 404);

  const { accountId, payoutsReady } = await ensureExpressAccount(shop);
  const url = await createShopAccountLink(accountId, shop.id, origin, payoutsReady);
  return { url };
}
