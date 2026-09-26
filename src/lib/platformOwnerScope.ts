/**
 * The platform owner (supadm1006, Super Admin) runs FixTray itself: shop
 * approvals, users, platform settings, revenue and fees, health, audit, and
 * platform messaging. Shop-operational screens (jobs, DVI, inventory,
 * schedule, techs, shop settings, shop reports, ...) belong to shops, so the
 * platform owner is sent back to the platform home instead of seeing them.
 *
 * Only platform actors are affected. Shop, manager, tech, and customer
 * access is unchanged.
 */

export const PLATFORM_HOME = '/admin/home';

/** Shop, staff, and customer portals. */
export const SHOP_SCOPED_PREFIXES = [
  '/shop',
  '/tech',
  '/manager',
  '/customer',
  '/workorders',
  '/reports',
  '/tech-offline',
] as const;

/** Pages under /admin that are shop operations, not platform administration. */
export const SHOP_LEVEL_ADMIN_PATHS = [
  '/admin/dvi-approvals',
  '/admin/inventory',
  '/admin/environmental-fees',
  '/admin/compliance-dashboard',
  '/admin/campaigns',
  '/admin/performance',
] as const;

export type PlatformActor = {
  role?: string | null;
  isSuperAdmin?: boolean | null;
  isOwner?: boolean | null;
} | null | undefined;

function normalize(role?: string | null): string {
  return (role || '').trim().toLowerCase();
}

function cleanPath(pathname: string): string {
  const path = pathname.split('?')[0].split('#')[0].replace(/\/+$/, '');
  return path || '/';
}

function underPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** Admin login issues role `superadmin` (client may store `admin`). Both are platform operators. */
export function isPlatformActor(actor: PlatformActor): boolean {
  if (!actor) return false;
  const role = normalize(actor.role);
  if (role === 'superadmin' || role === 'admin') return true;
  // The flags never elevate shop, manager, tech, or customer roles.
  return false;
}

export function isShopScopedPath(pathname: string): boolean {
  const path = cleanPath(pathname);
  if (SHOP_SCOPED_PREFIXES.some((prefix) => underPrefix(path, prefix))) return true;
  return SHOP_LEVEL_ADMIN_PATHS.some((prefix) => underPrefix(path, prefix));
}

/** Platform home for a platform actor on a shop page, otherwise null. */
export function platformOwnerRedirect(pathname: string, actor: PlatformActor): string | null {
  if (!isPlatformActor(actor)) return null;
  return isShopScopedPath(pathname) ? PLATFORM_HOME : null;
}

/** True when a nav href is a shop-operational page. */
export function isShopScopedHref(href: string): boolean {
  return isShopScopedPath(href);
}
