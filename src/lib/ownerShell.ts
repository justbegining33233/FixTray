/** New menu: open the manual shop registration form, not the shops list. */
export const OWNER_ADD_SHOP_HREF = '/admin/manage-shops/new';

/** New menu: open the create-admin form, not the users list. */
export const OWNER_ADD_USER_HREF = '/superadmin/users/new';

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
