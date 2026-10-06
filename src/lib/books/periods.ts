/**
 * Report calendar in a timezone.
 *
 * Days are civil dates in that timezone (midnight to the next midnight).
 * Weeks start on Monday. A week that contains days from two months is split
 * at the month edge into two slices. Each day belongs to one slice, so month
 * totals never count the same day twice. Days sum to their slice, slices sum
 * to the month, and months sum to the year.
 *
 * Shops do not store a timezone. Callers pass PlatformConfig.timezone, or
 * America/New_York when that value is missing.
 */

export const DEFAULT_REPORT_TIMEZONE = 'America/New_York';

export const WEEK_SPLIT_RULE =
  'Weeks start Monday in the report timezone. A week that crosses a month is split at the month edge. Each day is in one slice only, so the slices do not double-count.';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function reportTimeZone(value: unknown): string {
  const zone = typeof value === 'string' ? value.trim() : '';
  if (!zone) return DEFAULT_REPORT_TIMEZONE;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: zone }).format(new Date());
    return zone;
  } catch {
    return DEFAULT_REPORT_TIMEZONE;
  }
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(instant);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value || '0');
  let hour = read('hour');
  if (hour === 24) hour = 0;
  return { year: read('year'), month: read('month'), day: read('day'), hour, minute: read('minute') };
}

export function dayKeyFromParts(parts: Pick<ZonedParts, 'year' | 'month' | 'day'>): string {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function dayKey(instant: Date, timeZone: string): string {
  return dayKeyFromParts(zonedParts(instant, timeZone));
}

export function monthKeyFromDay(day: string): string {
  return day.slice(0, 7);
}

export function yearFromDay(day: string): number {
  return Number(day.slice(0, 4));
}

function parseDay(day: string): { year: number; month: number; day: number } {
  const [year, month, date] = day.split('-').map(Number);
  return { year, month, day: date };
}

export function addDays(day: string, count: number): string {
  const { year, month, day: date } = parseDay(day);
  const next = new Date(Date.UTC(year, month - 1, date + count));
  return dayKeyFromParts({
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  });
}

/** Weekday of a civil date. Independent of timezone. 0 is Sunday. */
export function weekdayIndex(day: string): number {
  const { year, month, day: date } = parseDay(day);
  return new Date(Date.UTC(year, month - 1, date)).getUTCDay();
}

export function mondayKey(day: string): string {
  const dow = weekdayIndex(day);
  const delta = dow === 0 ? -6 : 1 - dow;
  return addDays(day, delta);
}

export function weekdayName(day: string): string {
  return WEEKDAYS[weekdayIndex(day)];
}

export function monthName(monthKey: string): string {
  const month = Number(monthKey.slice(5, 7));
  return MONTHS[month - 1] || monthKey;
}

export function shortMonthDay(day: string): string {
  const { month, day: date } = parseDay(day);
  return `${MONTHS[month - 1]?.slice(0, 3) || ''} ${date}`;
}

function tzOffsetMs(instant: Date, timeZone: string): number {
  const parts = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  const instantMinute = Date.UTC(
    instant.getUTCFullYear(),
    instant.getUTCMonth(),
    instant.getUTCDate(),
    instant.getUTCHours(),
    instant.getUTCMinutes(),
  );
  return asUtc - instantMinute;
}

/** UTC instant of a civil date and time in the report timezone. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  let instant = new Date(guess - tzOffsetMs(new Date(guess), timeZone));
  const got = zonedParts(instant, timeZone);
  if (got.year !== year || got.month !== month || got.day !== day || got.hour !== hour || got.minute !== minute) {
    instant = new Date(guess - tzOffsetMs(instant, timeZone));
  }
  return instant;
}

export function zonedDayStart(day: string, timeZone: string): Date {
  const { year, month, day: date } = parseDay(day);
  return zonedTimeToUtc(year, month, date, 0, 0, timeZone);
}

/** Monday 00:00 through the next Monday 00:00 in the shop's timezone. */
export function shopWeekRange(at: Date, timeZone: string): { start: Date; end: Date; label: string } {
  const zone = reportTimeZone(timeZone);
  const monday = mondayKey(dayKey(at, zone));
  return {
    start: zonedDayStart(monday, zone),
    end: zonedDayStart(addDays(monday, 7), zone),
    label: monday,
  };
}

export function shopDayRange(day: string, timeZone: string): { start: Date; end: Date } {
  const zone = reportTimeZone(timeZone);
  return {
    start: zonedDayStart(day, zone),
    end: zonedDayStart(addDays(day, 1), zone),
  };
}

/** Inclusive civil start and exclusive end for a YYYY-MM-DD pair in the shop timezone. */
export function shopDateSpan(startDay: string, endDay: string, timeZone: string): { start: Date; end: Date } {
  const zone = reportTimeZone(timeZone);
  return {
    start: zonedDayStart(startDay, zone),
    end: zonedDayStart(addDays(endDay, 1), zone),
  };
}

export function currentYear(timeZone: string, now = new Date()): number {
  return zonedParts(now, timeZone).year;
}

export interface CalendarDay {
  id: string;
  label: string;
  weekday: string;
}

export interface CalendarWeek {
  id: string;
  mondayKey: string;
  monthKey: string;
  label: string;
  /** True when this Monday–Sunday week also has days in another month. */
  splitAtMonthEdge: boolean;
  days: CalendarDay[];
}

export interface CalendarMonth {
  id: string;
  label: string;
  weeks: CalendarWeek[];
}

export interface CalendarYear {
  year: number;
  timeZone: string;
  weekSplitRule: string;
  months: CalendarMonth[];
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function buildYearCalendar(year: number, timeZone: string): CalendarYear {
  const zone = reportTimeZone(timeZone);
  const months: CalendarMonth[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const byWeek = new Map<string, CalendarDay[]>();
    const count = daysInMonth(year, month);
    for (let date = 1; date <= count; date += 1) {
      const id = dayKeyFromParts({ year, month, day: date });
      const monday = mondayKey(id);
      const days = byWeek.get(monday) || [];
      days.push({ id, label: shortMonthDay(id), weekday: weekdayName(id) });
      byWeek.set(monday, days);
    }
    const weeks: CalendarWeek[] = [...byWeek.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([monday, days]) => {
        const sunday = addDays(monday, 6);
        const splitAtMonthEdge = monthKeyFromDay(monday) !== monthKeyFromDay(sunday);
        const span = days.length === 1 ? days[0].label : `${days[0].label}–${days[days.length - 1].label.replace(/^[A-Za-z]+ /, '')}`;
        const label = splitAtMonthEdge ? `${span} (week of ${shortMonthDay(monday)})` : `Week of ${shortMonthDay(monday)}`;
        return {
          id: `${monday}~${monthKey}`,
          mondayKey: monday,
          monthKey,
          label,
          splitAtMonthEdge,
          days,
        };
      });
    months.push({ id: monthKey, label: monthName(monthKey), weeks });
  }
  return { year, timeZone: zone, weekSplitRule: WEEK_SPLIT_RULE, months };
}

export interface DayMinutes {
  day: string;
  minutes: number;
}

/**
 * Split a punch into whole minutes per civil day. The returned minutes sum to
 * `totalMinutes` when the punch stays inside `year`. A punch that crosses
 * midnight is divided by time, and the rounded minutes still add up.
 */
export function splitMinutesAcrossDays(input: {
  start: Date;
  end: Date;
  totalMinutes: number;
  timeZone: string;
  year: number;
}): DayMinutes[] {
  const total = Math.round(input.totalMinutes);
  if (!Number.isInteger(total) || total <= 0) return [];
  if (!(input.end.getTime() > input.start.getTime())) return [];
  const segments: Array<{ day: string; ms: number; inYear: boolean }> = [];
  let cursor = input.start.getTime();
  const endMs = input.end.getTime();
  let guard = 0;
  while (cursor < endMs && guard < 400) {
    guard += 1;
    const day = dayKey(new Date(cursor), input.timeZone);
    const boundary = zonedDayStart(addDays(day, 1), input.timeZone).getTime();
    const segEnd = Math.min(endMs, boundary);
    const ms = segEnd - cursor;
    if (ms > 0) segments.push({ day, ms, inYear: yearFromDay(day) === input.year });
    if (segEnd <= cursor) break;
    cursor = segEnd;
  }
  const weights = segments.map((segment) => segment.ms);
  const shares = distribute(total, weights);
  return segments
    .map((segment, index) => ({ day: segment.day, minutes: segment.inYear ? shares[index] : 0 }))
    .filter((segment) => segment.minutes > 0);
}

function distribute(total: number, weights: number[]): number[] {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum <= 0 || total <= 0) return weights.map(() => 0);
  const raw = weights.map((weight) => (total * weight) / weightSum);
  const floors = raw.map((value) => Math.floor(value));
  let left = total - floors.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);
  for (const item of order) {
    if (left <= 0) break;
    floors[item.index] += 1;
    left -= 1;
  }
  return floors;
}
