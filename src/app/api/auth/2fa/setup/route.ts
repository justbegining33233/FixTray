/**
 * POST /api/auth/2fa/setup
 * Generates a TOTP secret + QR code for the authenticated shop, manager, or tech.
 * 2FA is NOT yet active — the account must call /api/auth/2fa/verify to confirm.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { generateTotpSecret, encryptSecret } from '@/lib/two-factor';
import { ACCOUNT_TWO_FACTOR_ROLES, readTwoFactorAccount, writeTwoFactorAccount } from '@/lib/twoFactorAccount';
import QRCode from 'qrcode';

export async function POST(request: NextRequest) {
  const auth = requireRole(request, [...ACCOUNT_TWO_FACTOR_ROLES]);
  if (auth instanceof NextResponse) return auth;

  try {
    const prisma = (await import('@/lib/prisma')).default;
    const account = await readTwoFactorAccount(prisma, auth);
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const { base32, otpauthUrl } = generateTotpSecret(account.email || 'staff@fixtray.local');

    await writeTwoFactorAccount(prisma, auth, {
      twoFactorSecret: encryptSecret(base32),
      twoFactorEnabled: false,
    });

    const qrCode = await QRCode.toDataURL(otpauthUrl);

    return NextResponse.json({ secret: base32, qrCode, otpauthUrl });
  } catch (error) {
    console.error('2FA setup error:', error);
    return NextResponse.json({ error: 'Failed to set up 2FA' }, { status: 500 });
  }
}
