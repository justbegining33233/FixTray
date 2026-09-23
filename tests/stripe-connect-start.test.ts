import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    shop: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../src/lib/stripe', () => ({
  __esModule: true,
  default: {
    accounts: {
      create: jest.fn(),
      retrieve: jest.fn(),
      createLoginLink: jest.fn(),
    },
    accountLinks: {
      create: jest.fn(),
    },
  },
}));

import prisma from '../src/lib/prisma';
import stripe from '../src/lib/stripe';
import { startShopStripeConnect, StripeConnectHttpError } from '../src/lib/stripeConnectFlow';

const LOSSES_ERROR = new Error(
  'Please review the responsibilities of managing losses for connected accounts at https://dashboard.stripe.com/settings/connect/platform-profile.',
);

const ACCOUNT_LINK = 'https://connect.stripe.com/setup/s/acct_newshop/session';

describe('startShopStripeConnect', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
    process.env.NEXT_PUBLIC_APP_URL = 'https://fixtray.app';
    jest.clearAllMocks();
    (prisma.shop.findUnique as jest.Mock).mockResolvedValue({
      id: 'shop_1',
      email: 'owner@shop.test',
      stripeAccountId: null,
    });
    (prisma.shop.update as jest.Mock).mockResolvedValue({});
    (stripe.accountLinks.create as jest.Mock).mockResolvedValue({ url: ACCOUNT_LINK });
  });

  it('creates a Standard account and returns an Account Link for a shop that is not connected', async () => {
    (stripe.accounts.create as jest.Mock).mockResolvedValue({
      id: 'acct_newshop',
      capabilities: { transfers: 'inactive' },
    });

    const result = await startShopStripeConnect('shop_1', 'settings');

    expect(result).toEqual({ url: ACCOUNT_LINK });
    expect(stripe.accounts.create).toHaveBeenCalledTimes(1);
    expect(stripe.accounts.create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'standard',
      country: 'US',
      email: 'owner@shop.test',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { shopId: 'shop_1' },
    }));
    expect(prisma.shop.update).toHaveBeenCalledWith({
      where: { id: 'shop_1' },
      data: { stripeAccountId: 'acct_newshop' },
    });
    expect(stripe.accountLinks.create).toHaveBeenCalledWith(expect.objectContaining({
      account: 'acct_newshop',
      type: 'account_onboarding',
      refresh_url: expect.stringContaining('/api/stripe/connect/refresh?'),
      return_url: 'https://fixtray.app/shop/settings?stripe_connect=return&tab=payments',
    }));
    expect(stripe.accounts.createLoginLink).not.toHaveBeenCalled();
  });

  it('keeps trying after Stripe rejects a shape for unacknowledged loss liability', async () => {
    (stripe.accounts.create as jest.Mock)
      .mockRejectedValueOnce(LOSSES_ERROR)
      .mockResolvedValueOnce({
        id: 'acct_newshop',
        capabilities: { transfers: 'inactive' },
      });

    const result = await startShopStripeConnect('shop_1', 'integrations');

    expect(result.url).toBe(ACCOUNT_LINK);
    expect(stripe.accounts.create).toHaveBeenCalledTimes(2);
    const second = (stripe.accounts.create as jest.Mock).mock.calls[1][0];
    expect(second.type).toBe('standard');
    expect(second.capabilities).toEqual({ transfers: { requested: true } });
    expect(second.controller?.losses?.payments).not.toBe('application');
    expect(stripe.accountLinks.create).toHaveBeenCalledWith(expect.objectContaining({
      return_url: 'https://fixtray.app/shop/integrations?stripe_connect=return',
    }));
  });

  it('returns 502 with the Stripe message only after every shape is rejected', async () => {
    (stripe.accounts.create as jest.Mock).mockRejectedValue(LOSSES_ERROR);

    const failed = startShopStripeConnect('shop_1', 'settings');
    await expect(failed).rejects.toBeInstanceOf(StripeConnectHttpError);
    await expect(failed).rejects.toMatchObject({
      message: LOSSES_ERROR.message,
      status: 502,
    });
    expect(stripe.accountLinks.create).not.toHaveBeenCalled();
  });
});
