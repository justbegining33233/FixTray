import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { appBaseUrl } from '@/lib/stripeConnectOnboarding';
import { booksAccess, shopIdForBooks } from '@/lib/books/access';
import { writeAudit } from '@/lib/books/persist';
import {
  intuitConfig,
  isQboRealmId,
  qboAudit,
  qboStateSecret,
  requestQboToken,
  verifyQboState,
} from '@/lib/books/qbo';
import { saveQboTokens } from '@/lib/books/qboStore';

export const dynamic = 'force-dynamic';

function booksRedirect(flag: 'connected' | 'error'): NextResponse {
  const url = new URL('/shop/books', appBaseUrl());
  url.searchParams.set('quickbooks', flag);
  return NextResponse.redirect(url);
}

/**
 * GET /api/shop/quickbooks/callback
 * Intuit redirects the shop owner here with code, realmId, and the signed state.
 */
export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  if (params.get('error')) return booksRedirect('error');

  const auth = authenticateRequest(request);
  const shopId = auth && booksAccess(auth.role).quickBooksConnect ? shopIdForBooks(auth) : null;
  if (!auth || auth.role !== 'shop' || !shopId) return booksRedirect('error');

  const code = params.get('code')?.trim() || '';
  const realmId = params.get('realmId');
  const state = params.get('state') || '';
  if (!code || !isQboRealmId(realmId)) return booksRedirect('error');

  const secret = qboStateSecret();
  const configured = intuitConfig();
  if (!secret || !configured.ok) return booksRedirect('error');

  const verified = verifyQboState(state, secret, Date.now());
  if (!verified.ok || verified.shopId !== shopId) return booksRedirect('error');

  const token = await requestQboToken({
    clientId: configured.config.clientId,
    clientSecret: configured.config.clientSecret,
    grant: { type: 'authorization_code', code, redirectUri: configured.config.redirectUri },
  });
  if (!token.ok) return booksRedirect('error');

  await saveQboTokens({
    shopId,
    realmId,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresIn: token.expiresIn,
  });
  const at = new Date().toISOString();
  await writeAudit(qboAudit({
    actorId: auth.id,
    at,
    shopId,
    action: 'books.quickbooks_connect',
    details: `connected realm ${realmId}`,
  }));
  return booksRedirect('connected');
}
