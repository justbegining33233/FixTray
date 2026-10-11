import { normalizeShopAccountStatus, shopMayLogIn, shopStatusLabel as labelShopStatus } from '@/lib/shopAccountStatus';

export { normalizeShopAccountStatus } from '@/lib/shopAccountStatus';

/** Headline shop count shared by owner home, manage-shops, and analytics. */
export type ShopHeadlineInput = {
  totalShops?: number | null;
  approvedShops?: number | null;
  activeShops?: number | null;
} | null | undefined;

export function ownerShopHeadline(metrics: ShopHeadlineInput) {
  return {
    totalShops: numberOrZero(metrics?.totalShops),
    approvedShops: numberOrZero(metrics?.approvedShops),
    activeUsage: numberOrZero(metrics?.activeShops),
  };
}

/** Approved means the shop may sign in: `approved`, or the legacy Activate value `active`. */
export function normalizeShopStatus(status: unknown): string {
  return normalizeShopAccountStatus(status);
}

export function isApprovedShop(shop: { status?: unknown } | null | undefined): boolean {
  return shopMayLogIn(shop?.status);
}

export function countApprovedShops(shops: Array<{ status?: unknown }> | null | undefined): number {
  if (!Array.isArray(shops)) return 0;
  return shops.filter((shop) => isApprovedShop(shop)).length;
}

/** @deprecated Use shopStatusLabel from shopAccountStatus. Kept so older imports still label `active` as Approved. */
export function shopStatusLabel(status: unknown): string {
  return labelShopStatus(status);
}

function numberOrZero(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
