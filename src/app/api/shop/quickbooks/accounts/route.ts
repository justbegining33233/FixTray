import { NextRequest, NextResponse } from 'next/server';
import { requireQuickBooksOwner } from '@/lib/books/qboOwner';
import { parseQboAccounts, qboAccountQueryUrl } from '@/lib/books/qbo';
import { accessTokenFor } from '@/lib/books/qboSession';

export const dynamic = 'force-dynamic';

/** GET /api/shop/quickbooks/accounts — chart of accounts for the one-time map. */
export async function GET(request: NextRequest) {
  const owner = requireQuickBooksOwner(request);
  if (owner instanceof NextResponse) return owner;
  const access = await accessTokenFor(owner.shopId);
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });
  let response: Response;
  try {
    response = await fetch(qboAccountQueryUrl(access.apiHost, access.realmId), {
      headers: { Accept: 'application/json', Authorization: `Bearer ${access.token}` },
    });
  } catch {
    return NextResponse.json({ error: 'QuickBooks accounts could not be loaded' }, { status: 502 });
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) return NextResponse.json({ error: 'QuickBooks accounts could not be loaded' }, { status: 502 });
  return NextResponse.json({ accounts: parseQboAccounts(payload) });
}
