import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

// Lazy JWT secret — never evaluate at module-load time because Vercel's
// build-time "Collecting page data" step imports every route module but
// runtime env vars (like JWT_SECRET) are not yet available.
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV !== undefined) {
    // At runtime on Vercel the var must exist; during build it may not.
    // During the build phase VERCEL=1 and VERCEL_ENV are set but secrets are not injected.
    // We only throw at actual request-time, not build-time.
    console.error('[auth] WARNING: JWT_SECRET is not set in production runtime.');
  }
  return 'dev-only-insecure-secret-do-not-use-in-prod';
}
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '24h';
const DEFAULT_REFRESH_EXPIRES_DAYS = Number(process.env.REFRESH_EXPIRES_DAYS || '30');

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateAccessToken(payload: Record<string, unknown>): string {
  const options: SignOptions = { expiresIn: ACCESS_TOKEN_EXPIRES_IN as any };
  return jwt.sign(payload, getJwtSecret(), options);
}

/** Short-lived token for 2FA challenge step (default 5 minutes) */
export function generateTempToken(payload: Record<string, unknown>, expiresIn = '5m'): string {
  const options: SignOptions = { expiresIn: expiresIn as any };
  return jwt.sign(payload, getJwtSecret(), options);
}

// Backwards-compatible alias used by some routes
export const generateToken = generateAccessToken;

export function generateRandomToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function verifyToken(token: string): any {
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    return decoded;
  } catch {
    return null;
  }
}

export function refreshExpiryDate(days = DEFAULT_REFRESH_EXPIRES_DAYS) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export function authenticateRequest(request: NextRequest): AuthUser | null {
  const token = getAuthToken(request);
  if (!token) return null;
  
  const payload = verifyToken(token);
  if (!payload) return null;
  
  // 'admin' role is deprecated — all admin-panel users are 'superadmin'.
  // Normalise old tokens that still carry role:'admin' so every downstream
  // check (auth.role === 'superadmin') works without touching 20+ files.
  if (payload.role === 'admin') payload.role = 'superadmin';
  
  return payload as AuthUser;
}

export function requireRole(request: NextRequest, roles: string[]): NextResponse | AuthUser {
  const user = authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Always include superadmin in any role check that includes 'admin'
  const effectiveRoles = roles.includes('admin') && !roles.includes('superadmin')
    ? [...roles, 'superadmin']
    : roles;
  if (!effectiveRoles.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return user;
}

export interface AuthUser {
  id: string;
  email?: string;
  username?: string;
  role: 'customer' | 'tech' | 'manager' | 'admin' | 'shop' | 'superadmin';
  shopId?: string;
  isSuperAdmin?: boolean;
  isOwner?: boolean;
}

export function getAuthToken(request: NextRequest): string | null {
  // Prefer Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check for sos_auth cookie (common login cookie)
  try {
    const sosAuthCookie = request.cookies.get('sos_auth')?.value;
    if (sosAuthCookie) return sosAuthCookie;
  } catch {
    // If cookies API isn't available, fall back to parsing Cookie header
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/sos_auth=([^;]+)/);
    if (match) return match[1];
  }

  return null;
}
