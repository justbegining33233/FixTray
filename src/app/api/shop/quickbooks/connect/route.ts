import { NextRequest, NextResponse } from 'next/server';
import { requireQuickBooksOwner } from '@/lib/books/qboOwner';
import { intuitConfig, qboAuthorizeUrl, qboStateSecret, signQboState } from '@/lib/books/qbo';

export const dynamic = 'force-dynamic';

/**
 * GET /api/shop/quickbooks/connect
 * Shop owner only. Returns the Intuit OAuth URL. Client id and secret stay on the server.
 */
export async function GET(request: NextRequest) {
  const owner = requireQuickBooksOwner(request);
  if (owner instanceof NextResponse) return owner;

  const configured = intuitConfig();
  if (!configured.ok) {
    return NextResponse.json(
      { error: 'QuickBooks Online is not configured', missing: configured.missing },
      { status: 503 },
    );
  }
  const secret = qboStateSecret();
  if (!secret) {
    return NextResponse.json(
      { error: 'QuickBooks Online is not configured', missing: ['JWT_SECRET'] },
      { status: 503 },
    );
  }
  const state = signQboState({ shopId: owner.shopId, nowMs: Date.now(), secret });
  const url = qboAuthorizeUrl({
    clientId: configured.config.clientId,
    redirectUri: configured.config.redirectUri,
    state,
  });
  return NextResponse.json({ url });
}
