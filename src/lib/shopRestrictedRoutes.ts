/**
 * Shop-nav targets that returned HTTP 403 during the VIS audit and, when
 * probed together, tripped a sitewide Vercel Security Checkpoint (VIS-051–057).
 * Keep these out of shop navigation. Direct visits render an in-app Forbidden
 * page (HTTP 200) and must not call the underlying admin APIs.
 */
export const SHOP_EDGE_SENSITIVE_PATHS = [
  '/shop/admin/logs',
  '/shop/admin/health',
  '/shop/settings/api-keys',
  '/shop/settings/webhooks',
  '/shop/settings/sessions',
  '/shop/settings/two-factor',
] as const;

/** Platform env catalog is for FixTray admins only (VIS-024). */
export function canViewPlatformHealthCatalog(role: string | undefined | null): boolean {
  return role === 'admin' || role === 'superadmin';
}

export function isShopEdgeSensitivePath(pathname: string): boolean {
  const path = (pathname.split('?')[0] || '/').replace(/\/+$/, '') || '/';
  return SHOP_EDGE_SENSITIVE_PATHS.some(
    (blocked) => path === blocked || path.startsWith(`${blocked}/`)
  );
}

/**
 * These addresses stay out of shop navigation because probing their admin APIs
 * tripped a sitewide security checkpoint. Two-factor and sessions live in
 * Shop Settings → Security. API keys and webhooks are shop integrations.
 * Audit logs and platform health are not shop tools.
 */
export const SHOP_RESTRICTED_REDIRECTS = [
  { source: '/shop/settings/two-factor', destination: '/shop/settings?tab=security', permanent: false as const },
  { source: '/shop/settings/sessions', destination: '/shop/settings?tab=security', permanent: false as const },
  { source: '/shop/settings/api-keys', destination: '/shop/integrations', permanent: false as const },
  { source: '/shop/settings/webhooks', destination: '/shop/integrations', permanent: false as const },
  { source: '/shop/admin/logs', destination: '/shop/admin', permanent: false as const },
  { source: '/shop/admin/health', destination: '/shop/home', permanent: false as const },
] as const;

export function shopRestrictedDestination(pathname: string): string | null {
  const path = (pathname.split('?')[0] || '/').replace(/\/+$/, '') || '/';
  return SHOP_RESTRICTED_REDIRECTS.find((row) => row.source === path)?.destination ?? null;
}
