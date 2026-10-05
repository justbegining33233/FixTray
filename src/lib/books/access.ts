/**
 * Shop books and clocks stay with the shop. The fee year-end page is the
 * platform owner login only. The username is compared exactly.
 */

export const PLATFORM_FEE_YEAR_ACCOUNT = 'SupAdm1006';
export const PLATFORM_FEE_YEAR_HREF = '/admin/fee-year-end';

export function isPlatformFeeYearAccount(username: unknown): boolean {
  return typeof username === 'string' && username.trim() === PLATFORM_FEE_YEAR_ACCOUNT;
}

export function isPlatformFeeYearPath(pathname: string): boolean {
  const path = pathname.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  return path === PLATFORM_FEE_YEAR_HREF || path.startsWith(`${PLATFORM_FEE_YEAR_HREF}/`);
}

export interface BooksAccess {
  shopLedger: boolean;
  staffTotals: boolean;
  ownClock: boolean;
  parts: boolean;
  quickBooks: boolean;
  /** OAuth connect, account mapping, and sync. Shop owner only. */
  quickBooksConnect: boolean;
  platformFeeYear: boolean;
}

export function booksAccess(role: string | null | undefined, username?: unknown): BooksAccess {
  const normalized = String(role || '').trim().toLowerCase();
  const shopStaff = normalized === 'shop' || normalized === 'manager';
  const clockRole = shopStaff || normalized === 'tech';
  return {
    shopLedger: shopStaff,
    staffTotals: shopStaff,
    ownClock: clockRole,
    parts: shopStaff,
    quickBooks: shopStaff,
    quickBooksConnect: normalized === 'shop',
    platformFeeYear: isPlatformFeeYearAccount(username)
      && (normalized === 'admin' || normalized === 'superadmin'),
  };
}

export function shopIdForBooks(actor: { role?: string | null; id?: string | null; shopId?: string | null }): string | null {
  const role = String(actor.role || '').trim().toLowerCase();
  if (role === 'shop') return actor.id || null;
  if (role === 'manager' || role === 'tech') return actor.shopId || null;
  return null;
}
