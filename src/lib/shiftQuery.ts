export type ShiftReader = {
  id: string;
  role: string;
  shopId?: string | null;
};

export function shiftListWhere(input: {
  shopId?: string | null;
  techId?: string | null;
  status?: string | null;
  now?: Date;
}): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (input.shopId) where.shopId = input.shopId;
  if (input.techId) where.techId = input.techId;
  const status = String(input.status || 'all');
  const now = input.now ?? new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (status === 'upcoming') {
    where.date = { gte: start };
    where.status = { notIn: ['completed', 'cancelled'] };
  } else if (status === 'completed') {
    where.status = 'completed';
  } else if (status !== 'all') {
    where.status = status;
  }
  return where;
}

/**
 * Techs read only their own shifts. Shop id comes from the token, not the query,
 * because the tech page does not know a shop id and "null" must not 400/500.
 */
export function resolveShiftReader(
  actor: ShiftReader,
  requestedShopId: string | null,
  requestedTechId: string | null,
): { shopId: string | null; techId: string | null } | { error: string; status: number } {
  const shopFromToken = actor.role === 'shop' ? (actor.shopId || actor.id) : (actor.shopId || '');
  if (actor.role === 'tech') {
    return { shopId: shopFromToken || null, techId: actor.id };
  }
  if (actor.role === 'admin' || actor.role === 'superadmin') {
    return { shopId: requestedShopId || shopFromToken || null, techId: requestedTechId };
  }
  if (actor.role === 'shop' || actor.role === 'manager') {
    if (!shopFromToken) return { error: 'shopId required', status: 400 };
    if (requestedShopId && requestedShopId !== shopFromToken) return { error: 'Forbidden', status: 403 };
    return { shopId: shopFromToken, techId: requestedTechId };
  }
  return { error: 'Forbidden', status: 403 };
}
