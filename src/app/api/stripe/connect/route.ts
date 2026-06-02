import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import stripe from '@/lib/stripe';
import prisma from '@/lib/prisma';

/**
 * GET /api/stripe/connect
 * Creates (or resumes) a Stripe Express account for the shop and returns an
 * Account Link URL so the owner can complete Stripe's hosted onboarding.
 * Does NOT require STRIPE_CLIENT_ID — only STRIPE_SECRET_KEY.
 */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== 'shop') {
    return NextResponse.json({ error: 'Only shop accounts can connect Stripe' }, { status: 403 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fixtray.app';

  const successRedirect = `${appUrl}/shop/settings?stripe_connect=success&tab=general`;

  try {
    // Look up the shop so we can check for an existing Stripe account
    const shop = await prisma.shop.findUnique({ where: { id: auth.id }, select: { stripeAccountId: true, email: true } });
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

    let accountId = shop.stripeAccountId;

    // Create a new Express account if the shop doesn't have one yet
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: shop.email || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { shopId: auth.id },
      });
      accountId = account.id;

      // Persist immediately so the refresh URL can look it up
      await prisma.shop.update({
        where: { id: auth.id },
        data: { stripeAccountId: accountId },
      });
    }

    // Generate a one-time Account Link for onboarding (or resuming it)
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/api/stripe/connect/refresh?shopId=${auth.id}`,
      return_url: successRedirect,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });
    } catch (err: unknown) {
      console.error('[stripe/connect] Error creating account link:', err);
      return NextResponse.json({ error: (err as Error)?.message || 'Failed to start Stripe Connect' }, { status: 500 });
  }
}
