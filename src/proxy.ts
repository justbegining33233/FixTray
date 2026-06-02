import { NextRequest, NextResponse } from 'next/server';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;

  // Keep proxy verification behavior aligned with token signing in src/lib/auth.ts.
  // This preserves local/dev behavior even when JWT_SECRET is unset.
  return 'dev-only-insecure-secret-do-not-use-in-prod';
}

function resolveAllowedOrigin(request: NextRequest): string | null {
  const origin = request.headers.get('origin');
  if (!origin) return null;

  const configured = process.env.CORS_ORIGINS;
  if (!configured) {
    return process.env.NODE_ENV === 'development' ? origin : null;
  }

  const allowed = configured.split(',').map((item) => item.trim()).filter(Boolean);
  if (allowed.includes('*') || allowed.includes(origin)) {
    return origin;
  }

  return null;
}

//  Role definitions 

/** Which roles may access each top-level route prefix */
const ROUTE_ROLES: Record<string, string[]> = {
  '/admin':      ['admin', 'superadmin'],
  '/superadmin': ['superadmin'],
  '/shop':       ['shop', 'tech', 'manager', 'superadmin'],
  '/tech':       ['tech',    'superadmin'],
  '/customer':   ['customer','superadmin'],
  '/manager':    ['manager', 'superadmin'],
  '/workorders': ['shop', 'manager', 'tech', 'superadmin'],
  '/reports':    ['admin', 'shop', 'manager', 'superadmin'],
};

/** Where to send a logged-in user based on their role */
const ROLE_HOME: Record<string, string> = {
  admin:      '/admin/home',
  superadmin: '/admin/home',
  shop:       '/shop/admin',
  manager:    '/manager/home',
  tech:       '/tech/home',
  customer:   '/customer/dashboard',
};

//  JWT signature verification (Web Crypto API  Edge-compatible) 

async function verifyJwt(token: string): Promise<Record<string, unknown> | null> {
  try {
    const secret = getJwtSecret();

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const encoder = new TextEncoder();

    // Import the HMAC key
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    // Decode the signature from base64url
    const sigBase64 = parts[2].replace(/-/g, '+').replace(/_/g, '/');
    const sigBinary = Uint8Array.from(atob(sigBase64), (c) => c.charCodeAt(0));

    // Verify: HMAC-SHA256( header.payload, secret ) === signature
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBinary,
      encoder.encode(`${parts[0]}.${parts[1]}`),
    );

    if (!valid) return null;

    // Signature valid  decode payload
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(payloadBase64)) as Record<string, unknown>;

    // Respect token expiration when present.
    const exp = payload.exp;
    if (typeof exp === 'number' && Date.now() >= exp * 1000) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

//  Proxy 

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    const origin = resolveAllowedOrigin(request);
    const isPreflight = request.method === 'OPTIONS';

    const baseHeaders: Record<string, string> = {
      Vary: 'Origin',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
    };

    if (origin) {
      baseHeaders['Access-Control-Allow-Origin'] = origin;
      baseHeaders['Access-Control-Allow-Credentials'] = 'true';
    }

    if (isPreflight) {
      return new NextResponse(null, { status: 204, headers: baseHeaders });
    }

    const response = NextResponse.next();
    Object.entries(baseHeaders).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  }

  //  Native-app detection 
  // Build a modified headers object that includes x-fixtray-native so
  // layout.tsx can read it server-side and render the correct shell from byte 1.
  const nativeCookie = request.cookies.get('x-fixtray-native')?.value;
  const ua = request.headers.get('user-agent') ?? '';
  const isAndroidUA = ua.includes('FixTray-Android-App-Pro');
  const isIosUA = ua.includes('FixTray-iOS-App-Pro');
  const nativePlatform: string | null =
    nativeCookie === 'android' || nativeCookie === 'ios'
      ? nativeCookie
      : isAndroidUA ? 'android'
      : isIosUA ? 'ios'
      : null;

  const requestHeaders = new Headers(request.headers);
  if (nativePlatform) requestHeaders.set('x-fixtray-native', nativePlatform);
  const passThrough = () => NextResponse.next({ request: { headers: requestHeaders } });
  // 

  // Allow unauthenticated access to role-specific login pages
  if (pathname === '/admin/login') return passThrough();

  // Find the route group this path belongs to
  const entry = Object.entries(ROUTE_ROLES).find(([prefix]) =>
    pathname.startsWith(prefix)
  );

  // Not a protected route  pass through
  if (!entry) return passThrough();

  const [, allowedRoles] = entry;

  // Read token from cookie (set by every login route) or Authorization header
  const token =
    request.cookies.get('sos_auth')?.value ??
    request.headers.get('authorization')?.replace('Bearer ', '');

  // No token  send to login, preserving the intended destination
  if (!token) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const payload = await verifyJwt(token);
  const role = payload?.role as string | undefined;

  // Unreadable token  send to login
  if (!role) {
    const loginUrl = new URL('/auth/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Role is permitted for this route  let through
  if (allowedRoles.includes(role)) {
    if (pathname.startsWith('/admin/owner') && payload?.isOwner !== true) {
      return NextResponse.redirect(new URL('/admin/home', request.url));
    }

    return passThrough();
  }

  // Wrong role  bounce to their own dashboard (not to login)
  const home = ROLE_HOME[role] ?? '/auth/login';
  return NextResponse.redirect(new URL(home, request.url));
}

// Only run on page routes, not on API calls, static files, etc.
export const config = {
  matcher: [
    '/api/:path*',
    '/admin/:path*',
    '/superadmin/:path*',
    '/shop/:path*',
    '/tech/:path*',
    '/customer/:path*',
    '/manager/:path*',
    '/workorders/:path*',
    '/reports/:path*',
  ],
};