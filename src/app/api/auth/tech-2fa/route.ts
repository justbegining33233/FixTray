import { NextRequest, NextResponse } from 'next/server';
import { enforceSingleActiveSession } from '@/lib/sessionPolicy';

export async function POST(request: NextRequest) {
  try {
    const { tempToken, action, token: totpToken } = await request.json();
    if (!tempToken) {
      return NextResponse.json({ error: 'Temp token required' }, { status: 400 });
    }

    const { verifyToken } = await import('@/lib/auth');
    const decoded = verifyToken(tempToken);
    if (!decoded || (decoded.type !== '2fa_setup_required' && decoded.type !== '2fa_challenge')) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const prisma = (await import('@/lib/prisma')).default;
    const { generateTotpSecret, verifyTotpToken, encryptSecret } = await import('@/lib/two-factor');

    // Setup flow: generate a TOTP secret for the tech
    if (action === 'setup') {
      const tech = await prisma.tech.findUnique({
        where: { id: decoded.id },
        select: { email: true },
      });
      if (!tech) return NextResponse.json({ error: 'Tech not found' }, { status: 404 });

      const { base32, otpauthUrl } = generateTotpSecret(tech.email);
      // Store encrypted secret temporarily — will be confirmed on verify
      await prisma.tech.update({
        where: { id: decoded.id },
        data: { twoFactorSecret: encryptSecret(base32) },
      });

      return NextResponse.json({ otpauthUrl, base32 });
    }

    // Verify flow: confirm 2FA code and complete login
    if (action === 'verify') {
      if (!totpToken) return NextResponse.json({ error: 'TOTP code required' }, { status: 400 });

      const tech = await prisma.tech.findUnique({
        where: { id: decoded.id },
        select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true, shopId: true, twoFactorSecret: true, twoFactorEnabled: true },
      });
      if (!tech || !tech.twoFactorSecret) {
        return NextResponse.json({ error: 'Tech not found or 2FA not configured' }, { status: 400 });
      }

      const { decryptSecret } = await import('@/lib/two-factor');
      const raw = decryptSecret(tech.twoFactorSecret);
      const valid = verifyTotpToken(raw, totpToken);
      if (!valid) return NextResponse.json({ error: 'Invalid code' }, { status: 401 });

      // Enable 2FA if this is the first successful verify
      if (!tech.twoFactorEnabled) {
        await prisma.tech.update({
          where: { id: decoded.id },
          data: { twoFactorEnabled: true },
        });
      }

      // Issue full tokens
      const { generateAccessToken, generateRandomToken, refreshExpiryDate } = await import('@/lib/auth');
      const shop = await prisma.shop.findUnique({ where: { id: tech.shopId }, select: { shopName: true } });
      const accessToken = generateAccessToken({ id: tech.id, email: tech.email, role: tech.role, shopId: tech.shopId });
      const bcryptMod = await import('bcrypt');
      const bcrypt = (bcryptMod.default ?? bcryptMod) as typeof import('bcrypt');
      const refreshRaw = generateRandomToken(48);
      const refreshHash = await bcrypt.hash(refreshRaw, 12);
      const expiresAt = refreshExpiryDate();
      const csrf = (await import('@/lib/csrf')).generateCsrfToken();
      await enforceSingleActiveSession(prisma, { techId: tech.id });
      const refresh = await prisma.refreshToken.create({
        data: {
          tokenHash: refreshHash,
          adminId: null,
          metadata: JSON.stringify({ techId: tech.id, csrfToken: csrf }),
          expiresAt,
        },
      });

      const response = NextResponse.json({
        id: tech.id,
        email: tech.email,
        firstName: tech.firstName,
        lastName: tech.lastName,
        name: `${tech.firstName} ${tech.lastName}`,
        phone: tech.phone,
        role: tech.role,
        shopId: tech.shopId,
        shopName: shop?.shopName,
        accessToken,
      });

      const cookieOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/',
        maxAge: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      };
      response.cookies.set('refresh_id', refresh.id, cookieOpts);
      response.cookies.set('refresh_sig', refreshRaw, cookieOpts);
      response.cookies.set('csrf_token', csrf, { httpOnly: false, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: cookieOpts.maxAge });
      response.cookies.set('sos_auth', accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 60 * 15 });

      return response;
    }

    return NextResponse.json({ error: 'Invalid action. Use "setup" or "verify".' }, { status: 400 });
  } catch (error) {
    console.error('Tech 2FA error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
