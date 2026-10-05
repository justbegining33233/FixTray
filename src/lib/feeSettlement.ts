import type { BooksEntryDraft } from '@/lib/books/money';
import { planFeeSettlement } from '@/lib/books/money';

export interface OpenFeeLine {
  workOrderId: string;
  feeCents: number;
}

/** Spread a shop→FixTray card payment across open in-person fee lines. */
export function allocateFeeSettlement(
  lines: OpenFeeLine[],
  payCents: number,
): { ok: true; pieces: OpenFeeLine[] } | { ok: false; error: string } {
  if (!Number.isInteger(payCents) || payCents <= 0) {
    return { ok: false, error: 'Settlement amount must be greater than zero' };
  }
  let left = payCents;
  const byOrder = new Map<string, number>();
  for (const line of lines) {
    if (left <= 0) break;
    if (!Number.isInteger(line.feeCents) || line.feeCents <= 0) continue;
    const take = Math.min(line.feeCents, left);
    byOrder.set(line.workOrderId, (byOrder.get(line.workOrderId) || 0) + take);
    left -= take;
  }
  if (left > 0) return { ok: false, error: 'Payment is larger than the open FixTray fee' };
  if (byOrder.size === 0) return { ok: false, error: 'There is no open FixTray fee to settle' };
  return {
    ok: true,
    pieces: [...byOrder.entries()].map(([workOrderId, feeCents]) => ({ workOrderId, feeCents })),
  };
}

export function settlementDrafts(input: {
  shopId: string;
  paymentIntentId: string;
  actorId: string;
  at: string;
  pieces: OpenFeeLine[];
}): { ok: true; entries: Array<{ workOrderId: string; entry: BooksEntryDraft }> } | { ok: false; error: string } {
  const entries: Array<{ workOrderId: string; entry: BooksEntryDraft }> = [];
  for (const piece of input.pieces) {
    const planned = planFeeSettlement({
      workOrderId: piece.workOrderId,
      shopId: input.shopId,
      amountCents: piece.feeCents,
      paymentIntentId: input.paymentIntentId,
      actorId: input.actorId,
      at: input.at,
    });
    if (!planned.ok) return planned;
    entries.push({ workOrderId: piece.workOrderId, entry: planned.entry });
  }
  return { ok: true, entries };
}
