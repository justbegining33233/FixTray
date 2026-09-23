import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { connectFailureMessage, parseConnectOrigin } from '@/lib/stripeConnectOnboarding';
import { startShopStripeConnect, StripeConnectHttpError } from '@/lib/stripeConnectFlow';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stripe/connect?from=integrations|settings|onboarding
 * Creates (or resumes) a Stripe connected account for the shop and returns an
 * Account Link URL. Requires the platform STRIPE_SECRET_KEY only.
 * Persists stripeAccountId before the link is returned so refresh can resume.
 */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== 'shop') {
    return NextResponse.json({ error: 'Only shop accounts can connect Stripe' }, { status: 403 });
  }

  const origin = parseConnectOrigin(new URL(request.url).searchParams.get('from'));

  try {
    const { url } = await startShopStripeConnect(auth.shopId || auth.id, origin);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof StripeConnectHttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[stripe/connect] Error creating account link', {
      message: connectFailureMessage(err),
    });
    return NextResponse.json({ error: connectFailureMessage(err) }, { status: 502 });
  }
}
