import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIP, resetRateLimit } from '@/lib/rateLimit';
import { checkAccountLockout, recordFailedLoginAttempt, clearLoginAttempts } from '@/lib/auth-lockout';
import { logSecurityEvent } from '@/lib/audit-logger';
import { customerLoginSchema } from '@/lib/validation';
import { generateAccessToken, generateRandomToken, refreshExpiryDate } from '@/lib/auth';
import { logActivity } from '@/lib/activityLogger';
import logger from '@/lib/logger';
import { enforceSingleActiveSession } from '@/lib/sessionPolicy';

// POST /api/auth/customer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Keep this route free of DOM/HTML sanitizer dependencies to avoid
    // serverless ESM/CJS runtime incompatibilities.
    const sanitizedBody = {
      email: typeof body?.email === 'string' ? body.email.trim() : body?.email,
      username: typeof body?.username === 'string' ? body.username.trim() : body?.username,
      phone: typeof body?.phone === 'string' ? body.phone.trim() : body?.phone,
      password: typeof body?.password === 'string' ? body.password : body?.password,
    };

    // Validate input
    const validationResult = customerLoginSchema.safeParse(sanitizedBody);
    if (!validationResult.success) {
      // CRITICAL FIX: Never expose validation details to client
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    const { email: rawIdentifier, username: rawUsername, phone: rawPhone, password } = validationResult.data;
    const identifier = String(rawIdentifier || rawUsername || rawPhone || '').trim();
    const identifierLower = identifier.toLowerCase();
    const phoneDigits = identifier.replace(/\D/g, '');

    // Rate limiting - prevent brute force attacks
    const clientIP = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';
    const rateLimitKey = `customer_login:${clientIP}:${identifierLower || phoneDigits}`;
    const rateLimit = await checkRateLimit(rateLimitKey);
    
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: rateLimit.message, retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000) },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
      );
    }

    // Lazy-load runtime-sensitive modules to avoid build-time import failures
    const prisma = (await import('@/lib/prisma')).default;
    const bcryptMod = await import('bcrypt');
    const bcrypt = (bcryptMod && (bcryptMod.default ?? bcryptMod)) as typeof import('bcrypt');

    // Find customer by email OR username
    const customerLookups = [
      { email: { equals: identifierLower, mode: 'insensitive' as const } },
      { username: { equals: identifierLower, mode: 'insensitive' as const } },
      ...(phoneDigits ? [{ phone: phoneDigits }] : []),
      ...(identifierLower ? [{ phone: identifier }] : []),
    ];
    const customer = await prisma.customer.findFirst({
      where: {
        OR: customerLookups,
      },
    });
    if (!customer) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // HIGH FIX #6: Check account lockout status
    const lockoutStatus = await checkAccountLockout(customer.id, request);
    if (lockoutStatus.isLocked) {
      return NextResponse.json(
        { 
          error: `Account is temporarily locked. Try again in ${lockoutStatus.remainingSeconds} seconds.`,
          retryAfter: lockoutStatus.remainingSeconds 
        },
        { status: 429, headers: { 'Retry-After': String(lockoutStatus.remainingSeconds) } }
      );
    }

    // Verify hashed password
    const isValid = await bcrypt.compare(password, customer.password).catch(() => false);
    if (!isValid) {
      // MEDIUM FIX #3: Log failed login attempt
      await logSecurityEvent({
        eventType: 'login_failed',
        email: customer.email,
        role: 'customer',
        ip: clientIP,
        userAgent,
        severity: 'warn',
      });
      
      // HIGH FIX #6: Record failed attempt for lockout
      await recordFailedLoginAttempt(customer.id, request);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Auto-verify any legacy unverified accounts on successful login
    if (customer.emailVerified === false) {
      await prisma.customer.update({ where: { id: customer.id }, data: { emailVerified: true } }).catch(() => {});
    }

    // HIGH FIX #6: Clear failed attempts on successful login
    await clearLoginAttempts(customer.id);

    // MEDIUM FIX #3: Log successful login
    await logSecurityEvent({
      eventType: 'login_success',
      userId: customer.id,
      email: customer.email,
      role: 'customer',
      ip: clientIP,
      userAgent,
      severity: 'info',
    });

    // Successful login - reset rate limit
    resetRateLimit(rateLimitKey);

    const accessToken = generateAccessToken({ id: customer.id, email: customer.email, role: 'customer' });
    const refreshRaw = generateRandomToken(48);
    const refreshHash = await bcrypt.hash(refreshRaw, 12);
    const expiresAt = refreshExpiryDate();
    const userIp = request.headers.get('x-forwarded-for') || request.headers.get('host') || '';
    const csrf = (await import('@/lib/csrf')).generateCsrfToken();
    await enforceSingleActiveSession(prisma, { customerId: customer.id });
    const refresh = await prisma.refreshToken.create({
      data: {
        tokenHash: refreshHash,
        adminId: null,
        metadata: JSON.stringify({ customerId: customer.id, ip: userIp, agent: userAgent, csrfToken: csrf }),
        expiresAt,
      }
    });

    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    };
    const response = NextResponse.json({
      id: customer.id,
      username: customer.email,
      fullName: `${customer.firstName} ${customer.lastName}`,
      email: customer.email,
      role: 'customer',
      accessToken,
      emailVerified: customer.emailVerified ?? true,
    }, { status: 200 });
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
    logActivity('login', customer.email, `Customer login from ${userIp}`, {
      type: 'user',
      severity: 'info',
      email: customer.email,
      metadata: { ip: userIp, role: 'customer' },
    });

    return response;
  } catch (error) {
    logger.error('Customer login failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
