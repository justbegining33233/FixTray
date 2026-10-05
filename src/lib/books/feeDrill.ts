/**
 * Platform fee drill-down. Shop bay revenue is not on this report.
 *
 * Amounts are the cents stored on books rows at checkout. Nothing here
 * recomputes a fee from PlatformConfig.
 *
 * stillOwedCents is in-person fees minus shop settlements in the same bucket.
 * It is not clamped, so a settlement on a later day can be negative and the
 * days still add up to the week.
 */

import {
  buildYearCalendar,
  dayKey,
  WEEK_SPLIT_RULE,
  type CalendarDay,
  type CalendarMonth,
  type CalendarWeek,
} from '@/lib/books/periods';

export interface FeeTotals {
  onlineCollectedCents: number;
  inPersonOwedCents: number;
  shopPaidCents: number;
  stillOwedCents: number;
  feeRefundCents: number;
  netFeesCents: number;
}

export type FeeEventKind = 'online' | 'in_person' | 'shop_paid' | 'refund' | 'chargeback';

export interface FeeEvent {
  id: string;
  shopId: string;
  shopName: string;
  workOrderId: string;
  at: string;
  kind: FeeEventKind;
  /** Stored checkout fee in cents. Not a live recalculation. */
  feeCents: number;
}

export interface FeeShopSlice {
  shopId: string;
  shopName: string;
  totals: FeeTotals;
}

export interface FeeChargeLine {
  id: string;
  shopId: string;
  shopName: string;
  workOrderId: string;
  kind: FeeEventKind;
  feeCents: number;
  at: string;
}

export interface FeeDayNode {
  id: string;
  label: string;
  weekday: string;
  totals: FeeTotals;
  shops: FeeShopSlice[];
  charges: FeeChargeLine[];
}

export interface FeeWeekNode {
  id: string;
  label: string;
  splitAtMonthEdge: boolean;
  totals: FeeTotals;
  shops: FeeShopSlice[];
  days: FeeDayNode[];
}

export interface FeeMonthNode {
  id: string;
  label: string;
  totals: FeeTotals;
  shops: FeeShopSlice[];
  weeks: FeeWeekNode[];
}

export interface FeeYearReport {
  year: number;
  timeZone: string;
  weekSplitRule: string;
  shopRevenueIncluded: false;
  totals: FeeTotals;
  shops: FeeShopSlice[];
  months: FeeMonthNode[];
}

export function emptyFeeTotals(): FeeTotals {
  return {
    onlineCollectedCents: 0,
    inPersonOwedCents: 0,
    shopPaidCents: 0,
    stillOwedCents: 0,
    feeRefundCents: 0,
    netFeesCents: 0,
  };
}

export function addFeeTotals(left: FeeTotals, right: FeeTotals): FeeTotals {
  const onlineCollectedCents = left.onlineCollectedCents + right.onlineCollectedCents;
  const inPersonOwedCents = left.inPersonOwedCents + right.inPersonOwedCents;
  const shopPaidCents = left.shopPaidCents + right.shopPaidCents;
  const feeRefundCents = left.feeRefundCents + right.feeRefundCents;
  return {
    onlineCollectedCents,
    inPersonOwedCents,
    shopPaidCents,
    stillOwedCents: inPersonOwedCents - shopPaidCents,
    feeRefundCents,
    netFeesCents: onlineCollectedCents + inPersonOwedCents - feeRefundCents,
  };
}

function applyEvent(totals: FeeTotals, event: FeeEvent): FeeTotals {
  const next = { ...totals };
  const amount = Math.round(event.feeCents);
  if (event.kind === 'online') next.onlineCollectedCents += amount;
  else if (event.kind === 'in_person') next.inPersonOwedCents += amount;
  else if (event.kind === 'shop_paid') next.shopPaidCents += amount;
  else next.feeRefundCents += amount;
  next.stillOwedCents = next.inPersonOwedCents - next.shopPaidCents;
  next.netFeesCents = next.onlineCollectedCents + next.inPersonOwedCents - next.feeRefundCents;
  return next;
}

function shopsFromEvents(events: FeeEvent[]): FeeShopSlice[] {
  const byShop = new Map<string, FeeShopSlice>();
  for (const event of events) {
    const current = byShop.get(event.shopId) || {
      shopId: event.shopId,
      shopName: event.shopName || event.shopId,
      totals: emptyFeeTotals(),
    };
    current.totals = applyEvent(current.totals, event);
    if (event.shopName) current.shopName = event.shopName;
    byShop.set(event.shopId, current);
  }
  return [...byShop.values()].sort((a, b) => a.shopId.localeCompare(b.shopId));
}

function totalsFromEvents(events: FeeEvent[]): FeeTotals {
  return events.reduce((totals, event) => applyEvent(totals, event), emptyFeeTotals());
}

/**
 * Books fee row → drill event.
 * Opening-balance fee rows are legacy collected fees, not in-person debt.
 * The amount is the stored row, never a fresh PlatformConfig gross-up.
 */
export function feeEventFromBooksRow(row: {
  id: string;
  shopId?: string | null;
  shopName?: string | null;
  workOrderId: string;
  kind: string;
  appliesTo: string;
  amountCents: number;
  status?: string | null;
  note?: string | null;
  createdAt?: string | Date | null;
}): FeeEvent | null {
  if (row.appliesTo !== 'fee') return null;
  if (String(row.status || 'posted') === 'open') return null;
  const at = row.createdAt instanceof Date
    ? row.createdAt.toISOString()
    : typeof row.createdAt === 'string'
      ? row.createdAt
      : '';
  if (!at) return null;
  const opening = String(row.note || '').toLowerCase().includes('opening balance');
  let kind: FeeEventKind | null = null;
  if (row.kind === 'card_payment') kind = 'online';
  else if (row.kind === 'fee_settlement') kind = 'shop_paid';
  else if (row.kind === 'refund') kind = 'refund';
  else if (row.kind === 'chargeback') kind = 'chargeback';
  else if (row.kind === 'job_payment') kind = opening ? 'online' : 'in_person';
  if (!kind) return null;
  return {
    id: row.id,
    shopId: row.shopId || '',
    shopName: row.shopName || row.shopId || '',
    workOrderId: row.workOrderId,
    at,
    kind,
    feeCents: Math.round(row.amountCents),
  };
}

export function buildFeeYear(input: {
  year: number;
  timeZone: string;
  events: FeeEvent[];
}): FeeYearReport {
  const calendar = buildYearCalendar(input.year, input.timeZone);
  const byDay = new Map<string, FeeEvent[]>();
  for (const event of input.events) {
    const instant = new Date(event.at);
    if (Number.isNaN(instant.getTime())) continue;
    const key = dayKey(instant, calendar.timeZone);
    if (!key.startsWith(`${input.year}-`)) continue;
    const list = byDay.get(key) || [];
    list.push(event);
    byDay.set(key, list);
  }

  const dayNode = (day: CalendarDay): FeeDayNode => {
    const events = (byDay.get(day.id) || []).slice().sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
    return {
      id: day.id,
      label: day.label,
      weekday: day.weekday,
      totals: totalsFromEvents(events),
      shops: shopsFromEvents(events),
      charges: events.map((event) => ({
        id: event.id,
        shopId: event.shopId,
        shopName: event.shopName,
        workOrderId: event.workOrderId,
        kind: event.kind,
        feeCents: event.feeCents,
        at: event.at,
      })),
    };
  };

  const weekNode = (week: CalendarWeek): FeeWeekNode => {
    const days = week.days.map(dayNode);
    const events = days.flatMap((day) => (byDay.get(day.id) || []));
    return {
      id: week.id,
      label: week.label,
      splitAtMonthEdge: week.splitAtMonthEdge,
      totals: days.reduce((sum, day) => addFeeTotals(sum, day.totals), emptyFeeTotals()),
      shops: shopsFromEvents(events),
      days,
    };
  };

  const monthNode = (month: CalendarMonth): FeeMonthNode => {
    const weeks = month.weeks.map(weekNode);
    const events = weeks.flatMap((week) => week.days.flatMap((day) => byDay.get(day.id) || []));
    return {
      id: month.id,
      label: month.label,
      totals: weeks.reduce((sum, week) => addFeeTotals(sum, week.totals), emptyFeeTotals()),
      shops: shopsFromEvents(events),
      weeks,
    };
  };

  const months = calendar.months.map(monthNode);
  const yearEvents = months.flatMap((month) => month.weeks.flatMap((week) => week.days.flatMap((day) => byDay.get(day.id) || [])));
  return {
    year: input.year,
    timeZone: calendar.timeZone,
    weekSplitRule: WEEK_SPLIT_RULE,
    shopRevenueIncluded: false,
    totals: months.reduce((sum, month) => addFeeTotals(sum, month.totals), emptyFeeTotals()),
    shops: shopsFromEvents(yearEvents),
    months,
  };
}
