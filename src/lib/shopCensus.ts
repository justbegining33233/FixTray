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

function numberOrZero(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
