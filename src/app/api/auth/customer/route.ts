import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIP, resetRateLimit } from '@/lib/rateLimit';
import { customerLoginSchema } from '@/lib/validation';
import { generateAccessToken, generateRandomToken, refreshExpiryDate } from '@/lib/auth';
import { logActivity } from '@/lib/activityLogger';
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
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { email: rawIdentifier, username: rawUsername, phone: rawPhone, password } = validationResult.data;
    const identifier = String(rawIdentifier || rawUsername || rawPhone || '').trim();
    const identifierLower = identifier.toLowerCase();
    const phoneDigits = identifier.replace(/\D/g, '');

    // Rate limiting - prevent brute force attacks
    const clientIP = getClientIP(request);
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
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email: { equals: identifierLower, mode: 'insensitive' } },
          { username: { equals: identifierLower, mode: 'insensitive' } },
          ...(phoneDigits ? [{ phone: phoneDigits }] : []),
          ...(identifierLower ? [{ phone: identifier }] : []),
        ]
      },
    });
    if (!customer) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Verify hashed password
    const isValid = await bcrypt.compare(password, customer.password).catch(() => false);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Auto-verify any legacy unverified accounts on successful login
    if (customer.emailVerified === false) {
      await prisma.customer.update({ where: { id: customer.id }, data: { emailVerified: true } }).catch(() => {});
    }

    // Successful login - reset rate limit
    resetRateLimit(rateLimitKey);

    const accessToken = generateAccessToken({ id: customer.id, email: customer.email, role: 'customer' });
    const refreshRaw = generateRandomToken(48);
    const refreshHash = await bcrypt.hash(refreshRaw, 12);
    const expiresAt = refreshExpiryDate();
    const userIp = request.headers.get('x-forwarded-for') || request.headers.get('host') || '';
    const userAgent = request.headers.get('user-agent') || '';
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
    console.error('Customer login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
