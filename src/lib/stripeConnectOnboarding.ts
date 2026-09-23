/**
 * Shop Stripe Connect onboarding helpers.
 *
 * Platform keys (STRIPE_SECRET_KEY) create an Express account and an Account
 * Link. Shops do not paste their own secret keys. Checkout still refuses a
 * charge until transfers are active — see shopCanReceiveConnectTransfer.
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

export function appBaseUrl(configuredUrl?: string | null): string {
  const configured = (configuredUrl === undefined ? process.env.NEXT_PUBLIC_APP_URL : configuredUrl)?.trim();
  return (configured && configured.length > 0 ? configured : 'https://fixtray.app').replace(/\/$/, '');
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

export function expressAccountCreateParams(shop: { id: string; email?: string | null }): {
  type: 'express';
  country: 'US';
  email?: string;
  capabilities: {
    card_payments: { requested: true };
    transfers: { requested: true };
  };
  metadata: { shopId: string };
} {
  const email = shop.email?.trim();
  return {
    type: 'express',
    country: 'US',
    ...(email ? { email } : {}),
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { shopId: shop.id },
  };
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
