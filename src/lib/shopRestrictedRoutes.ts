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
 * Audit logs stay on the shop admin hub. Sessions, two-factor, API keys,
 * webhooks, and shop health render their own pages and stay off the desktop
 * sidebar via SHOP_EDGE_SENSITIVE_PATHS.
 */
export const SHOP_RESTRICTED_REDIRECTS = [
  { source: '/shop/admin/logs', destination: '/shop/admin', permanent: false as const },
] as const;

export function shopRestrictedDestination(pathname: string): string | null {
  const path = (pathname.split('?')[0] || '/').replace(/\/+$/, '') || '/';
  return SHOP_RESTRICTED_REDIRECTS.find((row) => row.source === path)?.destination ?? null;
}
