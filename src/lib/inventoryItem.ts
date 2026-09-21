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
