export const INVENTORY_TYPES = ['part', 'labor'] as const;
export type InventoryType = (typeof INVENTORY_TYPES)[number];

/** Accept displayed labels such as "Part" / "Labor" and store the canonical value. */
export function normalizeInventoryType(value: unknown): InventoryType | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'part' || normalized === 'parts') return 'part';
  if (normalized === 'labor' || normalized === 'labour') return 'labor';
  return null;
}

export function formatInventoryType(value: unknown): string {
  const normalized = normalizeInventoryType(value);
  if (normalized === 'part') return 'Part';
  if (normalized === 'labor') return 'Labor';
  return typeof value === 'string' ? value : '';
}

export function optionalInventoryText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

export interface ShopInventoryRow {
  id: string;
  name: string;
  type?: string | null;
  sku?: string | null;
  quantity?: number | null;
  price?: number | null;
  reorderPoint?: number | null;
  supplier?: string | null;
  notes?: string | null;
}

/**
 * Same low-stock rule as the shop owner inventory page: a reorder point is
 * set and the on-hand quantity is at or below it. A missing reorder point
 * is not low stock.
 */
export function isShopInventoryLowStock(item: {
  quantity?: number | null;
  reorderPoint?: number | null;
}): boolean {
  if (!item.reorderPoint) return false;
  return Number(item.quantity) <= Number(item.reorderPoint);
}

/**
 * Rows from the shop owner inventory API (`{ inventory }`).
 * That list is the shop's stock. An `{ items }` payload from the separate
 * inventory-stock table is only used when the owner list is absent.
 */
export function inventoryRowsFromPayload(data: unknown): ShopInventoryRow[] {
  if (!data || typeof data !== 'object') return [];
  const record = data as { inventory?: unknown; items?: unknown };
  const rows = Array.isArray(record.inventory)
    ? record.inventory
    : Array.isArray(record.items)
      ? record.items
      : [];
  return rows.filter((row): row is ShopInventoryRow => {
    if (!row || typeof row !== 'object') return false;
    const item = row as { id?: unknown; name?: unknown };
    return typeof item.id === 'string' && typeof item.name === 'string';
  });
}
