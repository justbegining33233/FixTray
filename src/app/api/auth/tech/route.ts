import { NextRequest, NextResponse } from 'next/server';
// `prisma` and `bcrypt` are lazy-imported inside the handler to avoid build-time
// evaluation issues (native binaries / environment differences).
import { checkRateLimit, getClientIP, resetRateLimit } from '@/lib/rateLimit';
import { generateAccessToken, generateRandomToken, generateTempToken, refreshExpiryDate } from '@/lib/auth';
import { logActivity } from '@/lib/activityLogger';
import { enforceSingleActiveSession } from '@/lib/sessionPolicy';
import { normalizeEmployeeNumber } from '@/lib/employeeNumber';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    // Lazy-load runtime-sensitive modules to prevent import-time failures
    const bcryptModule = await import('bcrypt');
    const bcrypt = (bcryptModule && (bcryptModule.default ?? bcryptModule)) as typeof import('bcrypt');
    const prisma = (await import('@/lib/prisma')).default;

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    const rawIdentifier = String(username).trim();
    const identifierLower = rawIdentifier.toLowerCase();
    const normalizedPhone = rawIdentifier.replace(/\D/g, '');
    const normalizedEmployeeNumber = normalizeEmployeeNumber(rawIdentifier);

    // Rate limiting - prevent brute force attacks
    const clientIP = getClientIP(request);
    const rateLimitKey = `tech_login:${clientIP}:${identifierLower}`;
    const rateLimit = await checkRateLimit(rateLimitKey);
    
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: rateLimit.message, retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000) },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
      );
    }

    // Find tech by normalized email or phone first.
    let tech = await prisma.tech.findFirst({
      where: {
        OR: [
          { employeeNumber: normalizedEmployeeNumber },
          { email: identifierLower },
          { phone: rawIdentifier },
          ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
        ],
      },
      include: {
        shop: {
          select: {
            id: true,
            shopName: true,
          },
        },
      },
    });

    // Support username-style tech login with email local-part (e.g. "jdoe" for jdoe@shop.com).
    if (!tech && !identifierLower.includes('@')) {
      const possibleTechs = await prisma.tech.findMany({
        where: {
          OR: [
            { email: { contains: '@' } },
            ...(normalizedPhone ? [{ phone: { not: null } }] : []),
          ],
        },
        include: {
          shop: {
            select: {
              id: true,
              shopName: true,
            },
          },
        },
      });

      tech = possibleTechs.find((t) => {
        const email = (t.email || '').toLowerCase();
        const localPart = email.includes('@') ? email.split('@')[0] : '';
        const phone = (t.phone || '').replace(/\D/g, '');
        return localPart === identifierLower || (normalizedPhone && phone === normalizedPhone);
      }) || null;
    }

    if (!tech) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (!tech.password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, tech.password);
    
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Successful login - reset rate limit
    resetRateLimit(rateLimitKey);

    // Check if shop requires 2FA for team members
    const shopSettings = await prisma.shopSettings.findUnique({
      where: { shopId: tech.shopId },
      select: { require2FA: true },
    });

    if (shopSettings?.require2FA) {
      // If tech has 2FA enabled, require challenge
      if (tech.twoFactorEnabled) {
        const tempToken = generateTempToken({ id: tech.id, type: '2fa_challenge', role: tech.role, shopId: tech.shopId });
        return NextResponse.json({ requires2FA: true, tempToken }, { status: 200 });
      }
      // If tech hasn't set up 2FA yet, return setup-required flag
      // The frontend will redirect them to set up TOTP
      const tempToken = generateTempToken({ id: tech.id, type: '2fa_setup_required', role: tech.role, shopId: tech.shopId });
      return NextResponse.json({ requires2FASetup: true, tempToken }, { status: 200 });
    }

    // If tech has 2FA enabled independently, still require challenge
    if (tech.twoFactorEnabled) {
      const tempToken = generateTempToken({ id: tech.id, type: '2fa_challenge', role: tech.role, shopId: tech.shopId });
      return NextResponse.json({ requires2FA: true, tempToken }, { status: 200 });
    }

    // Issue tokens
    const accessToken = generateAccessToken({ id: tech.id, email: tech.email, role: tech.role, shopId: tech.shopId });

    const refreshRaw = generateRandomToken(48);
    const refreshHash = await bcrypt.hash(refreshRaw, 12);
    const expiresAt = refreshExpiryDate();
    const userIp = request.headers.get('x-forwarded-for') || request.headers.get('host') || '';
    const userAgent = request.headers.get('user-agent') || '';
    const csrf = (await import('@/lib/csrf')).generateCsrfToken();
    await enforceSingleActiveSession(prisma, { techId: tech.id });
    const refresh = await prisma.refreshToken.create({
      data: {
        tokenHash: refreshHash,
        adminId: null,
        // associate tech sessions via metadata (store as JSON string)
        metadata: JSON.stringify({ techId: tech.id, ip: userIp, agent: userAgent, csrfToken: csrf }),
        expiresAt,
      }
    });

    const response = NextResponse.json({
      id: tech.id,
      employeeNumber: tech.employeeNumber,
      email: tech.email,
      firstName: tech.firstName,
      lastName: tech.lastName,
      name: `${tech.firstName} ${tech.lastName}`,
      phone: tech.phone,
      role: tech.role,
      shopId: tech.shopId,
      shopName: tech.shop.shopName,
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
    logActivity('login', `${tech.firstName} ${tech.lastName}`, `Tech login from ${userIp}`, {
      type: 'user',
      severity: 'info',
      shopId: tech.shopId,
      email: tech.email ?? undefined,
      metadata: { ip: userIp, role: tech.role },
    });

    return response;
    } catch (error: unknown) {
      console.error('Tech login error:', error, (error as Error)?.stack);
      const details = process.env.NODE_ENV === 'development' ? ((error as Error)?.message || 'unknown') : undefined;
      return NextResponse.json({ error: 'Login failed', ...(details && { details }) }, { status: 500 });
  }
}
