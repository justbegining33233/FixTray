export type PlatformUserFields = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
  shopName?: string | null;
  shop?: { shopName?: string | null } | null;
};

function cleanNamePart(value?: string | null): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || /^(undefined|null)$/i.test(trimmed)) return '';
  return trimmed;
}

/** Joined name, or a readable fallback when the clocked-in row has no name. */
export function displayPersonName(
  firstName?: string | null,
  lastName?: string | null,
  fallback = 'Team member',
): string {
  const name = personName(cleanNamePart(firstName), cleanNamePart(lastName), '');
  return name || cleanNamePart(fallback) || 'Team member';
}

/** Hide blank and "undefined undefined" labels already stored on a payload. */
export function displayEmployeeLabel(name?: string | null, fallback = 'Team member'): string {
  if (typeof name !== 'string') return fallback;
  const cleaned = name
    .split(/\s+/)
    .map((part) => cleanNamePart(part))
    .filter(Boolean)
    .join(' ');
  return cleaned || fallback;
}

export function personName(
  firstName?: string | null,
  lastName?: string | null,
  fallback?: string | null,
): string {
  const joined = [firstName, lastName]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ')
    .trim();
  if (joined) return joined;
  return typeof fallback === 'string' ? fallback.trim() : '';
}

/** Name and shop for the superadmin user table. Empty strings stay empty so the page can show a dash. */
export function platformUserLabel(user: PlatformUserFields): { name: string; shopName: string } {
  const explicit = typeof user.name === 'string' ? user.name.trim() : '';
  const name = explicit || personName(user.firstName, user.lastName, user.username || user.email || '');
  const shopName = (user.shopName || user.shop?.shopName || '').trim();
  return { name, shopName };
}

export function latestShopName(
  workOrders: Array<{ createdAt?: string | Date | null; shop?: { shopName?: string | null } | null }> | null | undefined,
): string {
  if (!Array.isArray(workOrders) || workOrders.length === 0) return '';
  const latest = [...workOrders].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  })[0];
  return latest?.shop?.shopName?.trim() || '';
}
