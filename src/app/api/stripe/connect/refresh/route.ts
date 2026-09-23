import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import stripe from '@/lib/stripe';
import { shopCanReceiveConnectTransfer } from '@/lib/stripeConnectSplit';
import {
  appBaseUrl,
  connectReturnPath,
  isStripeAccountId,
  parseConnectOrigin,
  stripePlatformConfigured,
} from '@/lib/stripeConnectOnboarding';
import { createShopAccountLink } from '@/lib/stripeConnectFlow';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stripe/connect/refresh?shopId=...&from=...
 * Stripe calls this when an Account Link expires or the shop leaves onboarding
 * before it is finished. A fresh link sends them back to hosted onboarding.
 */
export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const shopId = (params.get('shopId') || '').trim();
  const origin = parseConnectOrigin(params.get('from'));
  const errorRedirect = connectReturnPath(origin, appBaseUrl(), 'error');

  if (!/^[a-zA-Z0-9_-]{8,}$/.test(shopId)) {
    return NextResponse.redirect(errorRedirect);
  }

  try {
    if (!stripePlatformConfigured()) return NextResponse.redirect(errorRedirect);

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, stripeAccountId: true },
    });
    if (!shop || !isStripeAccountId(shop.stripeAccountId)) {
      return NextResponse.redirect(errorRedirect);
    }

    const account = await stripe.accounts.retrieve(shop.stripeAccountId);
    const payoutsReady = shopCanReceiveConnectTransfer(account);
    const url = await createShopAccountLink(shop.stripeAccountId, shop.id, origin, payoutsReady);
    return NextResponse.redirect(url);
  } catch {
    console.error('[stripe/connect/refresh] Error');
    return NextResponse.redirect(errorRedirect);
  }
}
