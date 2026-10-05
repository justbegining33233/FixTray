import prisma from '@/lib/prisma';
import { ensureProductionColumns } from '@/lib/ensureProductionColumns';
import { logAdminAction } from '@/lib/auditLog';
import { auditEvent, openingBalanceEntries, type BooksAuditEvent, type BooksEntryDraft, type ShopJob } from '@/lib/books/money';

function uniqueConflict(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002');
}

export async function writeBooksEntries(input: {
  shopId: string;
  workOrderId: string;
  entries: BooksEntryDraft[];
  audit: BooksAuditEvent;
}): Promise<number> {
  await ensureProductionColumns();
  let written = 0;
  for (const entry of input.entries) {
    try {
      await prisma.booksEntry.create({
        data: {
          shopId: input.shopId,
          workOrderId: input.workOrderId,
          kind: entry.kind,
          appliesTo: entry.appliesTo,
          amountCents: entry.amountCents,
          status: entry.status,
          sourceId: entry.sourceId,
          stripePaymentIntentId: entry.sourceId && entry.sourceId.startsWith('pi_') ? entry.sourceId : null,
          idempotencyKey: entry.idempotencyKey,
          depositAt: entry.depositAt ? new Date(entry.depositAt) : null,
          actorId: input.audit.actorId,
          note: entry.note,
        },
      });
      written += 1;
    } catch (error) {
      if (uniqueConflict(error)) continue;
      throw error;
    }
  }
  if (written > 0) {
    await logAdminAction(input.audit.actorId, input.audit.action, input.audit.details, {
      targetId: input.audit.targetId,
      targetType: input.audit.targetType,
      shopId: input.shopId,
    });
  }
  return written;
}

export async function ensureOpeningBalance(input: {
  shopId: string;
  job: Pick<ShopJob, 'id' | 'shopReceivedCents' | 'platformFeeCents'>;
  actorId: string;
  at: string;
}): Promise<void> {
  await ensureProductionColumns();
  const existing = await prisma.booksEntry.count({
    where: { workOrderId: input.job.id, kind: { not: 'deposit' } },
  });
  if (existing > 0) return;
  const entries = openingBalanceEntries(input.job);
  if (entries.length === 0) return;
  await writeBooksEntries({
    shopId: input.shopId,
    workOrderId: input.job.id,
    entries,
    audit: auditEvent({
      actorId: input.actorId,
      at: input.at,
      action: 'books.opening',
      targetType: 'work_order',
      targetId: input.job.id,
      shopId: input.shopId,
      details: `opening job ${input.job.shopReceivedCents} cents; fee ${input.job.platformFeeCents} cents`,
    }),
  });
}

export async function writeAudit(audit: BooksAuditEvent): Promise<void> {
  await logAdminAction(audit.actorId, audit.action, audit.details, {
    targetId: audit.targetId,
    targetType: audit.targetType,
    shopId: audit.shopId || undefined,
  });
}
