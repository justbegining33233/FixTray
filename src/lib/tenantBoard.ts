import { monthKey, monthLabel } from '@/lib/platformRevenue';

/**
 * Manage Tenants was rendering customer rows and putting signup and
 * month-over-month percents on the all-time count, revenue, and jobs.
 * The headline is the rows on the page. A percent is used only when it
 * compares that same total with the prior period.
 */

export type TenantBoardRow = {
  createdAt?: string | Date | null;
  totalRevenue?: number | null;
  totalJobs?: number | null;
  revenueThisMonth?: number | null;
  revenueLastMonth?: number | null;
  jobsThisMonth?: number | null;
  jobsLastMonth?: number | null;
};

export type TenantBoardStats = {
  count: number;
  revenue: number;
  jobs: number;
  countLabel: string;
  jobsLabel: string;
};

function asDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Sum of the numbers on the rows. A missing amount is left out. A real zero stays zero. */
export function sumListed(values: Array<number | null | undefined>): number {
  return values.reduce<number>((sum, value) => {
    const amount = finite(value);
    return amount === null ? sum : sum + amount;
  }, 0);
}

export function listedMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Owner name, or a plain statement when the tenant has none. */
export function tenantOwnerText(ownerName: unknown): string {
  const name = typeof ownerName === 'string' ? ownerName.trim() : '';
  if (!name || /^n\/?a$/i.test(name) || name === '-' || name === '—') return 'No owner';
  return name;
}

/** A finite score, including zero. Missing and NaN are not a health of zero. */
export function tenantHealthScore(score: unknown): number | null {
  if (typeof score !== 'number' || !Number.isFinite(score)) return null;
  return score;
}

function percentLabel(current: number, previous: number): string {
  const raw = ((current - previous) / previous) * 100;
  return `${raw >= 0 ? '+' : ''}${raw.toFixed(1)}%`;
}

/**
 * Tag for an all-time total on the page.
 * A percent is shown only when this month is that whole total and the prior
 * month is the comparison. An empty or partial month is not a drop of the total.
 */
export function listedTotalChange(
  displayedTotal: number,
  thisMonth: number,
  lastMonth: number,
  now = new Date(),
): string {
  if (displayedTotal !== 0 && thisMonth === displayedTotal && lastMonth > 0) {
    return percentLabel(thisMonth, lastMonth);
  }
  if (thisMonth === 0 && displayedTotal !== 0) {
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return monthLabel(monthKey(previous));
  }
  return '';
}

export function tenantBoardStats(rows: TenantBoardRow[], now = new Date()): TenantBoardStats {
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  let createdThisMonth = 0;
  let createdLastMonth = 0;
  let latest: Date | null = null;
  for (const row of rows) {
    const created = asDate(row.createdAt);
    if (!created) continue;
    if (!latest || created > latest) latest = created;
    if (created >= startOfMonth) createdThisMonth += 1;
    else if (created >= startOfLast && created < startOfMonth) createdLastMonth += 1;
  }

  let countLabel: string;
  if (rows.length > 0 && createdThisMonth === rows.length && createdLastMonth > 0) {
    countLabel = percentLabel(createdThisMonth, createdLastMonth);
  } else if (rows.length > 0 && createdThisMonth === 0) {
    const stamp = latest && latest < startOfMonth ? latest : startOfLast;
    countLabel = monthLabel(monthKey(stamp));
  } else if (createdThisMonth !== rows.length) {
    countLabel = '';
  } else {
    countLabel = monthLabel(monthKey(now));
  }

  const jobs = sumListed(rows.map((row) => row.totalJobs));
  const jobsThisMonth = sumListed(rows.map((row) => row.jobsThisMonth));
  const jobsLastMonth = sumListed(rows.map((row) => row.jobsLastMonth));

  return {
    count: rows.length,
    revenue: sumListed(rows.map((row) => row.totalRevenue)),
    jobs,
    countLabel,
    jobsLabel: listedTotalChange(jobs, jobsThisMonth, jobsLastMonth, now),
  };
}
