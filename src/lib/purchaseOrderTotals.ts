type LineLike = {
  quantity?: unknown;
  qty?: unknown;
  unitCost?: unknown;
};

type OrderLike = {
  status?: string | null;
  totalCost?: unknown;
  total?: unknown;
  items?: LineLike[] | null;
};

export function lineExtendedCost(item: LineLike): number {
  const qty = Number(item.quantity ?? item.qty ?? 0);
  const cost = Number(item.unitCost ?? 0);
  if (!Number.isFinite(qty) || !Number.isFinite(cost)) return 0;
  return qty * cost;
}

/** Prefer the sum of line items. Fall back to a stored header total only when lines are empty. */
export function purchaseOrderAmount(order: OrderLike): number {
  const fromLines = (order.items || []).reduce((sum, item) => sum + lineExtendedCost(item), 0);
  if (fromLines > 0) return fromLines;
  const stored = Number(order.totalCost ?? order.total ?? 0);
  return Number.isFinite(stored) ? stored : 0;
}

export function totalSpentFromOrders(orders: OrderLike[]): number {
  return orders
    .filter((order) => String(order.status || '').toLowerCase() !== 'cancelled')
    .reduce((sum, order) => sum + purchaseOrderAmount(order), 0);
}
