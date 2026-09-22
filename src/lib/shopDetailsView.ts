export type ShopDetailsStats = {
  totalWorkOrders: number;
  completedWorkOrders: number;
  totalRevenue: number;
  technicians: number;
  customers: number;
  /** Null when the payload did not include a rating. */
  avgRating: number | null;
};

export type ShopDetailsView = {
  id: string;
  shopName: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  shopType: string;
  status: string;
  businessLicense: string;
  insurancePolicy: string;
  profileComplete: boolean;
  createdAt: string;
  approvedAt: string | null;
  stats: ShopDetailsStats;
};

const EMPTY_STATS: ShopDetailsStats = {
  totalWorkOrders: 0,
  completedWorkOrders: 0,
  totalRevenue: 0,
  technicians: 0,
  customers: 0,
  avgRating: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function countOrZero(...values: unknown[]): number {
  for (const value of values) {
    const parsed = finiteNumber(value);
    if (parsed != null) return parsed;
  }
  return 0;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return '';
}

/** Render-safe metrics. Missing stats never throw; counts default to 0. */
export function shopDetailsMetrics(
  shop: { stats?: Partial<ShopDetailsStats> | null } | null | undefined,
): ShopDetailsStats {
  const stats = shop?.stats;
  if (!stats) return { ...EMPTY_STATS };
  return {
    totalWorkOrders: countOrZero(stats.totalWorkOrders),
    completedWorkOrders: countOrZero(stats.completedWorkOrders),
    totalRevenue: countOrZero(stats.totalRevenue),
    technicians: countOrZero(stats.technicians),
    customers: countOrZero(stats.customers),
    avgRating: finiteNumber(stats.avgRating),
  };
}

/**
 * Accepts either the shop-details page shape or `{ shop }` from
 * GET /api/admin/shops/:id (name, totalJobs, techCount, rating).
 */
export function normalizeShopDetails(payload: unknown): ShopDetailsView | null {
  if (!isRecord(payload)) return null;
  const shop = isRecord(payload.shop) ? payload.shop : payload;
  const id = text(shop.id);
  const shopName = firstText(shop.shopName, shop.name);
  if (!id && !shopName) return null;

  const nested = isRecord(shop.stats) ? shop.stats : null;
  const approvedRaw = shop.approvedAt;

  return {
    id,
    shopName,
    ownerName: text(shop.ownerName),
    email: text(shop.email),
    phone: text(shop.phone),
    address: text(shop.address),
    city: text(shop.city),
    state: text(shop.state),
    zipCode: text(shop.zipCode),
    shopType: text(shop.shopType),
    status: text(shop.status, 'pending'),
    businessLicense: text(shop.businessLicense),
    insurancePolicy: text(shop.insurancePolicy),
    profileComplete: shop.profileComplete === true,
    createdAt: firstText(shop.createdAt),
    approvedAt: typeof approvedRaw === 'string' && approvedRaw ? approvedRaw : null,
    stats: {
      totalWorkOrders: countOrZero(nested?.totalWorkOrders, shop.totalWorkOrders, shop.totalJobs),
      completedWorkOrders: countOrZero(nested?.completedWorkOrders, shop.completedWorkOrders, shop.completedJobs),
      totalRevenue: countOrZero(nested?.totalRevenue, shop.totalRevenue),
      technicians: countOrZero(nested?.technicians, shop.technicians, shop.techCount),
      customers: countOrZero(nested?.customers, shop.customers, shop.customerCount),
      avgRating: finiteNumber(nested?.avgRating ?? shop.avgRating ?? shop.rating),
    },
  };
}

export function formatShopCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '0';
  return String(value);
}

export function formatShopMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '$0';
  return `$${value.toLocaleString()}`;
}

export function formatShopRating(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '\u2014';
  return value.toFixed(1);
}

export function formatShopDateTime(value: string | null | undefined): string {
  if (!value) return '\u2014';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '\u2014';
  return `${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
}
