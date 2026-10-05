import prisma from '@/lib/prisma';
import { inPersonFeeOwed, utcWeekRange } from '@/lib/books/money';
import { writeBooksEntries } from '@/lib/books/persist';
import { allocateFeeSettlement, settlementDrafts } from '@/lib/feeSettlement';
import { auditEvent } from '@/lib/books/money';

/** Shop card payment to FixTray for open in-person fees. Not a destination charge. */
export async function recordFeeSettlement(input: {
  shopId: string;
  paymentIntentId: string;
  amountCents: number;
  at?: string;
}): Promise<{ ok: true; settledCents: number } | { ok: false; error: string }> {
  const rows = await prisma.booksEntry.findMany({ where: { shopId: input.shopId } });
  const owed = inPersonFeeOwed(rows.map((row) => ({
    id: row.id,
    workOrderId: row.workOrderId,
    shopId: row.shopId,
    kind: row.kind,
    appliesTo: row.appliesTo,
    amountCents: row.amountCents,
    status: row.status,
    createdAt: row.createdAt,
  })));
  const openByOrder = new Map<string, number>();
  for (const line of owed.lines) {
    openByOrder.set(line.workOrderId, (openByOrder.get(line.workOrderId) || 0) + line.feeCents);
  }
  const settledByOrder = new Map<string, number>();
  for (const row of rows) {
    if (row.kind === 'fee_settlement' && row.appliesTo === 'fee' && row.status !== 'open') {
      settledByOrder.set(row.workOrderId, (settledByOrder.get(row.workOrderId) || 0) + row.amountCents);
    }
  }
  const openLines = [...openByOrder.entries()]
    .map(([workOrderId, feeCents]) => ({
      workOrderId,
      feeCents: Math.max(0, feeCents - (settledByOrder.get(workOrderId) || 0)),
    }))
    .filter((line) => line.feeCents > 0);
  const allocated = allocateFeeSettlement(openLines, input.amountCents);
  if (!allocated.ok) return allocated;
  const at = input.at || new Date().toISOString();
  const drafts = settlementDrafts({
    shopId: input.shopId,
    paymentIntentId: input.paymentIntentId,
    actorId: 'stripe',
    at,
    pieces: allocated.pieces,
  });
  if (!drafts.ok) return drafts;
  for (const piece of drafts.entries) {
    await writeBooksEntries({
      shopId: input.shopId,
      workOrderId: piece.workOrderId,
      entries: [piece.entry],
      audit: auditEvent({
        actorId: 'stripe',
        at,
        action: 'books.fee_settlement',
        targetType: 'work_order',
        targetId: piece.workOrderId,
        shopId: input.shopId,
        details: `fee settlement ${piece.entry.amountCents} cents via ${input.paymentIntentId}`,
      }),
    });
  }
  return { ok: true, settledCents: input.amountCents };
}

export function currentFeeWeekLabel(at = new Date()): string {
  return utcWeekRange(at).label;
}
