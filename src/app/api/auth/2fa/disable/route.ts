/**
 * POST /api/auth/2fa/disable
 * Verifies the current TOTP token then disables 2FA and clears the secret.
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
    return NextResponse.json({ error: 'Provide your current TOTP token to disable 2FA' }, { status: 400 });
  }

  try {
    const prisma = (await import('@/lib/prisma')).default;
    const account = await readTwoFactorAccount(prisma, auth);
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    if (!account.twoFactorEnabled || !account.twoFactorSecret) {
      return NextResponse.json({ message: '2FA is not currently enabled', enabled: false });
    }

    const valid = verifyTotpToken(decryptSecret(account.twoFactorSecret), String(body.token));
    if (!valid) {
      return NextResponse.json({ error: 'Invalid TOTP token' }, { status: 400 });
    }

    await writeTwoFactorAccount(prisma, auth, { twoFactorEnabled: false, twoFactorSecret: null });

    return NextResponse.json({ message: '2FA disabled successfully', enabled: false });
  } catch (error) {
    console.error('2FA disable error:', error);
    return NextResponse.json({ error: 'Failed to disable 2FA' }, { status: 500 });
  }
}
