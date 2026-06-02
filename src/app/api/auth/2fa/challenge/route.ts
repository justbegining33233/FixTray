/**
 * POST /api/auth/2fa/challenge
 * Second step of login when 2FA is enabled.
 * Receives a short-lived temp token + TOTP code, returns a full access JWT.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, generateAccessToken } from '@/lib/auth';
import { verifyTotpToken, decryptSecret } from '@/lib/two-factor';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.tempToken || !body?.token) {
    return NextResponse.json({ error: 'tempToken and token are required' }, { status: 400 });
  }

  // Verify the short-lived temp token
  const decoded = verifyToken(body.tempToken);
  if (!decoded || decoded.type !== '2fa_challenge') {
    return NextResponse.json({ error: 'Invalid or expired challenge token' }, { status: 401 });
  }

  try {
    const prisma = (await import('@/lib/prisma')).default;
    const shop = await prisma.shop.findUnique({ where: { id: decoded.id } });

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    if (!shop.twoFactorEnabled || !shop.twoFactorSecret) {
      return NextResponse.json({ error: '2FA is not configured for this account' }, { status: 400 });
    }

    const shopSettings = await prisma.shopSettings.findUnique({
      where: { shopId: shop.id },
      select: { notificationPreferences: true },
    });

    const notificationPrefs =
      shopSettings?.notificationPreferences &&
      typeof shopSettings.notificationPreferences === 'object' &&
      !Array.isArray(shopSettings.notificationPreferences)
        ? (shopSettings.notificationPreferences as Record<string, unknown>)
        : {};

    const agreement = notificationPrefs.fixtrayAgreement as
      | { accepted?: boolean; signedBy?: string; signedAt?: string }
      | undefined;

    const agreementAccepted = !!(agreement?.accepted && agreement?.signedBy && agreement?.signedAt);

    const valid = verifyTotpToken(decryptSecret(shop.twoFactorSecret), String(body.token));
    if (!valid) {
      return NextResponse.json({ error: 'Invalid TOTP token' }, { status: 401 });
    }

    // Issue the full access token
    const accessToken = generateAccessToken({
      id: shop.id,
      username: shop.username,
      role: 'shop',
    });

    return NextResponse.json({
      id: shop.id,
      username: shop.username,
      shopName: shop.shopName,
      email: shop.email,
      phone: shop.phone,
      profileComplete: shop.profileComplete,
      agreementAccepted,
      status: shop.status,
      accessToken,
    });
  } catch (error) {
    console.error('2FA challenge error:', error);
    return NextResponse.json({ error: '2FA challenge failed' }, { status: 500 });
  }
}
