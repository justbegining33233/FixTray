import { NextRequest, NextResponse } from 'next/server';
// Lazy-load prisma & bcrypt inside handler
import { verifyPassword, generateToken, generateRandomToken, refreshExpiryDate } from '@/lib/auth';
import { checkRateLimit, getClientIP, resetRateLimit } from '@/lib/rateLimit';
import { z } from 'zod';
import { enforceSingleActiveSession } from '@/lib/sessionPolicy';

const loginSchema = z.object({
  email: z.string().optional(),
  username: z.string().optional(),
  phone: z.string().optional(),
  password: z.string(),
}).refine(data => data.email || data.username || data.phone, {
  message: "Either email, username, or phone must be provided",
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = loginSchema.parse(body);

    // Rate limiting � 5 attempts per 15 minutes per IP + identifier
    const clientIP = getClientIP(request);
    const identifier = String(data.email || data.username || data.phone || '').trim();
    const identifierLower = identifier.toLowerCase();
    const phoneDigits = identifier.replace(/\D/g, '');
    const rateLimitKey = `customer_login:${clientIP}:${identifier}`;
    const rateLimit = await checkRateLimit(rateLimitKey);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: rateLimit.message, retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000) },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
      );
    }

    // Lazy-load runtime-sensitive modules
    const prisma = (await import('@/lib/prisma')).default;
    const bcryptMod = await import('bcrypt');
    const bcrypt = (bcryptMod && (bcryptMod.default ?? bcryptMod)) as typeof import('bcrypt');

    // Find customer by email or username
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email: { equals: identifierLower, mode: 'insensitive' } },
          { username: { equals: identifierLower, mode: 'insensitive' } },
          ...(phoneDigits ? [{ phone: phoneDigits }] : []),
          ...(identifier ? [{ phone: identifier }] : []),
        ].filter(Boolean),
      },
    });
    
    if (!customer) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    
    // Verify password
    const valid = await verifyPassword(data.password, customer.password);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Block unverified accounts
    if (customer.emailVerified === false) {
      return NextResponse.json(
        { error: 'Please verify your email address before logging in. Check your inbox for the verification link.' },
        { status: 403 }
      );
    }

    // Reset rate limit counter on successful login
    resetRateLimit(rateLimitKey);
    
    // Generate access and refresh tokens, store refresh token server-side and set cookies
    const accessToken = generateToken({ id: customer.id, email: customer.email, role: 'customer' });
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

    const response = NextResponse.json({
      token: accessToken,
      user: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        role: 'customer',
      },
    });

    response.cookies.set('refresh_id', refresh.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    });
    response.cookies.set('refresh_sig', refreshRaw, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    });
    response.cookies.set('csrf_token', csrf, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    });
    response.cookies.set('sos_auth', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 15,
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
