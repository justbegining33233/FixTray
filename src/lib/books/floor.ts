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
      inventoryItemId?: string;
      inventoryStockId?: string;
      stockId?: string;
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
      const id = String(part.inventoryStockId || part.stockId || part.inventoryItemId || part.id || part.partId || part.itemId || '');
      const sku = String(part.sku || '');
      const match = catalog.find((item) => (id && item.id === id) || (sku && item.sku && item.sku === sku));
      if (match) unit = Math.max(0, Math.round(match.costCents));
    }
    total += unit * qty;
  }
  return total;
}

export interface PartMovement {
  kind: 'return' | 'adjust';
  qty: number;
  itemId?: string | null;
  workOrderId?: string | null;
  unitCostCents?: number | null;
}

/** Pull a parts.return or parts.adjust audit into a quantity movement. */
export function partMovementFromAudit(row: {
  action: string;
  details?: string | null;
  targetId?: string | null;
  targetType?: string | null;
}): PartMovement | null {
  const action = String(row.action || '');
  const kind = action.startsWith('parts.') ? action.slice('parts.'.length) : '';
  if (kind !== 'return' && kind !== 'adjust') return null;
  const match = String(row.details || '').match(/delta (-?\d+)/);
  if (!match) return null;
  const delta = Number(match[1]);
  if (!Number.isInteger(delta) || delta === 0) return null;
  const targetType = String(row.targetType || '').toLowerCase();
  const workOrderFromType = targetType === 'work_order' || targetType === 'workorder' ? row.targetId : null;
  const workOrderFromDetails = String(row.details || '').match(/workOrderId\s+(\S+)/);
  const itemFromType = targetType === 'inventory_stock' || targetType === 'inventory' ? row.targetId : null;
  return {
    kind,
    qty: kind === 'return' ? Math.abs(delta) : delta,
    itemId: itemFromType || null,
    workOrderId: workOrderFromType || (workOrderFromDetails ? workOrderFromDetails[1] : null),
    unitCostCents: null,
  };
}

function partLines(partsUsed: unknown, catalog: Array<{ id: string; sku?: string | null; costCents: number }>): Array<{ itemId: string; qty: number; unit: number }> {
  if (!Array.isArray(partsUsed)) return [];
  const lines: Array<{ itemId: string; qty: number; unit: number }> = [];
  for (const raw of partsUsed) {
    if (!raw || typeof raw !== 'object') continue;
    const part = raw as {
      id?: string;
      partId?: string;
      itemId?: string;
      inventoryItemId?: string;
      inventoryStockId?: string;
      stockId?: string;
      sku?: string;
      quantity?: number;
      qty?: number;
      returnedQty?: number;
      cost?: number;
      costCents?: number;
    };
    const qtyRaw = part.quantity ?? part.qty ?? 1;
    const returned = Math.max(0, Math.round(Number(part.returnedQty || 0)));
    const qty = Math.max(0, Math.round(Number(qtyRaw)) - returned);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    let unit = 0;
    if (Number.isFinite(part.costCents) && (part.costCents as number) > 0) unit = Math.round(part.costCents as number);
    else if (Number.isFinite(part.cost) && (part.cost as number) > 0) unit = Math.round((part.cost as number) * 100);
    const id = String(part.inventoryStockId || part.stockId || part.inventoryItemId || part.id || part.partId || part.itemId || '');
    const sku = String(part.sku || '');
    if (unit <= 0) {
      const match = catalog.find((item) => (id && item.id === id) || (sku && item.sku && item.sku === sku));
      if (match) unit = Math.max(0, Math.round(match.costCents));
    }
    lines.push({ itemId: id || sku, qty, unit });
  }
  return lines;
}

/**
 * Cost of the parts still on the job. A return reduces that cost.
 * The line cost wins. Otherwise the item's own unit cost is used.
 */
export function jobPartsCostCents(input: {
  workOrderId: string;
  partsUsed: unknown;
  catalog?: Array<{ id: string; sku?: string | null; costCents: number }>;
  movements?: PartMovement[];
}): number {
  const catalog = input.catalog || [];
  const lines = partLines(input.partsUsed, catalog);
  let total = lines.reduce((sum, line) => sum + line.unit * line.qty, 0);
  for (const move of input.movements || []) {
    if (move.kind !== 'return' || move.qty <= 0) continue;
    if (move.workOrderId && move.workOrderId !== input.workOrderId) continue;
    const line = lines.find((item) => move.itemId && item.itemId === move.itemId) || (lines.length === 1 ? lines[0] : undefined);
    if (!line && move.workOrderId !== input.workOrderId) continue;
    const unit = move.unitCostCents && move.unitCostCents > 0 ? Math.round(move.unitCostCents) : (line?.unit || 0);
    const qty = Math.min(move.qty, line?.qty || move.qty);
    total -= unit * qty;
    if (line) line.qty = Math.max(0, line.qty - qty);
  }
  return Math.max(0, total);
}

/** Give an unassigned return to the one invoiced job that used that part. */
export function assignPartReturns(input: {
  jobs: Array<{ id: string; partsUsed: unknown }>;
  movements: PartMovement[];
}): PartMovement[] {
  const usedBy = new Map<string, string[]>();
  for (const job of input.jobs) {
    for (const line of partLines(job.partsUsed, [])) {
      if (!line.itemId) continue;
      const list = usedBy.get(line.itemId) || [];
      list.push(job.id);
      usedBy.set(line.itemId, list);
    }
  }
  return input.movements.map((move) => {
    if (move.kind !== 'return' || move.workOrderId || !move.itemId) return move;
    const jobs = [...new Set(usedBy.get(move.itemId) || [])];
    if (jobs.length !== 1) return move;
    return { ...move, workOrderId: jobs[0] };
  });
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

/**
 * Receiving adds quantity. Units already on hand keep their own unit cost.
 * A first receipt, when the item has no cost yet, takes the bill's unit cost.
 */
export function receiveInventory(input: {
  onHand: number;
  unitCostCents: number;
  qty: number;
  billUnitCostCents: number;
}): ReceiveResult {
  const qty = Math.max(0, input.onHand) + Math.max(0, input.qty);
  const own = Math.max(0, Math.round(input.unitCostCents));
  const billed = Math.max(0, Math.round(input.billUnitCostCents));
  const unitCostCents = own > 0 ? own : billed;
  return { qty, unitCostCents, valueCents: qty * unitCostCents };
}

/** On-hand quantity times that item's own unit cost. */
export function inventoryOnHandValueCents(items: Array<{ quantity: number; unitCostCents: number }>): number {
  return items.reduce((sum, item) => {
    const qty = Math.max(0, Math.round(item.quantity));
    const cost = Math.max(0, Math.round(item.unitCostCents));
    return sum + qty * cost;
  }, 0);
}

/** Closed job-clock minutes. An open clock-in is not finished work. */
export function closedJobLaborMinutes(entries: Array<{ clockOut?: Date | string | null; hoursSpent?: number | null; clockIn?: Date | string | null }>): number {
  let minutes = 0;
  for (const entry of entries) {
    if (!entry.clockOut) continue;
    if (typeof entry.hoursSpent === 'number' && entry.hoursSpent > 0) {
      minutes += Math.round(entry.hoursSpent * 60);
      continue;
    }
    if (!entry.clockIn) continue;
    const start = new Date(entry.clockIn).getTime();
    const end = new Date(entry.clockOut).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) minutes += Math.round((end - start) / 60000);
  }
  return minutes;
}

/** Gross wages for closed staff punches only. FixTray does not withhold taxes. */
export function closedPayrollGrossCents(rows: Array<{ clockOut?: Date | string | null; hoursWorked?: number | null; hourlyRate?: number | null }>): number {
  let total = 0;
  for (const row of rows) {
    if (!row.clockOut) continue;
    const hours = Number(row.hoursWorked || 0);
    const rate = Number(row.hourlyRate || 0);
    if (!Number.isFinite(hours) || !Number.isFinite(rate) || hours <= 0 || rate <= 0) continue;
    total += Math.round(hours * rate * 100);
  }
  return total;
}

const DONE = new Set(['closed', 'completed']);

/**
 * Completed jobs are closed or completed. Tech revenue is every job payment
 * for that tech, the same payments employee performance uses.
 */
export function analyticsPerformance(rows: Array<{
  status?: string | null;
  techName: string;
  paidCents: number;
}>): {
  completedJobs: number;
  paidJobCount: number;
  paidCents: number;
  byTech: Array<{ techName: string; jobs: number; paidCents: number }>;
} {
  const byTech = new Map<string, { techName: string; jobs: number; paidCents: number }>();
  let paidCents = 0;
  let paidJobCount = 0;
  let completedJobs = 0;
  for (const row of rows) {
    const paid = Math.round(row.paidCents || 0);
    const done = DONE.has(String(row.status || '').trim().toLowerCase());
    if (done) completedJobs += 1;
    if (paid > 0) paidJobCount += 1;
    paidCents += paid;
    if (!done && paid <= 0) continue;
    const slot = byTech.get(row.techName) || { techName: row.techName, jobs: 0, paidCents: 0 };
    if (done) slot.jobs += 1;
    slot.paidCents += paid;
    byTech.set(row.techName, slot);
  }
  return {
    completedJobs,
    paidJobCount,
    paidCents,
    byTech: [...byTech.values()].sort((a, b) => a.techName.localeCompare(b.techName)),
  };
}
