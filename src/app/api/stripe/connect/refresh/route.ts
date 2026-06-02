import { NextRequest, NextResponse } from 'next/server';
import stripe from '@/lib/stripe';
import prisma from '@/lib/prisma';

/**
 * GET /api/stripe/connect/refresh?shopId=...
 * Stripe calls this when an Account Link has expired. We generate a fresh one
 * and redirect the shop owner back to Stripe's onboarding.
 */
export async function GET(request: NextRequest) {
  const shopId = new URL(request.url).searchParams.get('shopId');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fixtray.app';
  const errorRedirect = `${appUrl}/shop/settings?stripe_connect=error&tab=general`;

  if (!shopId) return NextResponse.redirect(errorRedirect);

  try {
    const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { stripeAccountId: true } });
    if (!shop?.stripeAccountId) return NextResponse.redirect(errorRedirect);

    const accountLink = await stripe.accountLinks.create({
      account: shop.stripeAccountId,
      refresh_url: `${appUrl}/api/stripe/connect/refresh?shopId=${shopId}`,
      return_url: `${appUrl}/shop/settings?stripe_connect=success&tab=general`,
      type: 'account_onboarding',
    });

    return NextResponse.redirect(accountLink.url);
  } catch (err) {
    console.error('[stripe/connect/refresh] Error:', err);
    return NextResponse.redirect(errorRedirect);
  }
}
