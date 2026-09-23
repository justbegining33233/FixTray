import type Stripe from 'stripe';
import prisma from '@/lib/prisma';
import stripe from '@/lib/stripe';
import { shopCanReceiveConnectTransfer } from '@/lib/stripeConnectSplit';
import {
  appBaseUrl,
  connectFailureMessage,
  connectRefreshUrl,
  connectReturnPath,
  expressAccountCreateAttempts,
  expressLinkPlan,
  isMissingStripeAccount,
  isNullableColumnReadError,
  isStripeAccountId,
  isStripeAccountLinkUrl,
  publicConnectStatus,
  shopConnectUiState,
  shouldRetryExpressAccountCreate,
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

async function createExpressAccount(shop: {
  id: string;
  email: string | null;
}): Promise<{ accountId: string; payoutsReady: boolean }> {
  const attempts = expressAccountCreateAttempts(shop);
  let lastError: unknown;

  for (let i = 0; i < attempts.length; i += 1) {
    try {
      const created = await stripe.accounts.create(attempts[i] as Stripe.AccountCreateParams);
      if (!isStripeAccountId(created.id)) {
        throw new StripeConnectHttpError('Stripe did not return a connected account id.', 502);
      }
      try {
        await prisma.shop.update({
          where: { id: shop.id },
          data: { stripeAccountId: created.id },
        });
      } catch (err) {
        throw new StripeConnectHttpError(connectFailureMessage(err), 502);
      }
      return { accountId: created.id, payoutsReady: shopCanReceiveConnectTransfer(created) };
    } catch (err) {
      if (err instanceof StripeConnectHttpError) throw err;
      lastError = err;
      if (i === attempts.length - 1 || !shouldRetryExpressAccountCreate(err)) break;
    }
  }

  throw new StripeConnectHttpError(connectFailureMessage(lastError), 502);
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
      if (!isMissingStripeAccount(err)) {
        throw new StripeConnectHttpError(connectFailureMessage(err), 502);
      }
      accountId = '';
    }
  }

  return createExpressAccount(shop);
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
  const plan = expressLinkPlan(payoutsReady);
  let lastError: unknown;

  for (const step of plan) {
    try {
      if (step === 'login') {
        const login = await stripe.accounts.createLoginLink(accountId);
        if (isStripeAccountLinkUrl(login.url)) return login.url;
        lastError = new Error('Stripe returned an unexpected dashboard link.');
        continue;
      }

      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url,
        return_url,
        type: 'account_onboarding',
      });
      if (!isStripeAccountLinkUrl(link.url)) {
        throw new StripeConnectHttpError('Stripe returned an unexpected onboarding link.', 502);
      }
      return link.url;
    } catch (err) {
      if (err instanceof StripeConnectHttpError || isMissingStripeAccount(err)) throw err;
      lastError = err;
    }
  }

  throw new StripeConnectHttpError(connectFailureMessage(lastError), 502);
}

async function loadShopForConnect(shopId: string): Promise<{
  id: string;
  email: string | null;
  stripeAccountId: string | null;
} | null> {
  try {
    return await prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, email: true, stripeAccountId: true },
    });
  } catch (err) {
    if (!isNullableColumnReadError(err)) throw err;
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, stripeAccountId: true },
    });
    return shop ? { ...shop, email: null } : null;
  }
}

export async function startShopStripeConnect(
  shopId: string,
  origin: ConnectReturnOrigin,
): Promise<{ url: string }> {
  if (!stripePlatformConfigured()) {
    throw new StripeConnectHttpError('Stripe is not configured for this platform.', 503);
  }

  const shop = await loadShopForConnect(shopId);
  if (!shop) throw new StripeConnectHttpError('Shop not found', 404);

  const { accountId, payoutsReady } = await ensureExpressAccount(shop);
  const url = await createShopAccountLink(accountId, shop.id, origin, payoutsReady);
  return { url };
}
