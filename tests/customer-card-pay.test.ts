import { describe, expect, it } from '@jest/globals';
import { SHOP_CANNOT_TAKE_CARDS, cardPaymentOffer, customerSeesPayButton } from '../src/lib/customerCardPay';
import { shopCanReceiveConnectTransfer } from '../src/lib/stripeConnectSplit';

const auditInvoice = {
  paymentStatus: 'pending',
  status: 'waiting-for-payment',
  totalDue: 23.5,
};

/** The work-order page offered Pay from the invoice alone, then Checkout returned the payout error. */
function payButtonBeforeThisChange(input: typeof auditInvoice): boolean {
  return input.paymentStatus !== 'paid'
    && !['completed', 'closed', 'cancelled', 'canceled', 'denied-estimate'].includes(input.status)
    && input.totalDue > 0;
}

describe('customer Pay before Checkout', () => {
  it('does not offer Pay when Stripe says the shop cannot receive the transfer', () => {
    const account = { capabilities: { transfers: 'pending' as const }, payouts_enabled: false };
    expect(shopCanReceiveConnectTransfer(account)).toBe(false);
    expect(payButtonBeforeThisChange(auditInvoice)).toBe(true);

    const offer = cardPaymentOffer({
      stripeConfigured: true,
      serviceFeeConfigured: true,
      connectedAccountId: 'acct_auditshop',
      account,
    });
    expect(offer.available).toBe(false);
    expect(offer.message).toBe(SHOP_CANNOT_TAKE_CARDS);
    expect(offer.message).not.toContain('Finish Connect onboarding');
    expect(customerSeesPayButton({ ...auditInvoice, cardPaymentAvailable: offer.available })).toBe(false);
  });

  it('still offers Pay when the connected account can receive transfers', () => {
    const account = { capabilities: { transfers: 'active' as const }, payouts_enabled: true };
    expect(shopCanReceiveConnectTransfer(account)).toBe(true);
    const offer = cardPaymentOffer({
      stripeConfigured: true,
      serviceFeeConfigured: true,
      connectedAccountId: 'acct_ready',
      account,
    });
    expect(offer).toEqual({ available: true, message: null });
    expect(customerSeesPayButton({ ...auditInvoice, cardPaymentAvailable: true })).toBe(true);
  });

  it('fails closed when the fee, Stripe keys, or destination are missing', () => {
    expect(cardPaymentOffer({
      stripeConfigured: false,
      serviceFeeConfigured: true,
      connectedAccountId: 'acct_ready',
      account: { capabilities: { transfers: 'active' } },
    }).available).toBe(false);
    expect(cardPaymentOffer({
      stripeConfigured: true,
      serviceFeeConfigured: false,
      connectedAccountId: 'acct_ready',
      account: { capabilities: { transfers: 'active' } },
    }).available).toBe(false);
    expect(cardPaymentOffer({
      stripeConfigured: true,
      serviceFeeConfigured: true,
      connectedAccountId: null,
      account: { payouts_enabled: true },
    }).available).toBe(false);
    expect(cardPaymentOffer({
      stripeConfigured: true,
      serviceFeeConfigured: true,
      connectedAccountId: 'acct_ready',
      account: null,
    }).available).toBe(false);
  });

  it('does not treat a paid invoice as a new Pay offer', () => {
    expect(customerSeesPayButton({
      paymentStatus: 'paid',
      status: 'waiting-for-payment',
      totalDue: 23.5,
      cardPaymentAvailable: true,
    })).toBe(false);
  });
});
