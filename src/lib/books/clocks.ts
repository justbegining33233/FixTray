/**
 * Staff clock is paid time. Work clock is time on a ticket.
 * Writing work hours never changes a staff entry, and the shop total is the
 * sum of each person's hours.
 */

import { auditEvent, type BooksAuditEvent } from '@/lib/books/money';

export interface PersonMinutes {
  personId: string;
  minutes: number;
}

export interface ClockEntry {
  id: string;
  personId: string;
  minutes: number;
}

export interface StaffTotal {
  byPerson: PersonMinutes[];
  totalMinutes: number;
  totalHoursLabel: string;
}

export function hoursLabel(minutes: number): string {
  if (!Number.isInteger(minutes)) throw new Error('hours must be counted in whole minutes');
  const negative = minutes < 0;
  const abs = Math.abs(minutes);
  const wholeHours = Math.floor(abs / 60);
  const remainder = abs % 60;
  const tenths = Math.round(remainder / 6);
  const hour = wholeHours + Math.floor(tenths / 10);
  const tenth = tenths % 10;
  return `${negative ? '-' : ''}${hour}.${tenth}`;
}

export function minutesFromHours(hours: number): number {
  if (!Number.isFinite(hours) || hours < 0) return 0;
  return Math.round(hours * 60);
}

/** Paid labor in cents. Half-up on the leftover minute. */
export function laborPayCents(minutes: number, hourlyRateCents: number): number {
  if (!Number.isInteger(minutes) || minutes < 0) throw new Error('labor minutes must be a non-negative integer');
  if (!Number.isInteger(hourlyRateCents) || hourlyRateCents < 0) throw new Error('hourly rate must be cents');
  return Math.floor((minutes * hourlyRateCents + 30) / 60);
}

/** Shop staff total. One person's minutes are never reused as the total. */
export function sumStaffMinutes(people: PersonMinutes[]): StaffTotal {
  const byPerson = people.map((person) => ({
    personId: person.personId,
    minutes: person.minutes,
  }));
  const totalMinutes = byPerson.reduce((sum, person) => sum + person.minutes, 0);
  return { byPerson, totalMinutes, totalHoursLabel: hoursLabel(totalMinutes) };
}

export function sumWorkMinutes(entries: ClockEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.minutes, 0);
}

/**
 * Replace one work-clock entry. The staff list is returned unchanged.
 * A work entry id that also appears on the staff list still does not edit staff.
 */
export function applyWorkHours<T extends ClockEntry>(
  staff: T[],
  work: T[],
  next: { id: string; minutes: number },
): { staff: T[]; work: T[] } {
  if (!Number.isInteger(next.minutes) || next.minutes < 0) {
    throw new Error('work minutes must be a non-negative integer');
  }
  return {
    staff: staff.map((entry) => ({ ...entry })),
    work: work.map((entry) => (entry.id === next.id ? { ...entry, minutes: next.minutes } : { ...entry })),
  };
}

export function correctClock(input: {
  clock: 'staff' | 'work';
  entryId: string;
  nextMinutes: number;
  reason: string;
  actorId: string;
  at: string;
  shopId?: string | null;
  staff: ClockEntry[];
  work: ClockEntry[];
}):
  | { ok: true; staff: ClockEntry[]; work: ClockEntry[]; audit: BooksAuditEvent }
  | { ok: false; error: string; staff: ClockEntry[]; work: ClockEntry[] } {
  const reason = input.reason.trim();
  if (!reason) {
    return { ok: false, error: 'A correction needs a reason', staff: input.staff, work: input.work };
  }
  if (!Number.isInteger(input.nextMinutes) || input.nextMinutes < 0) {
    return { ok: false, error: 'Corrected time must be zero or more minutes', staff: input.staff, work: input.work };
  }
  const source = input.clock === 'staff' ? input.staff : input.work;
  const current = source.find((entry) => entry.id === input.entryId);
  if (!current) {
    return { ok: false, error: 'Clock entry not found', staff: input.staff, work: input.work };
  }
  const staff = input.clock === 'staff'
    ? input.staff.map((entry) => (entry.id === input.entryId ? { ...entry, minutes: input.nextMinutes } : { ...entry }))
    : input.staff.map((entry) => ({ ...entry }));
  const work = input.clock === 'work'
    ? input.work.map((entry) => (entry.id === input.entryId ? { ...entry, minutes: input.nextMinutes } : { ...entry }))
    : input.work.map((entry) => ({ ...entry }));
  return {
    ok: true,
    staff,
    work,
    audit: auditEvent({
      actorId: input.actorId,
      at: input.at,
      action: 'clocks.correct',
      targetType: input.clock === 'staff' ? 'time_entry' : 'work_order_time_entry',
      targetId: input.entryId,
      shopId: input.shopId,
      details: `${input.clock} ${current.minutes} -> ${input.nextMinutes} minutes; reason: ${reason}`,
    }),
  };
}
