import stripe from '@/lib/stripe';

export async function createFeeSettlementCheckout(input: {
  shopId: string;
  shopEmail?: string | null;
  owedCents: number;
  weekLabel: string;
  appUrl: string;
}): Promise<{ ok: true; url: string } | { ok: false; status: number; error: string }> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { ok: false, status: 503, error: 'Card payments are not configured.' };
  }
  if (input.owedCents <= 0) {
    return { ok: false, status: 400, error: 'There is no FixTray fee to pay this week.' };
  }
  const appUrl = input.appUrl.replace(/\/$/, '');
  const metadata = {
    kind: 'fixtray_fee_settlement',
    shopId: input.shopId,
    weekLabel: input.weekLabel,
    owedCents: String(input.owedCents),
  };
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: input.shopEmail || undefined,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `FixTray fee ${input.weekLabel}`,
            description: 'In-person payments. The shop owes FixTray this platform fee. It is not taken from the shop job.',
          },
          unit_amount: input.owedCents,
        },
        quantity: 1,
      },
    ],
    metadata,
    success_url: `${appUrl}/shop/books?fee=paid`,
    cancel_url: `${appUrl}/shop/books?fee=cancelled`,
    payment_intent_data: { metadata },
  });
  if (!session.url) return { ok: false, status: 500, error: 'Failed to create checkout session' };
  return { ok: true, url: session.url };
}
