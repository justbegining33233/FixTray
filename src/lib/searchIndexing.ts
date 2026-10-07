import type { Metadata } from 'next';

/**
 * Path prefixes that must stay out of Google's index.
 * `/api/` keeps the trailing slash from robots.txt. Matching uses a boundary
 * so `/tech` does not also hide `/tech-offline`.
 */
export const PRIVATE_PATH_PREFIXES = [
  '/api/',
  '/shop',
  '/manager',
  '/tech',
  '/customer',
  '/admin',
  '/superadmin',
  '/auth',
  '/workorders',
  '/reports',
  '/payment',
  '/sign',
  '/register',
  '/offline',
  '/forbidden',
] as const;

/** Request header middleware sets so the root layout can emit noindex metadata. */
export const NOINDEX_REQUEST_HEADER = 'x-fixtray-noindex';

export const NOINDEX_ROBOTS = { index: false, follow: false } as const;

export const NOINDEX_METADATA: Metadata = {
  robots: NOINDEX_ROBOTS,
};

export function isNoindexPath(pathname: string): boolean {
  const path = (pathname.split('?')[0] || '/').replace(/\/+$/, '') || '/';
  return PRIVATE_PATH_PREFIXES.some((prefix) => {
    if (prefix.endsWith('/')) {
      const bare = prefix.slice(0, -1);
      return path === bare || path.startsWith(prefix);
    }
    return path === prefix || path.startsWith(`${prefix}/`);
  });
}

/** Response header for private HTML, auth redirects, and /api. */
export function setNoindexHeader(target: Headers, pathname: string): void {
  if (!isNoindexPath(pathname)) return;
  target.set('X-Robots-Tag', 'noindex, nofollow');
}
