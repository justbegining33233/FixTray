export type TimesheetRange = 'week' | 'month';

export type TimesheetEntry = {
  clockIn?: string | Date | null;
  clockOut?: string | Date | null;
  hoursWorked?: number | null;
};

function atStartOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function atEndOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function formatLocalDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Sunday–Saturday week, or the calendar month containing `now`. One range for the label and the query. */
export function timesheetBounds(range: TimesheetRange, now = new Date()): { start: Date; end: Date; label: string } {
  if (range === 'month') {
    const start = atStartOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    const end = atEndOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    return { start, end, label: `${formatLocalDate(start)} – ${formatLocalDate(end)}` };
  }
  const start = atStartOfDay(now);
  start.setDate(now.getDate() - now.getDay());
  const end = atEndOfDay(start);
  end.setDate(start.getDate() + 6);
  return { start, end, label: `${formatLocalDate(start)} – ${formatLocalDate(end)}` };
}

function hoursBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return ms / (1000 * 60 * 60);
}

/**
 * Closed entries always count. An open entry counts only while the tech is
 * actually clocked in — otherwise a missing clock-out must not look like pay.
 */
export function payableHours(
  entries: TimesheetEntry[],
  options: { clockedIn: boolean; now?: Date },
): number {
  const now = options.now ?? new Date();
  return entries.reduce((total, entry) => {
    const clockIn = entry.clockIn ? new Date(entry.clockIn) : null;
    if (!clockIn || Number.isNaN(clockIn.getTime())) return total;
    if (entry.clockOut) {
      const clockOut = new Date(entry.clockOut);
      if (Number.isNaN(clockOut.getTime())) return total;
      if (typeof entry.hoursWorked === 'number' && Number.isFinite(entry.hoursWorked)) {
        return total + Math.max(0, entry.hoursWorked);
      }
      return total + hoursBetween(clockIn, clockOut);
    }
    if (!options.clockedIn) return total;
    if (typeof entry.hoursWorked === 'number' && entry.hoursWorked > 0) {
      return total + entry.hoursWorked;
    }
    return total + hoursBetween(clockIn, now);
  }, 0);
}
