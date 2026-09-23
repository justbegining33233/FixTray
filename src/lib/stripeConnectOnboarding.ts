/**
 * Shop Stripe Connect onboarding helpers.
 *
 * Platform keys (STRIPE_SECRET_KEY) create a connected account and an Account
 * Link. Shops do not paste their own secret keys. Checkout still refuses a
 * charge until transfers are active — see shopCanReceiveConnectTransfer.
 *
 * Express (`type=express`) assigns negative-balance liability to the platform.
 * Stripe rejects that create until someone reviews "managing losses" at
 * Settings → Connect → Platform profile, which is the production 502.
 * Standard accounts leave that liability with Stripe and still onboard
 * through an Account Link.
 */

export type ConnectReturnOrigin = 'integrations' | 'settings' | 'onboarding';

export type ShopConnectUiState =
  | 'platform_unconfigured'
  | 'not_connected'
  | 'finish_onboarding'
  | 'ready';

const ORIGINS = new Set<ConnectReturnOrigin>(['integrations', 'settings', 'onboarding']);

export function stripePlatformConfigured(secretKey?: string | null): boolean {
  const value = secretKey === undefined ? process.env.STRIPE_SECRET_KEY : secretKey;
  return Boolean(value && value.trim().length > 0);
}

/** True when a shop may start or resume Connect. The generic integration toggle must not block this. */
export function stripeConnectControlAvailable(platformConfigured: boolean): boolean {
  return platformConfigured === true;
}

export function isStripeAccountId(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^acct_[A-Za-z0-9]+$/.test(value.trim());
}

export function parseConnectOrigin(
  value: string | null | undefined,
  fallback: ConnectReturnOrigin = 'integrations',
): ConnectReturnOrigin {
  if (value && ORIGINS.has(value as ConnectReturnOrigin)) return value as ConnectReturnOrigin;
  return fallback;
}

/** OAuth callback state is "shopId:origin". Older links omit the origin and return to settings. */
export function parseOAuthState(raw: string | null | undefined): { shopId: string; origin: ConnectReturnOrigin } {
  const value = (raw ?? '').trim();
  const idx = value.indexOf(':');
  if (idx === -1) return { shopId: value, origin: 'settings' };
  return {
    shopId: value.slice(0, idx).trim(),
    origin: parseConnectOrigin(value.slice(idx + 1), 'settings'),
  };
}

const DEFAULT_APP_ORIGIN = 'https://fixtray.app';

/**
 * Absolute origin for Account Link return and refresh URLs.
 * Stripe live mode rejects non-HTTPS redirects, and a bare host
 * (fixtray.app) is not a valid URL. Localhost may stay on HTTP.
 */
export function appBaseUrl(configuredUrl?: string | null): string {
  const raw = (configuredUrl === undefined ? process.env.NEXT_PUBLIC_APP_URL : configuredUrl)?.trim() || '';
  const candidate = raw ? (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`) : DEFAULT_APP_ORIGIN;
  try {
    const parsed = new URL(candidate);
    const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return DEFAULT_APP_ORIGIN;
    if (parsed.protocol !== 'https:' && !local) parsed.protocol = 'https:';
    return parsed.origin;
  } catch {
    return DEFAULT_APP_ORIGIN;
  }
}

export function connectReturnPath(
  origin: ConnectReturnOrigin,
  appUrl: string,
  outcome: 'return' | 'error',
): string {
  const base = appUrl.replace(/\/$/, '');
  const flag = outcome === 'error' ? 'error' : 'return';
  if (origin === 'onboarding') return `${base}/shop/complete-profile?stripe_connect=${flag}`;
  if (origin === 'settings') return `${base}/shop/settings?stripe_connect=${flag}&tab=payments`;
  return `${base}/shop/integrations?stripe_connect=${flag}`;
}

export function connectRefreshUrl(appUrl: string, shopId: string, origin: ConnectReturnOrigin): string {
  const base = appUrl.replace(/\/$/, '');
  const params = new URLSearchParams({ shopId, from: origin });
  return `${base}/api/stripe/connect/refresh?${params.toString()}`;
}

export function isStripeAccountLinkUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'connect.stripe.com';
  } catch {
    return false;
  }
}

export function shopConnectUiState(input: {
  platformConfigured: boolean;
  stripeAccountId: string | null | undefined;
  payoutsReady: boolean;
}): ShopConnectUiState {
  if (!input.platformConfigured) return 'platform_unconfigured';
  if (!isStripeAccountId(input.stripeAccountId)) return 'not_connected';
  if (!input.payoutsReady) return 'finish_onboarding';
  return 'ready';
}

export function connectStatusLabel(state: ShopConnectUiState): string {
  switch (state) {
    case 'ready':
      return 'Connected';
    case 'finish_onboarding':
      return 'Finish onboarding';
    case 'platform_unconfigured':
      return 'Unavailable';
    default:
      return 'Not connected';
  }
}

export function connectStatusDetail(state: ShopConnectUiState): string {
  switch (state) {
    case 'ready':
      return 'Ready to receive payouts. Customer payments transfer to this account. FixTray keeps only the service fee.';
    case 'finish_onboarding':
      return 'Stripe still needs information before this account can receive transfers. Resume onboarding to finish.';
    case 'platform_unconfigured':
      return 'Connect is unavailable until the platform Stripe secret key is configured. This is not a shop toggle.';
    default:
      return 'Connect Stripe so this shop can receive work-order payouts. Platform keys are used — do not paste a secret key.';
  }
}

export function connectActionLabel(state: ShopConnectUiState): string {
  switch (state) {
    case 'ready':
      return 'Update payout account';
    case 'finish_onboarding':
      return 'Resume onboarding';
    case 'platform_unconfigured':
      return 'Connect unavailable';
    default:
      return 'Connect with Stripe';
  }
}

export interface ShopConnectPublicStatus {
  platformConfigured: boolean;
  connected: boolean;
  payoutsReady: boolean;
  state: ShopConnectUiState;
  label: string;
}

/** Client-safe status. Never includes the connected account id. */
export function publicConnectStatus(input: {
  platformConfigured: boolean;
  connected: boolean;
  payoutsReady: boolean;
  state: ShopConnectUiState;
}): ShopConnectPublicStatus {
  return {
    platformConfigured: input.platformConfigured,
    connected: input.connected,
    payoutsReady: input.payoutsReady,
    state: input.state,
    label: connectStatusLabel(input.state),
  };
}

export function connectShopEmail(email?: string | null): string | undefined {
  const value = email?.trim();
  if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return undefined;
  return value;
}

export type ConnectAccountCreateParams = {
  type?: 'express' | 'standard';
  country: 'US';
  email?: string;
  metadata: { shopId: string };
  capabilities?: {
    card_payments?: { requested: true };
    transfers?: { requested: true };
  };
  controller?: {
    fees: { payer: 'application' | 'account' };
    losses: { payments: 'application' | 'stripe' };
    stripe_dashboard: { type: 'express' | 'full' };
  };
};

type ConnectShopIdentity = { id: string; email?: string | null };

function connectAccountIdentity(shop: ConnectShopIdentity): {
  country: 'US';
  email?: string;
  metadata: { shopId: string };
} {
  const email = connectShopEmail(shop.email);
  return {
    country: 'US',
    ...(email ? { email } : {}),
    metadata: { shopId: shop.id },
  };
}

/** Standard account: Stripe holds connected-account loss liability, so no platform-profile review is required. */
export function standardAccountCreateParams(shop: ConnectShopIdentity): {
  type: 'standard';
  country: 'US';
  email?: string;
  capabilities: {
    card_payments: { requested: true };
    transfers: { requested: true };
  };
  metadata: { shopId: string };
} {
  return {
    type: 'standard',
    ...connectAccountIdentity(shop),
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  };
}

/** Classic Express shape. Only succeeds after the platform acknowledges loss liability. */
export function expressAccountCreateParams(shop: ConnectShopIdentity): {
  type: 'express';
  country: 'US';
  email?: string;
  capabilities: {
    card_payments: { requested: true };
    transfers: { requested: true };
  };
  metadata: { shopId: string };
} {
  return {
    type: 'express',
    ...connectAccountIdentity(shop),
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  };
}

/**
 * Ordered connected-account create payloads.
 * Leading payloads are Standard (losses stay with Stripe) so a shop that is
 * Not connected can get an Account Link without the platform-profile review.
 * Later payloads keep Express for platforms that have completed that review
 * and reject Standard, including transfers-only and controller shapes.
 */
export function connectAccountCreateAttempts(shop: ConnectShopIdentity): ConnectAccountCreateParams[] {
  const standard = standardAccountCreateParams(shop);
  const express = expressAccountCreateParams(shop);
  const identity = connectAccountIdentity(shop);
  const transfersOnly = { transfers: { requested: true as const } };
  const stripeLiableExpress = {
    fees: { payer: 'account' as const },
    losses: { payments: 'stripe' as const },
    stripe_dashboard: { type: 'express' as const },
  };
  const platformLiableExpress = {
    fees: { payer: 'application' as const },
    losses: { payments: 'application' as const },
    stripe_dashboard: { type: 'express' as const },
  };
  return [
    standard,
    { ...identity, type: 'standard', capabilities: transfersOnly },
    { ...identity, type: 'standard' },
    { ...identity, controller: stripeLiableExpress, capabilities: standard.capabilities },
    { ...identity, controller: stripeLiableExpress, capabilities: transfersOnly },
    express,
    { ...identity, type: 'express', capabilities: transfersOnly },
    { ...identity, type: 'express' },
    { ...identity, controller: platformLiableExpress, capabilities: express.capabilities },
    { ...identity, controller: platformLiableExpress, capabilities: transfersOnly },
  ];
}

export function errorText(err: unknown): string {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || '';
  if (typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return '';
}

/**
 * True when another account-create shape might be accepted.
 * Auth and platform-setup errors are not retried.
 * The platform-profile "managing losses" error is retried: it rejects every
 * Express shape that assigns loss liability to the platform, and a later
 * Standard shape does not.
 */
export function shouldRetryExpressAccountCreate(err: unknown): boolean {
  const message = errorText(err).toLowerCase();
  if (!message) return false;
  if (
    message.includes('signed up for connect') ||
    message.includes('api key') ||
    message.includes('expired api key') ||
    message.includes('rate limit')
  ) {
    return false;
  }
  return (
    message.includes('capabilit') ||
    message.includes('controller') ||
    message.includes('card_payments') ||
    message.includes('transfers') ||
    message.includes('recipient') ||
    message.includes('unknown parameter') ||
    message.includes('account type') ||
    message.includes('unsupported') ||
    message.includes('not supported') ||
    message.includes('managing losses') ||
    message.includes('platform-profile') ||
    message.includes('platform profile') ||
    message.includes('responsibilit') ||
    message.includes('standard') ||
    message.includes('express')
  );
}

const STRIPE_SECRET_PATTERN = /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]+|\bwhsec_[A-Za-z0-9]+/g;

/** Shop-facing Connect failure. Never includes a platform secret. */
export function connectFailureMessage(err: unknown): string {
  const raw = errorText(err).replace(STRIPE_SECRET_PATTERN, '[redacted]').replace(/\s+/g, ' ').trim();
  if (!raw) {
    return 'Stripe could not start Connect. Confirm the platform secret key can create connected accounts, then try again.';
  }
  if (/signed up for connect/i.test(raw)) {
    return 'Stripe Connect is not enabled on the platform account. Turn on Connect in the Stripe Dashboard, then try again.';
  }
  if (/https/i.test(raw) && /redirect/i.test(raw)) {
    return 'Stripe rejected the return URL because it is not HTTPS. Set NEXT_PUBLIC_APP_URL to https://fixtray.app and try again.';
  }
  return raw.length > 240 ? `${raw.slice(0, 237)}...` : raw;
}

/**
 * Express accounts use hosted onboarding. account_update links are rejected
 * for Express dashboards and were masking the real Stripe error.
 * A payout-ready account opens the Express dashboard (login link) first.
 */
export function expressLinkPlan(payoutsReady: boolean): Array<'login' | 'account_onboarding'> {
  return payoutsReady ? ['login', 'account_onboarding'] : ['account_onboarding'];
}

export function isNullableColumnReadError(err: unknown): boolean {
  const text = errorText(err).toLowerCase();
  return text.includes('incompatible value of null') || text.includes('inconsistent column data');
}

/** Incomplete accounts stay on hosted onboarding. Ready accounts open the update form. */
export function accountLinkType(payoutsReady: boolean): 'account_onboarding' | 'account_update' {
  return payoutsReady ? 'account_update' : 'account_onboarding';
}

export function isMissingStripeAccount(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = 'code' in err ? String((err as { code?: unknown }).code || '') : '';
  const statusCode = 'statusCode' in err ? Number((err as { statusCode?: unknown }).statusCode) : 0;
  return code === 'resource_missing' || code === 'account_invalid' || statusCode === 404;
}
