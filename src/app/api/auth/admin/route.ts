import { NextRequest, NextResponse } from 'next/server';
// Lazy-load `prisma` and `bcrypt` inside the handler to avoid import-time issues
import { checkRateLimit, getClientIP, resetRateLimit } from '@/lib/rateLimit';

import { generateAccessToken, generateRandomToken, refreshExpiryDate } from '@/lib/auth';
import { isOwnerAdmin } from '@/lib/owner-access';
import { logActivity } from '@/lib/activityLogger';
import { enforceSingleActiveSession } from '@/lib/sessionPolicy';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const normalizedUsername = String(username).trim();
    const identifierLower = normalizedUsername.toLowerCase();

    // Lazy-load runtime-sensitive modules
    const prisma = (await import('@/lib/prisma')).default;
    const bcryptMod = await import('bcrypt');
    const bcrypt = (bcryptMod && (bcryptMod.default ?? bcryptMod)) as typeof import('bcrypt');

    // Rate limiting - prevent brute force attacks
    const clientIP = getClientIP(request);
    const rateLimitKey = `admin_login:${clientIP}:${normalizedUsername.toLowerCase()}`;
    const rateLimit = await checkRateLimit(rateLimitKey);
    
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: rateLimit.message, retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000) },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
      );
    }

    // Find admin by username or email (trimmed), with case-insensitive fallbacks.
    let admin = await prisma.admin.findUnique({ where: { username: normalizedUsername } });
    if (!admin) {
      const admins = await prisma.admin.findMany({ select: { id: true, username: true, email: true, password: true, isSuperAdmin: true, createdAt: true } });
      admin = admins.find((a) => {
        const adminUsername = String(a.username || '').trim().toLowerCase();
        const adminEmail = String(a.email || '').trim().toLowerCase();
        return adminUsername === identifierLower || adminEmail === identifierLower;
      }) || null;
    }

    if (!admin) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, admin.password);

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Successful login - reset rate limit
    resetRateLimit(rateLimitKey);

    // Generate short-lived access token
    const ownerAccess = isOwnerAdmin({ id: admin.id, username: admin.username });
    const accessToken = generateAccessToken({
      id: admin.id,
      username: admin.username,
      role: 'superadmin',
      isSuperAdmin: admin.isSuperAdmin,
      isOwner: ownerAccess,
    });

    // Create refresh token (store hashed) and set httpOnly cookie. We store cookie as "<id>:<raw>"
    const refreshRaw = generateRandomToken(48);
    const refreshHash = await bcrypt.hash(refreshRaw, 12);
    const csrf = (await import('@/lib/csrf')).generateCsrfToken();
    const expiresAt = refreshExpiryDate();
    const userIp = request.headers.get('x-forwarded-for') || request.headers.get('host') || '';
    const userAgent = request.headers.get('user-agent') || '';
    await enforceSingleActiveSession(prisma, { adminId: admin.id });

    const refresh = await prisma.refreshToken.create({
      data: {
        tokenHash: refreshHash,
        adminId: admin.id,
        metadata: JSON.stringify({ ip: userIp, agent: userAgent, csrfToken: csrf }),
        expiresAt,
      }
    });

    const response = NextResponse.json({
      id: admin.id,
      username: admin.username,
      email: admin.email,
      isSuperAdmin: admin.isSuperAdmin,
      isOwner: ownerAccess,
      role: 'superadmin',
      accessToken,
    });
    try {
      response.cookies.set('refresh_id', refresh.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      });
    } catch (err) {
      console.error('[admin/login] cookie set failed (refresh_id):', err);
    }

    try {
      response.cookies.set('refresh_sig', refreshRaw, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      });
    } catch (err) {
      console.error('[admin/login] cookie set failed (refresh_sig):', err);
    }

    // Expose CSRF token in a readable cookie for client-side fetches
    try {
      response.cookies.set('csrf_token', csrf, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      });
    } catch (err) {
      console.error('[admin/login] cookie set failed (csrf_token):', err);
    }

    // Optionally set the access token cookie as well for browser-based auth
    try {
      response.cookies.set('sos_auth', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 15, // 15 minutes
      });
    } catch (err) {
      console.error('[admin/login] cookie set failed (sos_auth):', err);
    }

    // Fire-and-forget activity log — never blocks the response
    logActivity('login', admin.username, `Admin login from ${userIp}`, {
      type: 'user',
      severity: 'info',
      email: admin.email,
      metadata: { ip: userIp, agent: userAgent, role: 'superadmin' },
    });

    return response;

    } catch (error: unknown) {
      console.error('Admin login error:', error);
      const details = process.env.NODE_ENV === 'development' ? ((error as Error)?.message || String(error)) : 'Login failed';
    return NextResponse.json({ error: 'Login failed', details }, { status: 500 });
  }
}
