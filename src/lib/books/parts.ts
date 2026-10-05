/**
 * Parts cost and sell, quantity movements, and ticket tax lines.
 * The platform fee is not a ticket line and is not taxed as a shop fee.
 */

import { auditEvent, centsToUsd, usdToCents, type BooksAuditEvent, type PaymentStanding } from '@/lib/books/money';

export interface PartValue {
  costCents: number;
  sellCents: number;
}

export function partValue(qty: number, unitCostCents: number, sellUnitCents: number): PartValue {
  if (!Number.isInteger(qty) || qty < 0) throw new Error('quantity must be a non-negative integer');
  if (!Number.isInteger(unitCostCents) || unitCostCents < 0) throw new Error('unit cost must be cents');
  if (!Number.isInteger(sellUnitCents) || sellUnitCents < 0) throw new Error('sell price must be cents');
  return { costCents: qty * unitCostCents, sellCents: qty * sellUnitCents };
}

export function applyQty(
  onHand: number,
  move: { kind: 'use' | 'return' | 'adjust'; qty: number; reason?: string },
): { ok: true; onHand: number; delta: number } | { ok: false; error: string } {
  if (!Number.isInteger(onHand) || onHand < 0) return { ok: false, error: 'On-hand quantity is invalid' };
  if (!Number.isInteger(move.qty)) return { ok: false, error: 'Quantity must be a whole number' };
  if (move.kind === 'use') {
    if (move.qty <= 0) return { ok: false, error: 'Use quantity must be greater than zero' };
    if (move.qty > onHand) return { ok: false, error: 'Not enough on hand to use' };
    return { ok: true, onHand: onHand - move.qty, delta: -move.qty };
  }
  if (move.kind === 'return') {
    if (move.qty <= 0) return { ok: false, error: 'Return quantity must be greater than zero' };
    return { ok: true, onHand: onHand + move.qty, delta: move.qty };
  }
  if (!move.reason || !move.reason.trim()) return { ok: false, error: 'An adjustment needs a reason' };
  if (move.qty === 0) return { ok: false, error: 'Adjustment quantity cannot be zero' };
  const next = onHand + move.qty;
  if (next < 0) return { ok: false, error: 'Adjustment would make on-hand negative' };
  return { ok: true, onHand: next, delta: move.qty };
}

export function partMoveAudit(input: {
  itemId: string;
  shopId?: string | null;
  kind: 'use' | 'return' | 'adjust';
  delta: number;
  onHand: number;
  reason?: string;
  actorId: string;
  at: string;
}): BooksAuditEvent {
  return auditEvent({
    actorId: input.actorId,
    at: input.at,
    action: `parts.${input.kind}`,
    targetType: 'inventory_stock',
    targetId: input.itemId,
    shopId: input.shopId,
    details: `${input.kind} delta ${input.delta}; on hand ${input.onHand}${input.reason ? `; reason: ${input.reason.trim()}` : ''}`,
  });
}

export type TicketLineKind = 'labor' | 'part' | 'shop_fee';

export interface TicketLine {
  kind: TicketLineKind;
  amountCents: number;
}

export interface TicketTaxRule {
  rateBps: number;
  appliesToLabor: boolean;
  appliesToParts: boolean;
  appliesToShopFees: boolean;
}

export interface TicketTaxLine {
  kind: TicketLineKind;
  baseCents: number;
  taxCents: number;
}

/** Half-up tax. rateBps is 825 for 8.25%. */
export function taxCents(baseCents: number, rateBps: number): number {
  if (!Number.isInteger(baseCents) || baseCents < 0) throw new Error('tax base must be cents');
  if (!Number.isInteger(rateBps) || rateBps < 0) throw new Error('tax rate must be basis points');
  return Math.floor((baseCents * rateBps + 5000) / 10000);
}

/** Percent stored on tax rules (8.25) to basis points (825). */
export function bpsFromPercent(percent: number): number {
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.round(percent * 100);
}

export function ticketTax(lines: TicketLine[], rule: TicketTaxRule): {
  taxLines: TicketTaxLine[];
  taxCents: number;
  shopJobCents: number;
} {
  const bases: Record<TicketLineKind, number> = { labor: 0, part: 0, shop_fee: 0 };
  for (const line of lines) {
    if (!Number.isInteger(line.amountCents) || line.amountCents < 0) {
      throw new Error('ticket line must be cents');
    }
    bases[line.kind] += line.amountCents;
  }
  const taxable: Record<TicketLineKind, boolean> = {
    labor: rule.appliesToLabor,
    part: rule.appliesToParts,
    shop_fee: rule.appliesToShopFees,
  };
  const taxLines: TicketTaxLine[] = (Object.keys(bases) as TicketLineKind[])
    .filter((kind) => bases[kind] > 0)
    .map((kind) => ({
      kind,
      baseCents: bases[kind],
      taxCents: taxable[kind] ? taxCents(bases[kind], rule.rateBps) : 0,
    }));
  const tax = taxLines.reduce((sum, line) => sum + line.taxCents, 0);
  const pretax = bases.labor + bases.part + bases.shop_fee;
  return { taxLines, taxCents: tax, shopJobCents: pretax + tax };
}

export function ticketSync(input: {
  estimateCents: number;
  invoiceCents: number;
  paidJobCents: number;
  standing: PaymentStanding;
}): { synced: boolean; issues: string[] } {
  const issues: string[] = [];
  if (input.invoiceCents !== input.estimateCents) {
    issues.push('Invoice does not match the estimate shop total');
  }
  if (input.standing === 'paid' && input.paidJobCents !== input.estimateCents) {
    issues.push('Paid job amount does not match the estimate');
  }
  if (input.standing === 'partial' && !(input.paidJobCents > 0 && input.paidJobCents < input.estimateCents)) {
    issues.push('Partial payment does not match the estimate');
  }
  if ((input.standing === 'unpaid' || input.standing === 'reversed') && input.paidJobCents !== 0) {
    issues.push('Unpaid ticket still has a job payment');
  }
  return { synced: issues.length === 0, issues };
}

function lineKind(value: unknown): TicketLineKind {
  const kind = String(value || '').toLowerCase();
  if (kind === 'part' || kind === 'parts') return 'part';
  if (kind === 'misc' || kind === 'fee' || kind === 'shop_fee' || kind === 'other' || kind === 'sublet') return 'shop_fee';
  return 'labor';
}

function lineAmountCents(row: Record<string, unknown>): number {
  const total = Number(row.total);
  if (Number.isFinite(total) && total > 0) return usdToCents(total);
  const qty = Number(row.quantity ?? row.hours);
  const price = Number(row.unitPrice ?? row.rate ?? row.ratePerHour);
  if (Number.isFinite(qty) && Number.isFinite(price) && qty > 0 && price >= 0) return usdToCents(qty * price);
  const amount = Number(row.amount);
  if (Number.isFinite(amount) && amount > 0) return usdToCents(amount);
  return 0;
}

/** Estimate line items, parts used, and labor rows become ticket lines. Platform fee lines are dropped. */
export function linesFromWorkOrder(input: { estimate?: unknown; partsUsed?: unknown; techLabor?: unknown }): TicketLine[] {
  const lines: TicketLine[] = [];
  const estimate = input.estimate && typeof input.estimate === 'object' ? input.estimate as Record<string, unknown> : null;
  const estimateLines = estimate && Array.isArray(estimate.lineItems) ? estimate.lineItems : null;
  if (estimateLines && estimateLines.length > 0) {
    for (const raw of estimateLines) {
      if (!raw || typeof raw !== 'object') continue;
      const row = raw as Record<string, unknown>;
      const description = String(row.description || row.name || '').toLowerCase();
      if (description.includes('fixtray')) continue;
      const amountCents = lineAmountCents(row);
      if (amountCents <= 0) continue;
      lines.push({ kind: lineKind(row.kind || row.category), amountCents });
    }
    return lines;
  }
  if (Array.isArray(input.partsUsed)) {
    for (const raw of input.partsUsed) {
      if (!raw || typeof raw !== 'object') continue;
      const amountCents = lineAmountCents(raw as Record<string, unknown>);
      if (amountCents > 0) lines.push({ kind: 'part', amountCents });
    }
  }
  if (Array.isArray(input.techLabor)) {
    for (const raw of input.techLabor) {
      if (!raw || typeof raw !== 'object') continue;
      const amountCents = lineAmountCents(raw as Record<string, unknown>);
      if (amountCents > 0) lines.push({ kind: 'labor', amountCents });
    }
  }
  return lines;
}

export function ticketPreview(input: {
  lines: TicketLine[];
  rule: TicketTaxRule;
  paidJobCents: number;
  standing: PaymentStanding;
  storedEstimateCents?: number | null;
}): {
  taxLines: TicketTaxLine[];
  taxCents: number;
  shopJobCents: number;
  estimateCents: number;
  invoiceCents: number;
  sync: { synced: boolean; issues: string[] };
} {
  const tax = ticketTax(input.lines, input.rule);
  const computed = tax.shopJobCents;
  const estimate = input.storedEstimateCents != null && input.storedEstimateCents > 0
    ? input.storedEstimateCents
    : computed;
  const sync = ticketSync({
    estimateCents: estimate,
    invoiceCents: computed,
    paidJobCents: input.paidJobCents,
    standing: input.standing,
  });
  if (input.storedEstimateCents != null && input.storedEstimateCents !== computed) {
    sync.issues.push(`Stored estimate ${centsToUsd(input.storedEstimateCents)} does not match ticket lines ${centsToUsd(computed)}`);
    sync.synced = false;
  }
  return {
    taxLines: tax.taxLines,
    taxCents: tax.taxCents,
    shopJobCents: computed,
    estimateCents: estimate,
    invoiceCents: computed,
    sync,
  };
}
