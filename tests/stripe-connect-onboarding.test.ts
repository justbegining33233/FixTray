import { describe, it, expect } from '@jest/globals';
import { canConnectIntegration } from '../src/lib/integrationConnect';
import {
  integrationEnabledFromBody,
  integrationSettingsForStorage,
  normalizeIntegrationConfig,
} from '../src/lib/integrationConfigShape';
import {
  accountLinkType,
  connectActionLabel,
  connectRefreshUrl,
  connectReturnPath,
  expressAccountCreateParams,
  isStripeAccountId,
  isStripeAccountLinkUrl,
  parseConnectOrigin,
  parseOAuthState,
  publicConnectStatus,
  shopConnectUiState,
  stripeConnectControlAvailable,
  stripePlatformConfigured,
} from '../src/lib/stripeConnectOnboarding';
import { buildConnectDestinationSplit } from '../src/lib/stripeConnectSplit';

describe('shop Stripe Connect UI state', () => {
  it('lets a shop connect when platform keys exist, even if the integration toggle is off', () => {
    expect(canConnectIntegration(false)).toBe(false);
    expect(stripeConnectControlAvailable(true)).toBe(true);
    expect(stripeConnectControlAvailable(false)).toBe(false);
    expect(stripePlatformConfigured(' sk_test_123 ')).toBe(true);
    expect(stripePlatformConfigured('   ')).toBe(false);
    expect(stripePlatformConfigured(null)).toBe(false);
    expect(stripePlatformConfigured('')).toBe(false);
  });

  it('shows not connected, finish onboarding, or ready from the shop account', () => {
    expect(shopConnectUiState({
      platformConfigured: true,
      stripeAccountId: null,
      payoutsReady: false,
    })).toBe('not_connected');
    expect(shopConnectUiState({
      platformConfigured: true,
      stripeAccountId: 'acct_shop123',
      payoutsReady: false,
    })).toBe('finish_onboarding');
    expect(shopConnectUiState({
      platformConfigured: true,
      stripeAccountId: 'acct_shop123',
      payoutsReady: true,
    })).toBe('ready');
    expect(shopConnectUiState({
      platformConfigured: false,
      stripeAccountId: 'acct_shop123',
      payoutsReady: true,
    })).toBe('platform_unconfigured');
    expect(shopConnectUiState({
      platformConfigured: true,
      stripeAccountId: 'not-an-account',
      payoutsReady: true,
    })).toBe('not_connected');
    expect(connectActionLabel('not_connected')).toBe('Connect with Stripe');
    expect(connectActionLabel('finish_onboarding')).toBe('Resume onboarding');
    expect(connectActionLabel('ready')).toBe('Update payout account');
  });

  it('does not put the connected account id on the public status', () => {
    const status = publicConnectStatus({
      platformConfigured: true,
      connected: true,
      payoutsReady: false,
      state: 'finish_onboarding',
    });
    expect(status).toEqual({
      platformConfigured: true,
      connected: true,
      payoutsReady: false,
      state: 'finish_onboarding',
      label: 'Finish onboarding',
    });
    expect(status).not.toHaveProperty('stripeAccountId');
  });
});

describe('Stripe Connect account links', () => {
  it('creates an Express account that can receive transfers and returns to the page that started it', () => {
    expect(expressAccountCreateParams({ id: 'shop_1', email: 'owner@shop.test' })).toEqual({
      type: 'express',
      country: 'US',
      email: 'owner@shop.test',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { shopId: 'shop_1' },
    });
    expect(expressAccountCreateParams({ id: 'shop_1', email: '  ' }).email).toBeUndefined();
    expect(accountLinkType(false)).toBe('account_onboarding');
    expect(accountLinkType(true)).toBe('account_update');
    expect(isStripeAccountId('acct_abc123')).toBe(true);
    expect(isStripeAccountId('acct_')).toBe(false);

    expect(connectReturnPath('integrations', 'https://fixtray.app/', 'return'))
      .toBe('https://fixtray.app/shop/integrations?stripe_connect=return');
    expect(connectReturnPath('settings', 'https://fixtray.app', 'error'))
      .toBe('https://fixtray.app/shop/settings?stripe_connect=error&tab=payments');
    expect(connectReturnPath('onboarding', 'https://fixtray.app', 'return'))
      .toBe('https://fixtray.app/shop/complete-profile?stripe_connect=return');

    const refresh = connectRefreshUrl('https://fixtray.app', 'clshop1234', 'integrations');
    expect(refresh).toContain('/api/stripe/connect/refresh?');
    expect(refresh).toContain('shopId=clshop1234');
    expect(refresh).toContain('from=integrations');
    expect(parseConnectOrigin('settings')).toBe('settings');
    expect(parseConnectOrigin('nope')).toBe('integrations');
    expect(parseOAuthState('shop_1:onboarding')).toEqual({ shopId: 'shop_1', origin: 'onboarding' });
    expect(parseOAuthState('shop_1')).toEqual({ shopId: 'shop_1', origin: 'settings' });
    expect(isStripeAccountLinkUrl('https://connect.stripe.com/setup/e/acct_123/abc')).toBe(true);
    expect(isStripeAccountLinkUrl('https://evil.example/connect.stripe.com')).toBe(false);
  });

  it('still refuses a platform-only charge when the shop has no Connect account', () => {
    const split = buildConnectDestinationSplit({
      quoteUsd: 80,
      serviceFeeUsd: 10,
      connectedAccountId: null,
    });
    expect(split.ok).toBe(false);
    if (split.ok) return;
    expect(split.status).toBe(409);
    expect(split).not.toHaveProperty('paymentIntentData');
  });
});

describe('integration config shape', () => {
  it('reads enabled and JSON settings so a saved integration is not stuck Disabled', () => {
    const view = normalizeIntegrationConfig({
      id: 'cfg_1',
      provider: 'quickbooks',
      enabled: true,
      settings: JSON.stringify({ clientId: 'abc', clientSecret: 'secret' }),
      lastSyncAt: '2026-09-01T00:00:00.000Z',
    });
    expect(view.isEnabled).toBe(true);
    expect(view.enabled).toBe(true);
    expect(view.settings).toEqual({ clientId: 'abc', clientSecret: 'secret' });
    expect(view.lastSync).toBe('2026-09-01T00:00:00.000Z');
    expect(integrationEnabledFromBody({ isEnabled: true })).toBe(true);
    expect(integrationEnabledFromBody({ enabled: false, isEnabled: true })).toBe(false);
    expect(integrationSettingsForStorage({ clientId: 'abc' })).toBe('{"clientId":"abc"}');
  });

  it('does not echo stored Stripe secrets back to the shop UI', () => {
    const view = normalizeIntegrationConfig({
      provider: 'stripe',
      enabled: true,
      settings: JSON.stringify({ secretKey: 'sk_live_secret' }),
      accountId: 'acct_should_not_leak',
    });
    expect(view.settings).toEqual({});
    expect(view.accountId).toBeNull();
  });
});
