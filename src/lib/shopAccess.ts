type ShopActor = {
  id?: string | null;
  role?: string | null;
  shopId?: string | null;
};

/**
 * Shop-scoped reads used to require `shopId === token.id`.
 * That is true for shop owners and false for managers and techs, whose id is
 * the staff row and whose shop lives on `shopId`. Platform admins may read any shop.
 */
export function actorMayAccessShop(
  actor: ShopActor | null | undefined,
  requestedShopId: string | null | undefined,
): boolean {
  if (!actor?.role || !requestedShopId) return false;
  if (actor.role === 'superadmin' || actor.role === 'admin') return true;
  if (actor.role === 'shop') return actor.id === requestedShopId;
  if (actor.role === 'manager' || actor.role === 'tech') {
    return typeof actor.shopId === 'string' && actor.shopId.length > 0 && actor.shopId === requestedShopId;
  }
  return false;
}

/** Prefer the stored shop id, then the shop id carried on the session token. */
export function resolveShopId(
  stored: string | null | undefined,
  tokenShopId: string | null | undefined,
): string {
  const fromStore = usableShopId(stored) || '';
  if (fromStore) return fromStore;
  return usableShopId(tokenShopId) || '';
}

/** Query values like "null", "undefined", and "current" are not shop ids. */
export function usableShopId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === 'current') return null;
  return trimmed;
}
