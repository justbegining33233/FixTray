/**
 * Sales tax comes only from the shop owner's settings.
 * Rate 0, or neither labor nor parts marked taxable, means no tax.
 * The FixTray fee is never taxed.
 */

export interface ShopTaxSettings {
  /** Percent, such as 8.25. Zero until the owner sets one. */
  ratePercent: number;
  laborTaxable: boolean;
  partsTaxable: boolean;
}

export interface InvoiceTax {
  laborBaseCents: number;
  partsBaseCents: number;
  laborTaxCents: number;
  partsTaxCents: number;
  taxCents: number;
  ratePercent: number;
}

export function normalizeShopTax(input: Partial<ShopTaxSettings> | null | undefined): ShopTaxSettings {
  const rate = Number(input?.ratePercent);
  return {
    ratePercent: Number.isFinite(rate) && rate > 0 ? rate : 0,
    laborTaxable: input?.laborTaxable === true,
    partsTaxable: input?.partsTaxable === true,
  };
}

function taxOn(baseCents: number, ratePercent: number, taxable: boolean): number {
  if (!taxable || ratePercent <= 0 || baseCents <= 0) return 0;
  return Math.round((baseCents * ratePercent) / 100);
}

export function invoiceTax(input: {
  laborCents: number;
  partsCents: number;
  settings: Partial<ShopTaxSettings> | null | undefined;
}): InvoiceTax {
  const settings = normalizeShopTax(input.settings);
  const laborBaseCents = Math.max(0, Math.round(input.laborCents));
  const partsBaseCents = Math.max(0, Math.round(input.partsCents));
  const laborTaxCents = taxOn(laborBaseCents, settings.ratePercent, settings.laborTaxable);
  const partsTaxCents = taxOn(partsBaseCents, settings.ratePercent, settings.partsTaxable);
  return {
    laborBaseCents,
    partsBaseCents,
    laborTaxCents,
    partsTaxCents,
    taxCents: laborTaxCents + partsTaxCents,
    ratePercent: settings.ratePercent,
  };
}

/** Shop settings store a fraction (0.0825) or a percent. Zero stays zero. */
export function taxSettingsFromShop(row: {
  taxRate?: number | null;
  laborTaxable?: boolean | null;
  partsTaxable?: boolean | null;
} | null | undefined): ShopTaxSettings {
  const stored = Number(row?.taxRate || 0);
  const ratePercent = stored > 0 && stored <= 1 ? stored * 100 : stored > 0 ? stored : 0;
  return normalizeShopTax({
    ratePercent,
    laborTaxable: row?.laborTaxable === true,
    partsTaxable: row?.partsTaxable === true,
  });
}

/** Split a shop invoice into labor and parts once. Parts cannot exceed the invoice. */
export function invoiceBases(input: { invoiceCents: number; partsSellCents?: number | null }): {
  laborCents: number;
  partsCents: number;
} {
  const invoiceCents = Math.max(0, Math.round(input.invoiceCents));
  const partsCents = Math.max(0, Math.min(invoiceCents, Math.round(input.partsSellCents || 0)));
  return { laborCents: invoiceCents - partsCents, partsCents };
}

/** Parts sell prices on a work order are dollars. */
export function partsSellCents(partsUsed: unknown): number {
  if (!Array.isArray(partsUsed)) return 0;
  let total = 0;
  for (const part of partsUsed) {
    if (!part || typeof part !== 'object') continue;
    const row = part as Record<string, unknown>;
    const unit = Number(row.price ?? row.sell ?? row.sellingPrice ?? 0);
    const qty = Number(row.qty ?? row.quantity ?? 1);
    if (!Number.isFinite(unit) || unit <= 0) continue;
    const count = Number.isFinite(qty) && qty > 0 ? qty : 1;
    total += Math.round(unit * count * 100);
  }
  return total;
}

export const SALES_TAX_SNAPSHOT_KEY = 'salesTaxSnapshot';

export interface SalesTaxSnapshot {
  ratePercent: number;
  laborTaxable: boolean;
  partsTaxable: boolean;
  laborCents: number;
  partsCents: number;
  taxCents: number;
  frozenAt: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

export function readSalesTaxSnapshot(completion: unknown): SalesTaxSnapshot | null {
  const raw = asRecord(completion)[SALES_TAX_SNAPSHOT_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const taxCents = Number(row.taxCents);
  const laborCents = Number(row.laborCents);
  const partsCents = Number(row.partsCents);
  if (!Number.isInteger(taxCents) || taxCents < 0) return null;
  if (!Number.isInteger(laborCents) || laborCents < 0) return null;
  if (!Number.isInteger(partsCents) || partsCents < 0) return null;
  return {
    ratePercent: Number(row.ratePercent) > 0 ? Number(row.ratePercent) : 0,
    laborTaxable: row.laborTaxable === true,
    partsTaxable: row.partsTaxable === true,
    laborCents,
    partsCents,
    taxCents,
    frozenAt: typeof row.frozenAt === 'string' ? row.frozenAt : '',
  };
}

export function withSalesTaxSnapshot(completion: unknown, snapshot: SalesTaxSnapshot): Record<string, unknown> {
  return { ...asRecord(completion), [SALES_TAX_SNAPSHOT_KEY]: snapshot };
}

/** Freeze tax from the owner's settings. A later settings change does not rewrite it. */
export function freezeSalesTaxSnapshot(input: {
  completion: unknown;
  quoteCents: number;
  partsUsed: unknown;
  settings: Partial<ShopTaxSettings> | null | undefined;
  now: string;
}): { snapshot: SalesTaxSnapshot; completion: Record<string, unknown>; reused: boolean } {
  const existing = readSalesTaxSnapshot(input.completion);
  const bases = invoiceBases({ invoiceCents: input.quoteCents, partsSellCents: partsSellCents(input.partsUsed) });
  if (existing && existing.laborCents + existing.partsCents === bases.laborCents + bases.partsCents) {
    return { snapshot: existing, completion: withSalesTaxSnapshot(input.completion, existing), reused: true };
  }
  const settings = normalizeShopTax(input.settings);
  const tax = invoiceTax({ laborCents: bases.laborCents, partsCents: bases.partsCents, settings });
  const snapshot: SalesTaxSnapshot = {
    ratePercent: settings.ratePercent,
    laborTaxable: settings.laborTaxable,
    partsTaxable: settings.partsTaxable,
    laborCents: bases.laborCents,
    partsCents: bases.partsCents,
    taxCents: tax.taxCents,
    frozenAt: input.now,
  };
  return { snapshot, completion: withSalesTaxSnapshot(input.completion, snapshot), reused: false };
}

/**
 * Tax for one invoice. A frozen snapshot wins over a later settings change.
 * Labor and parts are taxed once each. The FixTray fee is not a base.
 */
export function taxForInvoice(input: {
  invoiceCents: number;
  partsSellCents?: number | null;
  settings: Partial<ShopTaxSettings> | null | undefined;
  frozen?: SalesTaxSnapshot | null;
}): InvoiceTax {
  if (input.frozen) {
    return {
      laborBaseCents: input.frozen.laborCents,
      partsBaseCents: input.frozen.partsCents,
      laborTaxCents: input.frozen.laborTaxable ? input.frozen.taxCents : 0,
      partsTaxCents: input.frozen.partsTaxable && !input.frozen.laborTaxable ? input.frozen.taxCents : 0,
      taxCents: input.frozen.taxCents,
      ratePercent: input.frozen.ratePercent,
    };
  }
  const bases = invoiceBases({ invoiceCents: input.invoiceCents, partsSellCents: input.partsSellCents });
  return invoiceTax({ laborCents: bases.laborCents, partsCents: bases.partsCents, settings: input.settings });
}
