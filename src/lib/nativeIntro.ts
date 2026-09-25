/**
 * Where a Capacitor cold launch should go after the bundled intro.
 * The website never plays that video. The native page navigates to
 * /auth/login?from=intro, and this decides login vs the role dashboard.
 */

export type IntroTokenClaims = {
  role?: string;
  exp?: number;
};

export type IntroSession = {
  role: string;
  exp?: number;
  shopProfileComplete: boolean;
};

const ROLE_DASHBOARD: Record<string, string> = {
  admin: '/admin/home',
  superadmin: '/admin/home',
  manager: '/manager/home',
  tech: '/tech/home',
  customer: '/customer/dashboard',
};

/** Role home for a still-valid session, or null when the login screen should stay. */
export function introHandoffPath(session: IntroSession | null, now = Date.now()): string | null {
  if (!session?.role) return null;
  if (typeof session.exp === 'number' && now >= session.exp * 1000) return null;
  if (session.role === 'shop') {
    return session.shopProfileComplete ? '/shop/home' : '/shop/complete-profile';
  }
  return ROLE_DASHBOARD[session.role] ?? null;
}

export function readIntroSession(
  storage: { getItem(key: string): string | null },
  decode: (token: string) => IntroTokenClaims | null,
): IntroSession | null {
  const token = storage.getItem('token');
  if (!token) return null;
  const claims = decode(token);
  if (!claims) return null;
  const role = claims.role || storage.getItem('userRole') || '';
  if (!role) return null;
  return {
    role,
    exp: claims.exp,
    shopProfileComplete: storage.getItem('shopProfileComplete') === 'true',
  };
}
