import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { getShopStripeConnectStatus, StripeConnectHttpError } from '@/lib/stripeConnectFlow';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stripe/connect/status
 * Shop-facing Connect state. Does not create an account or return stripeAccountId.
 */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== 'shop') {
    return NextResponse.json({ error: 'Only shop accounts can view Stripe Connect' }, { status: 403 });
  }

  try {
    const status = await getShopStripeConnectStatus(auth.id);
    return NextResponse.json(status);
  } catch (err) {
    if (err instanceof StripeConnectHttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[stripe/connect/status] Error');
    return NextResponse.json({ error: 'Failed to load Stripe Connect status' }, { status: 500 });
  }
}
