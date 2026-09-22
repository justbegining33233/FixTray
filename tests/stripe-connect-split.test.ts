import { describe, it, expect } from '@jest/globals';
import { invoiceTotal } from '../src/lib/workOrderCloseout';
import {
  buildConnectDestinationSplit,
  destinationChargeParams,
  shopCanReceiveConnectTransfer,
} from '../src/lib/stripeConnectSplit';

describe('Connect destination split', () => {
  it('keeps only the live platform fee and transfers the shop quote', () => {
    const bill = invoiceTotal({ estimatedCost: 1.08 }, 10);
    const split = buildConnectDestinationSplit({
      quoteUsd: bill.quoteAmount,
      serviceFeeUsd: bill.serviceFee,
      connectedAccountId: 'acct_shop_123',
    });

    expect(split.ok).toBe(true);
    if (!split.ok) return;

    expect(bill).toEqual({ quoteAmount: 1.08, serviceFee: 10, amount: 11.08 });
    expect(split.quoteCents).toBe(108);
    expect(split.applicationFeeCents).toBe(1000);
    expect(split.shopPayoutCents).toBe(108);
    expect(split.chargeCents).toBe(1108);
    expect(split.applicationFeeCents + split.shopPayoutCents).toBe(split.chargeCents);
    expect(split.paymentIntentData).toEqual({
      application_fee_amount: 1000,
      transfer_data: { destination: 'acct_shop_123' },
    });
    expect(split.paymentIntentData.transfer_data).not.toHaveProperty('amount');

    const params = destinationChargeParams(split, { workOrderId: 'wo_1' });
    expect(params.amount).toBe(1108);
    expect(params.currency).toBe('usd');
    expect(params.application_fee_amount).toBe(1000);
    expect(params.transfer_data).toEqual({ destination: 'acct_shop_123' });
    expect(params.application_fee_amount).not.toBe(params.amount);
    expect(params.amount - params.application_fee_amount).toBe(split.shopPayoutCents);
    expect(params.metadata).toMatchObject({
      workOrderId: 'wo_1',
      fixtrayServiceFeeCents: '1000',
      shopPayoutCents: '108',
    });
  });

  it('uses the fee passed in, including a non-default amount and a zero fee', () => {
    const sevenFifty = buildConnectDestinationSplit({
      quoteUsd: 250.5,
      serviceFeeUsd: 7.5,
      connectedAccountId: 'acct_shop_456',
    });
    expect(sevenFifty.ok).toBe(true);
    if (!sevenFifty.ok) return;
    expect(sevenFifty.applicationFeeCents).toBe(750);
    expect(sevenFifty.shopPayoutCents).toBe(25050);
    expect(sevenFifty.chargeCents).toBe(25800);

    const noFee = buildConnectDestinationSplit({
      quoteUsd: 40,
      serviceFeeUsd: 0,
      connectedAccountId: 'acct_shop_456',
    });
    expect(noFee.ok).toBe(true);
    if (!noFee.ok) return;
    expect(noFee.applicationFeeCents).toBe(0);
    expect(noFee.shopPayoutCents).toBe(4000);
    expect(noFee.chargeCents).toBe(4000);
    expect(noFee.paymentIntentData.application_fee_amount).toBeUndefined();
    expect(noFee.paymentIntentData.transfer_data).toEqual({
      destination: 'acct_shop_456',
    });
    expect('application_fee_amount' in destinationChargeParams(noFee, {})).toBe(false);
  });

  it('refuses a platform-only charge when the shop has no Connect account', () => {
    for (const connectedAccountId of [undefined, null, '', '   ', 'not-an-account']) {
      const split = buildConnectDestinationSplit({
        quoteUsd: 80,
        serviceFeeUsd: 10,
        connectedAccountId,
      });
      expect(split.ok).toBe(false);
      if (split.ok) continue;
      expect(split.status).toBe(409);
      expect(split).not.toHaveProperty('paymentIntentData');
      expect(split).not.toHaveProperty('chargeCents');
    }
  });

  it('does not build a charge when there is no shop quote', () => {
    const split = buildConnectDestinationSplit({
      quoteUsd: 0,
      serviceFeeUsd: 10,
      connectedAccountId: 'acct_shop_123',
    });
    expect(split).toMatchObject({ ok: false, status: 400 });
  });
});

describe('shopCanReceiveConnectTransfer', () => {
  it('requires an active transfers capability', () => {
    expect(shopCanReceiveConnectTransfer({ capabilities: { transfers: 'active' } })).toBe(true);
    expect(shopCanReceiveConnectTransfer({
      capabilities: { transfers: 'pending' },
      payouts_enabled: true,
    })).toBe(false);
    expect(shopCanReceiveConnectTransfer({ capabilities: { transfers: 'inactive' } })).toBe(false);
  });

  it('accepts payouts_enabled only when the transfers capability is absent', () => {
    expect(shopCanReceiveConnectTransfer({ payouts_enabled: true })).toBe(true);
    expect(shopCanReceiveConnectTransfer({ payouts_enabled: false })).toBe(false);
    expect(shopCanReceiveConnectTransfer(null)).toBe(false);
  });
});
