/**
 * Work-order parts come from the same inventory list the shop owner page
 * loads. Only a line that names that inventory row changes on-hand quantity.
 * A custom line has no inventory id, so it is not stock.
 */

import { inventoryRowsFromPayload, type ShopInventoryRow } from './inventoryItem';
import { shopIdForStaffInventory, usableShopId } from './shopAccess';

export function partsPickerShopId(options: {
  workOrderShopId?: string | null;
  role?: string | null;
  tokenShopId?: string | null;
  actorId?: string | null;
  storedShopId?: string | null;
}): string {
  const fromJob = usableShopId(options.workOrderShopId);
  if (fromJob) return fromJob;
  const role = (options.role || '').trim().toLowerCase();
  if (role === 'shop') return usableShopId(options.actorId) || usableShopId(options.storedShopId) || '';
  return shopIdForStaffInventory({
    role,
    tokenShopId: options.tokenShopId,
    storedShopId: options.storedShopId,
  });
}

export function partsPickerRows(payload: unknown): ShopInventoryRow[] {
  return inventoryRowsFromPayload(payload);
}

export function inventorySearchMatches(
  item: { name?: string | null; sku?: string | null },
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const name = String(item.name || '').toLowerCase();
  const sku = String(item.sku || '').toLowerCase();
  return name.includes(needle) || (sku.length > 0 && sku.includes(needle));
}

type PartRow = {
  inventoryItemId?: unknown;
  quantity?: unknown;
};

function linkedQuantity(parts: unknown): Map<string, number> {
  const totals = new Map<string, number>();
  if (!Array.isArray(parts)) return totals;
  for (const raw of parts) {
    if (!raw || typeof raw !== 'object') continue;
    const part = raw as PartRow;
    const id = typeof part.inventoryItemId === 'string' ? part.inventoryItemId.trim() : '';
    if (!id) continue;
    const qty = Number(part.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    totals.set(id, (totals.get(id) || 0) + qty);
  }
  return totals;
}

/** Positive delta means more of that inventory row was used. */
export function stockDeltasForPartUse(
  previous: unknown,
  next: unknown,
): Array<{ inventoryItemId: string; delta: number }> {
  const before = linkedQuantity(previous);
  const after = linkedQuantity(next);
  const ids = new Set([...before.keys(), ...after.keys()]);
  const deltas: Array<{ inventoryItemId: string; delta: number }> = [];
  for (const inventoryItemId of ids) {
    const delta = (after.get(inventoryItemId) || 0) - (before.get(inventoryItemId) || 0);
    if (delta !== 0) deltas.push({ inventoryItemId, delta });
  }
  return deltas;
}

export function quantityAfterUse(onHand: number, delta: number): number {
  const current = Number.isFinite(onHand) ? onHand : 0;
  return Math.max(0, current - delta);
}

const CLOSED_USAGE = new Set(['closed', 'waiting-for-payment']);

/** Linked parts count on any job. A custom line counts only on the old closed-job report. */
export function usageQuantityFromOrders(
  orders: Array<{ status?: string | null; partsUsed?: unknown }>,
): number {
  let total = 0;
  for (const order of orders) {
    if (!Array.isArray(order.partsUsed)) continue;
    const closed = CLOSED_USAGE.has(String(order.status || '').toLowerCase());
    for (const raw of order.partsUsed) {
      if (!raw || typeof raw !== 'object') continue;
      const part = raw as PartRow;
      const qty = Number(part.quantity);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      const linked = typeof part.inventoryItemId === 'string' && part.inventoryItemId.trim().length > 0;
      if (linked || closed) total += qty;
    }
  }
  return total;
}
