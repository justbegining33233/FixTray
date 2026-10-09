import prisma from '@/lib/prisma';

/** A shift longer than this is not a live clock. It is flagged and closed. */
export const MAX_LIVE_SHIFT_MS = 16 * 60 * 60 * 1000;
export const MAX_LIVE_SHIFT_HOURS = 16;
export const STALE_CLOCK_NOTE = 'Auto-closed: shift exceeded 16 hours';

export function openPunchLive(clockIn: Date | string, now: Date): boolean {
  const start = new Date(clockIn).getTime();
  if (!Number.isFinite(start)) return false;
  return now.getTime() - start <= MAX_LIVE_SHIFT_MS;
}

export function staleClockOut(clockIn: Date | string): Date {
  return new Date(new Date(clockIn).getTime() + MAX_LIVE_SHIFT_MS);
}

/** Cap an open punch at 16 hours. Closed punches keep their stored end. */
export function cappedPunchEnd(clockIn: Date | string, clockOut: Date | string | null | undefined, now: Date): number {
  const start = new Date(clockIn).getTime();
  if (!Number.isFinite(start)) return now.getTime();
  const rawEnd = clockOut ? new Date(clockOut).getTime() : now.getTime();
  const end = Number.isFinite(rawEnd) ? rawEnd : now.getTime();
  if (clockOut) return end;
  return Math.min(end, start + MAX_LIVE_SHIFT_MS);
}

/**
 * Close open punches that have run past the live limit.
 * Returns how many rows were closed. Live punches are left open.
 */
export async function closeStaleOpenPunches(
  where: { shopId?: string; techId?: string },
  now = new Date(),
): Promise<number> {
  const open = await prisma.timeEntry.findMany({
    where: {
      clockOut: null,
      ...(where.shopId ? { shopId: where.shopId } : {}),
      ...(where.techId ? { techId: where.techId } : {}),
    },
    select: { id: true, clockIn: true, notes: true },
  });
  const stale = open.filter((entry) => !openPunchLive(entry.clockIn, now));
  await Promise.all(stale.map((entry) => prisma.timeEntry.update({
    where: { id: entry.id },
    data: {
      clockOut: staleClockOut(entry.clockIn),
      hoursWorked: MAX_LIVE_SHIFT_HOURS,
      notes: entry.notes && entry.notes.includes(STALE_CLOCK_NOTE)
        ? entry.notes
        : [entry.notes, STALE_CLOCK_NOTE].filter(Boolean).join(' '),
    },
  })));
  return stale.length;
}
