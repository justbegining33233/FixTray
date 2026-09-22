/**
 * POST /api/auth/2fa/verify
 * Verifies a TOTP token against the pending secret and enables 2FA.
 *
 * GET /api/auth/2fa/verify
 * Returns current 2FA status from the DB.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { verifyTotpToken, decryptSecret } from '@/lib/two-factor';
import { ACCOUNT_TWO_FACTOR_ROLES, readTwoFactorAccount, writeTwoFactorAccount } from '@/lib/twoFactorAccount';

export async function POST(request: NextRequest) {
  const auth = requireRole(request, [...ACCOUNT_TWO_FACTOR_ROLES]);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  if (!body?.token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }

  try {
    const prisma = (await import('@/lib/prisma')).default;
    const account = await readTwoFactorAccount(prisma, auth);
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    if (!account.twoFactorSecret) {
      return NextResponse.json({ error: 'Run /api/auth/2fa/setup first' }, { status: 400 });
    }

    const valid = verifyTotpToken(decryptSecret(account.twoFactorSecret), String(body.token));
    if (!valid) {
      return NextResponse.json({ error: 'Invalid TOTP token' }, { status: 400 });
    }

    await writeTwoFactorAccount(prisma, auth, { twoFactorEnabled: true });

    return NextResponse.json({ message: '2FA enabled successfully', enabled: true });
  } catch (error) {
    console.error('2FA verify error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, [...ACCOUNT_TWO_FACTOR_ROLES]);
  if (auth instanceof NextResponse) return auth;

  const prisma = (await import('@/lib/prisma')).default;
  const account = await readTwoFactorAccount(prisma, auth);

  return NextResponse.json({ enabled: account?.twoFactorEnabled ?? false });
}
