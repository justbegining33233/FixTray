import { DEMO_ENDED_MESSAGE } from '@/lib/demoShopRules';

/**
 * Shop account status. Approval and Activate both store `approved`.
 * `active` is the old Activate spelling and still means the shop can sign in.
 * `inactive` is the old edit-form spelling of suspended.
 */

export const SHOP_ACCOUNT_STATUSES = ['pending', 'approved', 'suspended', 'denied', 'demo-ended'] as const;

export type ShopAccountStatus = (typeof SHOP_ACCOUNT_STATUSES)[number];

/** Status written by the approval flow and by Activate. */
export const SHOP_APPROVED_STATUS: ShopAccountStatus = 'approved';

export const SHOP_PENDING_LOGIN_MESSAGE =
  'This shop is pending approval. You can sign in after FixTray approves it.';

export const SHOP_SUSPENDED_LOGIN_MESSAGE =
  'This shop is suspended. Contact FixTray support to restore access.';

export const SHOP_DENIED_LOGIN_MESSAGE =
  'This shop was not approved. Contact FixTray support if that is a mistake.';

export const SHOP_BLOCKED_LOGIN_MESSAGE =
  'This shop cannot sign in. Contact FixTray support.';

export function normalizeShopAccountStatus(status: unknown): string {
  return String(status ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-');
}

/** Approved, including the legacy `active` spelling. Letter case does not matter. */
export function shopMayLogIn(status: unknown): boolean {
  const normalized = normalizeShopAccountStatus(status);
  return normalized === 'approved' || normalized === 'active';
}

export function shopStatusIs(status: unknown, expected: ShopAccountStatus): boolean {
  const normalized = normalizeShopAccountStatus(status);
  if (expected === 'approved') return shopMayLogIn(status);
  if (expected === 'suspended') return normalized === 'suspended' || normalized === 'inactive';
  return normalized === expected;
}

/**
 * Value to store. `active` becomes `approved`. `inactive` becomes `suspended`.
 * Anything outside the canonical set is rejected.
 */
export function canonicalShopStatusWrite(status: unknown): ShopAccountStatus | null {
  const normalized = normalizeShopAccountStatus(status);
  if (normalized === 'active') return 'approved';
  if (normalized === 'inactive') return 'suspended';
  if ((SHOP_ACCOUNT_STATUSES as readonly string[]).includes(normalized)) {
    return normalized as ShopAccountStatus;
  }
  return null;
}

export function shopLoginDenial(status: unknown): { httpStatus: 403; error: string } | null {
  if (shopMayLogIn(status)) return null;
  const normalized = normalizeShopAccountStatus(status);
  if (normalized === 'pending') return { httpStatus: 403, error: SHOP_PENDING_LOGIN_MESSAGE };
  if (normalized === 'suspended' || normalized === 'inactive') {
    return { httpStatus: 403, error: SHOP_SUSPENDED_LOGIN_MESSAGE };
  }
  if (normalized === 'denied') return { httpStatus: 403, error: SHOP_DENIED_LOGIN_MESSAGE };
  if (normalized === 'demo-ended') return { httpStatus: 403, error: DEMO_ENDED_MESSAGE };
  return { httpStatus: 403, error: SHOP_BLOCKED_LOGIN_MESSAGE };
}

/** Label a stored status with the canonical name. `active` reads as Approved. */
export function shopStatusLabel(status: unknown): string {
  const normalized = normalizeShopAccountStatus(status);
  if (!normalized) return 'Unknown';
  if (shopMayLogIn(status)) return 'Approved';
  if (normalized === 'pending') return 'Pending';
  if (normalized === 'suspended' || normalized === 'inactive') return 'Suspended';
  if (normalized === 'denied') return 'Denied';
  if (normalized === 'demo-ended') return 'Demo ended';
  return normalized.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Prisma filter for shops that may sign in, including the legacy `active` rows. */
export function operatingShopWhere() {
  return {
    OR: [
      { status: { equals: 'approved', mode: 'insensitive' as const } },
      { status: { equals: 'active', mode: 'insensitive' as const } },
    ],
  };
}
