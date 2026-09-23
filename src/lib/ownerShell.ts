/** New menu: open the manual shop registration form, not the shops list. */
export const OWNER_ADD_SHOP_HREF = '/admin/manage-shops/new';

/** New menu: open the create-user form, not the users list. */
export const OWNER_ADD_USER_HREF = '/admin/user-management/new';

/** Shop details page for a manage-shops id, with an explicit shops back target. */
export function shopDetailsHref(shopId: string, from = 'manage-shops'): string {
  const id = encodeURIComponent(shopId.trim());
  const source = encodeURIComponent((from || 'manage-shops').trim() || 'manage-shops');
  return `/admin/shop-details/${id}?from=${source}`;
}

/**
 * `/admin/manage-shops?id=` must leave the list and open that shop.
 * Returns null when there is no shop id to open.
 */
export function manageShopsIdRedirect(id: string | null | undefined): string | null {
  const shopId = (id ?? '').trim();
  if (!shopId) return null;
  return shopDetailsHref(shopId, 'manage-shops');
}

/**
 * The owner tile grid is /admin/home. /superadmin/analytics must render the
 * analytics page; treating that path as the shell home hides its content.
 */
export function superadminMobileIsHome(pathname: string): boolean {
  if (pathname === '/superadmin/analytics' || pathname.startsWith('/superadmin/analytics/')) {
    return false;
  }
  return pathname === '/superadmin/home';
}

/** Shop details returns to the shops surface that opened it, never customers. */
export function shopDetailsBackTarget(from: string | null | undefined): { href: string; label: string } {
  const source = (from || '').trim().toLowerCase();
  if (
    source === 'accepted' ||
    source === 'accepted-shops' ||
    source === '/admin/accepted-shops'
  ) {
    return { href: '/admin/accepted-shops', label: 'Back to Accepted Shops' };
  }
  return { href: '/admin/manage-shops', label: 'Back to Manage Shops' };
}
