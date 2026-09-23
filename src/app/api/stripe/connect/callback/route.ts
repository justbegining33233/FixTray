import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  appBaseUrl,
  connectReturnPath,
  isStripeAccountId,
  parseOAuthState,
  stripePlatformConfigured,
} from '@/lib/stripeConnectOnboarding';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stripe/connect/callback
 * OAuth return for a Standard connected account. Express onboarding uses
 * Account Links and /api/stripe/connect/refresh instead of this route.
 * Exchanges the auth code and saves stripe_user_id (acct_…) on the shop.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const { shopId, origin } = parseOAuthState(searchParams.get('state'));
  const error = searchParams.get('error');
  const appUrl = appBaseUrl();
  const errorRedirect = connectReturnPath(origin, appUrl, 'error');
  const successRedirect = connectReturnPath(origin, appUrl, 'return');

  if (error || !code || !shopId) {
    console.error('[stripe/connect/callback] OAuth return missing code or shop');
    return NextResponse.redirect(errorRedirect);
  }

  if (!stripePlatformConfigured()) {
    return NextResponse.redirect(errorRedirect);
  }

  try {
    const tokenRes = await fetch('https://connect.stripe.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_secret: process.env.STRIPE_SECRET_KEY!,
        code,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    const accountId = typeof tokenData?.stripe_user_id === 'string' ? tokenData.stripe_user_id : '';

    if (tokenData?.error || !isStripeAccountId(accountId)) {
      console.error('[stripe/connect/callback] Token exchange failed');
      return NextResponse.redirect(errorRedirect);
    }

    const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { id: true } });
    if (!shop) return NextResponse.redirect(errorRedirect);

    await prisma.shop.update({
      where: { id: shopId },
      data: { stripeAccountId: accountId },
    });

    return NextResponse.redirect(successRedirect);
  } catch {
    console.error('[stripe/connect/callback] Error');
    return NextResponse.redirect(errorRedirect);
  }
}
