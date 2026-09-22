export type PlatformUserFields = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
  shopName?: string | null;
  shop?: { shopName?: string | null } | null;
};

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
