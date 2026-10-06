import prisma from '@/lib/prisma';

/** One row for a real status change. The same from and to is not written twice. */
export async function recordStatusHistory(input: {
  workOrderId: string;
  fromStatus: string;
  toStatus: string;
  reason: string;
  changedById?: string | null;
}): Promise<void> {
  const fromStatus = String(input.fromStatus || '').trim() || 'created';
  const toStatus = String(input.toStatus || '').trim();
  if (!toStatus || fromStatus === toStatus) return;
  await prisma.statusHistory.create({
    data: {
      workOrderId: input.workOrderId,
      fromStatus,
      toStatus,
      reason: input.reason,
      changedById: input.changedById || undefined,
    },
  });
}
