import { NextRequest, NextResponse } from 'next/server';
import { forbiddenFromPath, isRouteAllowed, rolesForPath } from './lib/roleAccess';
import { PLATFORM_HOME, isShopScopedPath, isStaticAssetPath, platformOwnerRedirect } from './lib/platformOwnerScope';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;

  // CRITICAL SECURITY FIX: Match auth.ts behavior - throw in production, warn in dev
  if (process.env.NODE_ENV === 'production') {
    const error = new Error(
      'FATAL SECURITY ERROR: JWT_SECRET environment variable is not set in production. ' +
      'This is required for secure token verification. Set JWT_SECRET in your environment variables.'
    );
    console.error('[proxy]', error.message);
    throw error;
  }
  
  console.warn('[SECURITY WARNING] JWT_SECRET not set. Using development-only secret.');
  return process.env.JWT_DEV_SECRET || 'dev-only-local-secret-change-in-production';
}

function resolveAllowedOrigin(request: NextRequest): string | null {
  const origin = request.headers.get('origin');
  if (!origin) return null;

  const configured = process.env.CORS_ORIGINS;
  
  // CRITICAL SECURITY FIX: Safe defaults in development
  if (!configured) {
    // Never accept wildcard with credentials - always use explicit whitelist
    const allowedDevOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001'
    ];
    return allowedDevOrigins.includes(origin) ? origin : null;
  }

  const allowed = configured.split(',').map((item) => item.trim()).filter(Boolean);
  
  // CRITICAL SECURITY FIX: Never allow wildcard '*' with credentials
  if (allowed.includes('*')) {
    console.error(
      '[SECURITY ERROR] CORS_ORIGINS contains wildcard "*" but credentials are enabled. ' +
      'This is a critical security vulnerability. The request is being rejected.'
    );
    return null;
  }
  
  // Only allow configured origins
  return allowed.includes(origin) ? origin : null;
}

//  Role definitions 

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

/** Android/iOS app cookie or user-agent. Layout reads `x-fixtray-native` to keep the phone shell. */
export function nativePlatformFromRequest(request: NextRequest): 'android' | 'ios' | null {
  const nativeCookie = request.cookies.get('x-fixtray-native')?.value;
  const ua = request.headers.get('user-agent') ?? '';
  if (nativeCookie === 'android' || nativeCookie === 'ios') return nativeCookie;
  if (ua.includes('FixTray-Android-App-Pro')) return 'android';
  if (ua.includes('FixTray-iOS-App-Pro')) return 'ios';
  return null;
}

export function requestHeadersWithNativePlatform(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  const nativePlatform = nativePlatformFromRequest(request);
  if (nativePlatform) headers.set('x-fixtray-native', nativePlatform);
  return headers;
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

  // Installed Android/iOS shell opening the marketing URL. Browser tabs fall through.
  const shellEntry = await installedShellEntryRedirect(request);
  if (shellEntry) return shellEntry;

  // layout.tsx reads x-fixtray-native so the phone shell is server-rendered at any width.
  const requestHeaders = requestHeadersWithNativePlatform(request);
  const passThrough = () => NextResponse.next({ request: { headers: requestHeaders } });
  // 

  const gated = await gateCrossRole(request);
  if (gated) return gated;

  return passThrough();
}

/**
 * Wrong-role page visits render the in-app Forbidden page.
 * Returns null when the request should continue (public, API, or allowed role).
 */
export async function gateCrossRole(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/api/') || pathname === '/admin/login') return null;

  const token =
    request.cookies.get('sos_auth')?.value ??
    request.headers.get('authorization')?.replace('Bearer ', '');

  // The platform owner only sees platform pages. Shop screens send it home.
  // Leave scripts and styles alone so a cached offline page can still load them.
  if (token && isShopScopedPath(pathname) && !isStaticAssetPath(pathname)) {
    const ownerPayload = await verifyJwt(token);
    const ownerRole = typeof ownerPayload?.role === 'string' ? ownerPayload.role : undefined;
    if (platformOwnerRedirect(pathname, { role: ownerRole })) {
      return NextResponse.redirect(new URL(PLATFORM_HOME, request.url));
    }
  }

  if (!rolesForPath(pathname)) return null;

  if (!token) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const payload = await verifyJwt(token);
  const role = typeof payload?.role === 'string' ? payload.role : undefined;
  if (!role) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  if (isRouteAllowed(pathname, {
    role,
    isOwner: payload?.isOwner === true,
    isSuperAdmin: payload?.isSuperAdmin === true,
  })) {
    if (pathname.startsWith('/admin/owner') && payload?.isOwner !== true) {
      return NextResponse.redirect(new URL('/admin/home', request.url));
    }
    return null;
  }

  const forbidden = request.nextUrl.clone();
  const target = forbiddenFromPath(pathname);
  const [path, search = ''] = target.split('?');
  forbidden.pathname = path;
  forbidden.search = search ? `?${search}` : '';
  return NextResponse.rewrite(forbidden);
}

/**
 * Native cookie or app user-agent on `/` goes to login, or ROLE_HOME when sos_auth verifies.
 * Shop uses /shop/admin here because the profile-complete flag lives in localStorage, not the JWT.
 * Standalone display-mode is invisible on the server; the landing page handles that in the browser.
 */
export async function installedShellEntryRedirect(request: NextRequest): Promise<NextResponse | null> {
  if (request.nextUrl.pathname !== '/') return null;

  const nativeCookie = request.cookies.get('x-fixtray-native')?.value;
  const ua = request.headers.get('user-agent') ?? '';
  const installedNative = Boolean(nativeCookie)
    || ua.includes('FixTray-Android-App')
    || ua.includes('FixTray-iOS-App');
  if (!installedNative) return null;

  const token = request.cookies.get('sos_auth')?.value;
  let destination = '/auth/login';
  if (token) {
    const payload = await verifyJwt(token);
    const role = typeof payload?.role === 'string' ? payload.role : '';
    if (role && ROLE_HOME[role]) destination = ROLE_HOME[role];
  }
  return NextResponse.redirect(new URL(destination, request.url));
}

// Only run on page routes, not on API calls, static files, etc.
export const config = {
  matcher: [
    '/',
    '/api/:path*',
    '/admin/:path*',
    '/superadmin/:path*',
    '/shop/:path*',
    '/tech/:path*',
    '/customer/:path*',
    '/manager/:path*',
    '/workorders/:path*',
    '/reports/:path*',
    '/tech-offline',
    '/tech-offline/:path*',
  ],
};