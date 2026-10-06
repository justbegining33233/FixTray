/**
 * Owner shop-floor numbers. Revenue is the shop job and excludes the FixTray fee.
 */

export interface JobProfit {
  workOrderId: string;
  revenueCents: number;
  partsCostCents: number;
  laborMinutes: number;
  hourlyRateCents: number | null;
  laborCostCents: number;
  profitCents: number | null;
  rateSet: boolean;
  rateNote: string | null;
}

/** Parts cost from the line when it has a cost, otherwise the inventory cost times quantity. */
export function partsCostFromUsage(input: {
  partsUsed: unknown;
  catalog?: Array<{ id: string; sku?: string | null; costCents: number }>;
}): number {
  if (!Array.isArray(input.partsUsed)) return 0;
  const catalog = input.catalog || [];
  let total = 0;
  for (const raw of input.partsUsed) {
    if (!raw || typeof raw !== 'object') continue;
    const part = raw as {
      id?: string;
      partId?: string;
      itemId?: string;
      sku?: string;
      quantity?: number;
      qty?: number;
      cost?: number;
      costCents?: number;
    };
    const qtyRaw = part.quantity ?? part.qty ?? 1;
    const qty = Math.max(0, Math.round(Number(qtyRaw)));
    if (!Number.isFinite(qty) || qty <= 0) continue;
    let unit = 0;
    if (Number.isFinite(part.costCents) && (part.costCents as number) > 0) unit = Math.round(part.costCents as number);
    else if (Number.isFinite(part.cost) && (part.cost as number) > 0) unit = Math.round((part.cost as number) * 100);
    if (unit <= 0) {
      const id = String(part.id || part.partId || part.itemId || '');
      const sku = String(part.sku || '');
      const match = catalog.find((item) => (id && item.id === id) || (sku && item.sku && item.sku === sku));
      if (match) unit = Math.max(0, Math.round(match.costCents));
    }
    total += unit * qty;
  }
  return total;
}

/** Shop revenue by tech from job payments. Estimated totals and the FixTray fee are not used. */
export function allocateTechRevenue(rows: Array<{ techId: string | null | undefined; cents: number }>): Array<{ techId: string; revenueCents: number }> {
  const byTech = new Map<string, number>();
  for (const row of rows) {
    const techId = String(row.techId || '').trim();
    if (!techId) continue;
    byTech.set(techId, (byTech.get(techId) || 0) + Math.round(row.cents));
  }
  return [...byTech.entries()]
    .map(([techId, revenueCents]) => ({ techId, revenueCents }))
    .sort((a, b) => a.techId.localeCompare(b.techId));
}

export function jobProfit(input: {
  workOrderId: string;
  revenueCents: number;
  partsCostCents: number;
  laborMinutes: number;
  /** Tech pay rate in cents per hour. Zero or missing is "rate not set". */
  hourlyRateCents: number | null | undefined;
}): JobProfit {
  const revenueCents = Math.round(input.revenueCents);
  const partsCostCents = Math.max(0, Math.round(input.partsCostCents));
  const laborMinutes = Math.max(0, Math.round(input.laborMinutes));
  const rate = input.hourlyRateCents == null ? null : Math.round(input.hourlyRateCents);
  const rateSet = rate != null && rate > 0;
  const laborCostCents = rateSet ? Math.round((laborMinutes * (rate as number)) / 60) : 0;
  return {
    workOrderId: input.workOrderId,
    revenueCents,
    partsCostCents,
    laborMinutes,
    hourlyRateCents: rateSet ? rate : null,
    laborCostCents,
    profitCents: rateSet ? revenueCents - partsCostCents - laborCostCents : null,
    rateSet,
    rateNote: rateSet ? null : 'rate not set',
  };
}

export interface TechProductivity {
  personId: string;
  clockedMinutes: number;
  billedMinutes: number;
}

export function techProductivity(rows: TechProductivity[]): TechProductivity[] {
  const byPerson = new Map<string, TechProductivity>();
  for (const row of rows) {
    const current = byPerson.get(row.personId) || { personId: row.personId, clockedMinutes: 0, billedMinutes: 0 };
    current.clockedMinutes += Math.max(0, Math.round(row.clockedMinutes));
    current.billedMinutes += Math.max(0, Math.round(row.billedMinutes));
    byPerson.set(row.personId, current);
  }
  return [...byPerson.values()].sort((a, b) => a.personId.localeCompare(b.personId));
}

export interface PartMargin {
  id: string;
  costCents: number;
  sellCents: number;
  marginCents: number;
}

export function partMargin(input: { id: string; costCents: number; sellCents: number }): PartMargin {
  const costCents = Math.max(0, Math.round(input.costCents));
  const sellCents = Math.max(0, Math.round(input.sellCents));
  return { id: input.id, costCents, sellCents, marginCents: sellCents - costCents };
}

export interface ReorderAlert {
  itemId: string;
  name: string;
  onHand: number;
  reorderPoint: number;
  workOrderIds: string[];
}

/** Low stock, plus the open jobs that already use the part. */
export function reorderAlerts(items: Array<{
  id: string;
  name: string;
  quantity: number;
  reorderPoint?: number | null;
  workOrderIds?: string[];
}>): ReorderAlert[] {
  return items
    .filter((item) => item.reorderPoint != null && Number.isFinite(item.reorderPoint) && item.quantity <= (item.reorderPoint as number))
    .map((item) => ({
      itemId: item.id,
      name: item.name,
      onHand: item.quantity,
      reorderPoint: item.reorderPoint as number,
      workOrderIds: [...new Set(item.workOrderIds || [])].sort(),
    }))
    .sort((a, b) => a.itemId.localeCompare(b.itemId));
}

export interface ReceiveResult {
  qty: number;
  unitCostCents: number;
  valueCents: number;
}

/** Receiving a vendor bill line adds quantity and keeps the latest unit cost. */
export function receiveInventory(input: {
  onHand: number;
  unitCostCents: number;
  qty: number;
  billUnitCostCents: number;
}): ReceiveResult {
  const qty = Math.max(0, input.onHand) + Math.max(0, input.qty);
  const unitCostCents = Math.max(0, Math.round(input.billUnitCostCents));
  return { qty, unitCostCents, valueCents: qty * unitCostCents };
}
