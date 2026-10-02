/**
 * Paid work-order revenue shared by staff home and Financial Reports.
 * A month with no payments is not the headline. Home was showing the new
 * calendar month as $0.00 and -100% while Financial Reports still listed
 * the last month that actually had payments.
 */

export type PaidOrderStamp = {
  amountPaid?: number | null;
  createdAt: Date | string;
};

export type PaidMonth = {
  key: string;
  label: string;
  revenue: number;
  count: number;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function asDate(value: Date | string): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-');
  const name = MONTHS[Number(month) - 1] || month;
  return `${name} ${year}`;
}

/** Paid totals for each month in the reporting window that has a payment. */
export function paidMonths(orders: PaidOrderStamp[], now = new Date(), window = 6): PaidMonth[] {
  const start = new Date(now.getFullYear(), now.getMonth() - (window - 1), 1);
  const buckets = new Map<string, { revenue: number; count: number }>();
  for (const order of orders) {
    const created = asDate(order.createdAt);
    if (!created || created < start) continue;
    const key = monthKey(created);
    const bucket = buckets.get(key) || { revenue: 0, count: 0 };
    bucket.revenue += Number(order.amountPaid) || 0;
    bucket.count += 1;
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, bucket]) => ({
      key,
      label: monthLabel(key),
      revenue: bucket.revenue,
      count: bucket.count,
    }));
}

export type RevenueHeadline = {
  revenue: number;
  label: string;
  /** Month name, or a percent when the headline month is the current month. */
  changeLabel: string;
  months: PaidMonth[];
};

/**
 * The figure Financial Reports shows for its latest month.
 * An empty new month does not replace that figure or become a -100% drop.
 */
export function headlinePaidMonth(orders: PaidOrderStamp[], now = new Date()): RevenueHeadline {
  const months = paidMonths(orders, now);
  const latest = months[months.length - 1];
  if (!latest) {
    const label = monthLabel(monthKey(now));
    return { revenue: 0, label, changeLabel: label, months };
  }
  const currentKey = monthKey(now);
  if (latest.key !== currentKey) {
    return { revenue: latest.revenue, label: latest.label, changeLabel: latest.label, months };
  }
  const [year, month] = latest.key.split('-').map(Number);
  const previousDate = new Date(year, month - 2, 1);
  const previous = months.find((entry) => entry.key === monthKey(previousDate));
  if (!previous || previous.revenue <= 0) {
    return { revenue: latest.revenue, label: latest.label, changeLabel: latest.label, months };
  }
  const raw = ((latest.revenue - previous.revenue) / previous.revenue) * 100;
  const changeLabel = `${raw >= 0 ? '+' : ''}${raw.toFixed(1)}%`;
  return { revenue: latest.revenue, label: latest.label, changeLabel, months };
}

/** Staff and the platform owner can open Revenue & Payouts. A 403 is not a logout. */
export function canViewPlatformRevenue(actor: { role?: string | null } | null | undefined): boolean {
  const role = String(actor?.role || '').trim().toLowerCase();
  return role === 'admin' || role === 'superadmin';
}

export function revenueLoginRedirect(status: number): '/auth/login' | null {
  return status === 401 ? '/auth/login' : null;
}

export type FeeHeadline = {
  /** All paid orders times the saved fee. Same figure as Financial Reports platform fees. */
  collected: number;
  /** Fees in the same month Financial Reports uses for that fee total. */
  periodFees: number;
  periodLabel: string;
  /** Month name, or a percent when that month is the current month and the prior month was higher. */
  changeLabel: string;
};

/**
 * Customers was labeling the all-time fee total with this calendar month
 * versus last month. An empty new month became -100% beside a collected
 * amount that had not dropped.
 */
export function platformFeeHeadline(orders: PaidOrderStamp[], feePerOrder: number, now = new Date()): FeeHeadline {
  const fee = typeof feePerOrder === 'number' && Number.isFinite(feePerOrder) ? Math.max(0, feePerOrder) : 0;
  const collected = orders.length * fee;
  const months = paidMonths(orders, now);
  const latest = months[months.length - 1];
  if (!latest) {
    const label = monthLabel(monthKey(now));
    return { collected, periodFees: 0, periodLabel: label, changeLabel: label };
  }
  const periodFees = latest.count * fee;
  if (latest.key !== monthKey(now)) {
    return { collected, periodFees, periodLabel: latest.label, changeLabel: latest.label };
  }
  const [year, month] = latest.key.split('-').map(Number);
  const previousDate = new Date(year, month - 2, 1);
  const previous = months.find((entry) => entry.key === monthKey(previousDate));
  if (!previous || previous.count <= 0) {
    return { collected, periodFees, periodLabel: latest.label, changeLabel: latest.label };
  }
  const previousFees = previous.count * fee;
  const raw = ((periodFees - previousFees) / previousFees) * 100;
  return {
    collected,
    periodFees,
    periodLabel: latest.label,
    changeLabel: `${raw >= 0 ? '+' : ''}${raw.toFixed(1)}%`,
  };
}
