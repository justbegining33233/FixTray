import { NextRequest, NextResponse } from 'next/server';
// Lazy-load `prisma` and `bcrypt` in the handler
import { generateAccessToken, generateTempToken, generateRandomToken, refreshExpiryDate } from '@/lib/auth';
import { checkRateLimit, getClientIP, resetRateLimit } from '@/lib/rateLimit';
import { logActivity } from '@/lib/activityLogger';
import { enforceSingleActiveSession } from '@/lib/sessionPolicy';

export async function POST(request: NextRequest) {
  try {
    let body: { username?: string; password?: string } = {};
    try {
      const raw = await request.text();
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    // Rate limiting — 5 attempts per 15 minutes per IP+username
    const clientIP = getClientIP(request);
    const rateLimitKey = `shop_login:${clientIP}:${String(username).toLowerCase()}`;
    const rateLimit = await checkRateLimit(rateLimitKey);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: rateLimit.message, retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000) },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
      );
    }

    const prisma = (await import('@/lib/prisma')).default;
    const bcryptMod = await import('bcrypt');
    const bcrypt = (bcryptMod && (bcryptMod.default ?? bcryptMod)) as typeof import('bcrypt');

    // Find shop by username, email, or shop name
    const shop = await prisma.shop.findFirst({
      where: {
        AND: [
          {
            OR: [
              { username: username },
              { email: username },
              { shopName: username },
            ],
          },
          { status: 'approved' }, // Only approved shops can login
        ],
      },
    });

    if (!shop) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (!shop.password) {
      return NextResponse.json({ error: 'Account not fully set up. Please contact support.' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, shop.password).catch(() => false);

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
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

    // Reset rate limit counter on successful login
    resetRateLimit(rateLimitKey);

    // If 2FA is enabled, issue a short-lived challenge token — UI must complete
    // the second factor via POST /api/auth/2fa/challenge
    if (shop.twoFactorEnabled) {
      const tempToken = generateTempToken({ id: shop.id, type: '2fa_challenge' });
      return NextResponse.json({ requires2FA: true, tempToken }, { status: 200 });
    }

    // Generate access token
    const accessToken = generateAccessToken({ id: shop.id, shopId: shop.id, username: shop.username, role: 'shop' });

    // Refresh token — httpOnly cookies for silent renewal
    const refreshRaw = generateRandomToken(48);
    const bcryptMod2 = await import('bcrypt');
    const bcrypt2 = (bcryptMod2.default ?? bcryptMod2) as typeof import('bcrypt');
    const refreshHash = await bcrypt2.hash(refreshRaw, 12);
    const expiresAt = refreshExpiryDate();
    const userIp = request.headers.get('x-forwarded-for') || '';
    const userAgent = request.headers.get('user-agent') || '';
    const csrf = (await import('@/lib/csrf')).generateCsrfToken();
    await enforceSingleActiveSession(prisma, { shopId: shop.id });
    const refresh = await prisma.refreshToken.create({
      data: {
        tokenHash: refreshHash,
        adminId: null,
        metadata: JSON.stringify({ shopId: shop.id, ip: userIp, agent: userAgent, csrfToken: csrf }),
        expiresAt,
      }
    });

    const response = NextResponse.json({
      id: shop.id,
      username: shop.username,
      shopName: shop.shopName,
      email: shop.email,
      phone: shop.phone,
      profileComplete: shop.profileComplete,
      agreementAccepted,
      status: shop.status,
      accessToken,
    }, { status: 200 });

    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    };
    response.cookies.set('refresh_id', refresh.id, cookieOpts);
    response.cookies.set('refresh_sig', refreshRaw, cookieOpts);
    response.cookies.set('csrf_token', csrf, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    });
    response.cookies.set('sos_auth', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 15,
    });

    // Fire-and-forget activity log
    logActivity('login', shop.username, `Shop login from ${userIp}`, {
      type: 'user',
      severity: 'info',
      shopId: shop.id,
      email: shop.email,
      metadata: { ip: userIp, role: 'shop' },
    });

    return response;
    } catch (error: unknown) {
      console.error('Shop login error:', error);
      const details = process.env.NODE_ENV === 'development' ? (error as Error)?.message : undefined;
      return NextResponse.json({ error: 'Login failed', ...(details && { details }) }, { status: 500 });
  }
}
