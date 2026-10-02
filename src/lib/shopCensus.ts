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

/** Approved means the shop account status is approved. Letter case does not matter. */
export function normalizeShopStatus(status: unknown): string {
  return String(status ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-');
}

export function isApprovedShop(shop: { status?: unknown } | null | undefined): boolean {
  return normalizeShopStatus(shop?.status) === 'approved';
}

export function countApprovedShops(shops: Array<{ status?: unknown }> | null | undefined): number {
  if (!Array.isArray(shops)) return 0;
  return shops.filter((shop) => isApprovedShop(shop)).length;
}

/** Label the stored status. Anything other than approved must not read as Approved. */
export function shopStatusLabel(status: unknown): string {
  const normalized = normalizeShopStatus(status);
  if (!normalized) return 'Unknown';
  if (normalized === 'approved') return 'Approved';
  if (normalized === 'pending') return 'Pending';
  if (normalized === 'suspended') return 'Suspended';
  if (normalized === 'denied') return 'Denied';
  if (normalized === 'demo-ended') return 'Demo ended';
  return normalized.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function numberOrZero(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
