import prisma from '@/lib/prisma';
import { ensureProductionColumns } from '@/lib/ensureProductionColumns';
import type { JournalDraft } from '@/lib/books/journal';

/** Idempotent journal write. A repeated source does not add a second entry. */
export async function saveJournalDraft(shopId: string, actorId: string, entry: JournalDraft): Promise<void> {
  await ensureProductionColumns();
  const existing = await prisma.journalEntry.findUnique({
    where: { shopId_sourceType_sourceId: { shopId, sourceType: entry.sourceType, sourceId: entry.sourceId } },
    select: { id: true },
  });
  if (existing) return;
  await prisma.journalEntry.create({
    data: {
      shopId,
      entryDate: new Date(entry.date),
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      memo: entry.memo,
      actorId,
      lines: {
        create: entry.lines.map((row) => ({
          accountKey: row.accountKey,
          debitCents: row.debitCents,
          creditCents: row.creditCents,
          workOrderId: row.workOrderId || null,
          memo: row.memo || null,
        })),
      },
    },
  });
}
