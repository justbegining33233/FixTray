/**
 * Shop books drill-down. Money is integer cents. Clock time is whole minutes.
 *
 * Unpaid in a bucket is invoiced minus payments plus refunds and chargebacks
 * in that same bucket. It is not a remaining balance, so the days add up.
 *
 * Tips and voids have no ledger. They stay 0.
 * Historical on-hand value is not snapshotted. Start and end stay 0.
 * Outside purchases are purchase orders (vendor, item, qty, unit cost, total).
 */

import { staffPunchMinutes, type StaffPunch } from '@/lib/books/clocks';
import {
  buildYearCalendar,
  dayKey,
  splitMinutesAcrossDays,
  WEEK_SPLIT_RULE,
  type CalendarDay,
  type CalendarMonth,
  type CalendarWeek,
} from '@/lib/books/periods';

export const TIPS_EMPTY = 'Tips are not recorded. This is 0, not an estimate.';
export const VOIDS_EMPTY = 'Voids are not recorded. This is 0, not an estimate.';
export const STOCK_VALUE_EMPTY = 'Historical stock value is not stored. Start and end stay 0.';

export type ShopPayMethod = 'card' | 'cash' | 'check' | 'other' | 'refund' | 'chargeback';

export interface ShopMoneyTotals {
  invoicedCents: number;
  paidCents: number;
  unpaidCents: number;
  cardCents: number;
  cashCents: number;
  checkCents: number;
  otherCents: number;
  tipsCents: number;
  refundCents: number;
  chargebackCents: number;
  voidCents: number;
  fixtrayOwedCents: number;
  depositsMatchedCents: number;
  depositsUnmatchedCents: number;
  missingDepositCents: number;
}

export interface FixtrayOwedLine {
  workOrderId: string;
  feeCents: number;
}

export interface PartTotals {
  usedQty: number;
  returnedQty: number;
  adjustedQty: number;
}

export interface PurchaseLine {
  id: string;
  at: string;
  vendor: string;
  item: string;
  qty: number;
  unitCostCents: number;
  totalCents: number;
}

export interface PersonMinutesLine {
  personId: string;
  personName: string;
  minutes: number;
}

export interface ShopDayNode {
  id: string;
  label: string;
  weekday: string;
  money: ShopMoneyTotals;
  fixtrayLines: FixtrayOwedLine[];
  parts: PartTotals;
  purchases: PurchaseLine[];
  staff: PersonMinutesLine[];
  staffMinutes: number;
  work: PersonMinutesLine[];
  workMinutes: number;
  stockValueStartCents: number;
  stockValueEndCents: number;
  stockValueNote: string;
  tipsNote: string;
  voidsNote: string;
}

export interface ShopWeekNode {
  id: string;
  label: string;
  splitAtMonthEdge: boolean;
  money: ShopMoneyTotals;
  fixtrayLines: FixtrayOwedLine[];
  parts: PartTotals;
  purchases: PurchaseLine[];
  staff: PersonMinutesLine[];
  staffMinutes: number;
  work: PersonMinutesLine[];
  workMinutes: number;
  stockValueStartCents: number;
  stockValueEndCents: number;
  stockValueNote: string;
  tipsNote: string;
  voidsNote: string;
  days: ShopDayNode[];
}

export interface ShopMonthNode {
  id: string;
  label: string;
  money: ShopMoneyTotals;
  fixtrayLines: FixtrayOwedLine[];
  parts: PartTotals;
  purchases: PurchaseLine[];
  staff: PersonMinutesLine[];
  staffMinutes: number;
  work: PersonMinutesLine[];
  workMinutes: number;
  stockValueStartCents: number;
  stockValueEndCents: number;
  stockValueNote: string;
  tipsNote: string;
  voidsNote: string;
  weeks: ShopWeekNode[];
}

export interface ShopYearReport {
  year: number;
  timeZone: string;
  weekSplitRule: string;
  revenueVisible: boolean;
  totals: ShopPeriodTotals;
  months: ShopMonthNode[];
}

export interface ShopPeriodTotals {
  money: ShopMoneyTotals;
  fixtrayLines: FixtrayOwedLine[];
  parts: PartTotals;
  staff: PersonMinutesLine[];
  staffMinutes: number;
  work: PersonMinutesLine[];
  workMinutes: number;
  stockValueStartCents: number;
  stockValueEndCents: number;
  stockValueNote: string;
  tipsNote: string;
  voidsNote: string;
  purchaseCount: number;
  purchaseCents: number;
}

export interface ShopInvoice {
  workOrderId: string;
  at: string;
  cents: number;
}

export interface ShopPayment {
  id: string;
  workOrderId: string;
  at: string;
  cents: number;
  method: ShopPayMethod;
}

export interface ShopFixtrayFee {
  id: string;
  workOrderId: string;
  at: string;
  cents: number;
  kind: 'in_person' | 'settlement';
}

export interface ShopDeposit {
  id: string;
  workOrderId: string;
  at: string;
  cents: number;
  matched: boolean;
}

export interface ShopMissingDeposit {
  workOrderId: string;
  at: string;
  cents: number;
}

export interface ShopPartMove {
  id: string;
  at: string;
  kind: 'use' | 'return' | 'adjust';
  qty: number;
}

export interface ShopPunch {
  personId: string;
  personName: string;
  start: string;
  end: string;
  totalMinutes: number;
}

export function emptyMoney(): ShopMoneyTotals {
  return {
    invoicedCents: 0,
    paidCents: 0,
    unpaidCents: 0,
    cardCents: 0,
    cashCents: 0,
    checkCents: 0,
    otherCents: 0,
    tipsCents: 0,
    refundCents: 0,
    chargebackCents: 0,
    voidCents: 0,
    fixtrayOwedCents: 0,
    depositsMatchedCents: 0,
    depositsUnmatchedCents: 0,
    missingDepositCents: 0,
  };
}

function finishMoney(money: ShopMoneyTotals): ShopMoneyTotals {
  const paidCents = money.cardCents + money.cashCents + money.checkCents + money.otherCents;
  return {
    ...money,
    paidCents,
    unpaidCents: money.invoicedCents - paidCents + money.refundCents + money.chargebackCents,
    tipsCents: 0,
    voidCents: 0,
  };
}

export function addMoney(left: ShopMoneyTotals, right: ShopMoneyTotals): ShopMoneyTotals {
  return finishMoney({
    invoicedCents: left.invoicedCents + right.invoicedCents,
    paidCents: 0,
    unpaidCents: 0,
    cardCents: left.cardCents + right.cardCents,
    cashCents: left.cashCents + right.cashCents,
    checkCents: left.checkCents + right.checkCents,
    otherCents: left.otherCents + right.otherCents,
    tipsCents: 0,
    refundCents: left.refundCents + right.refundCents,
    chargebackCents: left.chargebackCents + right.chargebackCents,
    voidCents: 0,
    fixtrayOwedCents: left.fixtrayOwedCents + right.fixtrayOwedCents,
    depositsMatchedCents: left.depositsMatchedCents + right.depositsMatchedCents,
    depositsUnmatchedCents: left.depositsUnmatchedCents + right.depositsUnmatchedCents,
    missingDepositCents: left.missingDepositCents + right.missingDepositCents,
  });
}

export function booksPaymentMethod(kind: string, note: string | null | undefined, appliesTo: string): ShopPayMethod | null {
  if (appliesTo !== 'job') return null;
  if (kind === 'refund') return 'refund';
  if (kind === 'chargeback') return 'chargeback';
  if (kind === 'card_payment') return 'card';
  if (kind !== 'job_payment') return null;
  const text = String(note || '').toLowerCase();
  if (text.includes('opening balance')) return 'other';
  if (text.includes('check')) return 'check';
  if (text.includes('other')) return 'other';
  if (text.includes('cash') || text.includes('in-person')) return 'cash';
  return 'other';
}

export function parsePartAudit(action: string, details: string | null | undefined): { kind: 'use' | 'return' | 'adjust'; qty: number } | null {
  const kind = action.startsWith('parts.') ? action.slice('parts.'.length) : '';
  if (kind !== 'use' && kind !== 'return' && kind !== 'adjust') return null;
  const match = String(details || '').match(/delta (-?\d+)/);
  if (!match) return null;
  const delta = Number(match[1]);
  if (!Number.isInteger(delta) || delta === 0) return null;
  if (kind === 'use') return { kind, qty: Math.abs(delta) };
  if (kind === 'return') return { kind, qty: Math.abs(delta) };
  return { kind, qty: delta };
}

function emptyParts(): PartTotals {
  return { usedQty: 0, returnedQty: 0, adjustedQty: 0 };
}

function addParts(left: PartTotals, right: PartTotals): PartTotals {
  return {
    usedQty: left.usedQty + right.usedQty,
    returnedQty: left.returnedQty + right.returnedQty,
    adjustedQty: left.adjustedQty + right.adjustedQty,
  };
}

function addPeople(lists: PersonMinutesLine[][]): PersonMinutesLine[] {
  const byPerson = new Map<string, PersonMinutesLine>();
  for (const list of lists) {
    for (const person of list) {
      const current = byPerson.get(person.personId) || { personId: person.personId, personName: person.personName, minutes: 0 };
      current.minutes += person.minutes;
      if (person.personName) current.personName = person.personName;
      byPerson.set(person.personId, current);
    }
  }
  return [...byPerson.values()].sort((a, b) => a.personId.localeCompare(b.personId));
}

function addFixtray(lists: FixtrayOwedLine[][]): FixtrayOwedLine[] {
  const byOrder = new Map<string, number>();
  for (const list of lists) {
    for (const line of list) byOrder.set(line.workOrderId, (byOrder.get(line.workOrderId) || 0) + line.feeCents);
  }
  return [...byOrder.entries()]
    .filter(([, feeCents]) => feeCents !== 0)
    .map(([workOrderId, feeCents]) => ({ workOrderId, feeCents }))
    .sort((a, b) => a.workOrderId.localeCompare(b.workOrderId));
}

function notes() {
  return {
    stockValueStartCents: 0,
    stockValueEndCents: 0,
    stockValueNote: STOCK_VALUE_EMPTY,
    tipsNote: TIPS_EMPTY,
    voidsNote: VOIDS_EMPTY,
  };
}

interface DayBucket {
  money: ShopMoneyTotals;
  fixtray: Map<string, number>;
  parts: PartTotals;
  purchases: PurchaseLine[];
  staff: Map<string, PersonMinutesLine>;
  work: Map<string, PersonMinutesLine>;
}

function emptyBucket(): DayBucket {
  return {
    money: emptyMoney(),
    fixtray: new Map(),
    parts: emptyParts(),
    purchases: [],
    staff: new Map(),
    work: new Map(),
  };
}

function peopleOf(map: Map<string, PersonMinutesLine>): PersonMinutesLine[] {
  return [...map.values()].sort((a, b) => a.personId.localeCompare(b.personId));
}

function linesOf(map: Map<string, number>): FixtrayOwedLine[] {
  return [...map.entries()]
    .filter(([, feeCents]) => feeCents !== 0)
    .map(([workOrderId, feeCents]) => ({ workOrderId, feeCents }))
    .sort((a, b) => a.workOrderId.localeCompare(b.workOrderId));
}

function bucketMoney(bucket: DayBucket): ShopMoneyTotals {
  const fixtrayOwedCents = [...bucket.fixtray.values()].reduce((sum, cents) => sum + cents, 0);
  return finishMoney({ ...bucket.money, fixtrayOwedCents });
}

export function buildShopYear(input: {
  year: number;
  timeZone: string;
  invoices: ShopInvoice[];
  payments: ShopPayment[];
  fixtray: ShopFixtrayFee[];
  deposits: ShopDeposit[];
  missingDeposits: ShopMissingDeposit[];
  parts: ShopPartMove[];
  purchases: PurchaseLine[];
  staffPunches: ShopPunch[];
  workPunches: ShopPunch[];
}): ShopYearReport {
  const calendar = buildYearCalendar(input.year, input.timeZone);
  const buckets = new Map<string, DayBucket>();
  const ensure = (day: string) => {
    const existing = buckets.get(day);
    if (existing) return existing;
    const created = emptyBucket();
    buckets.set(day, created);
    return created;
  };
  const place = (at: string) => {
    const instant = new Date(at);
    if (Number.isNaN(instant.getTime())) return null;
    const key = dayKey(instant, calendar.timeZone);
    if (!key.startsWith(`${input.year}-`)) return null;
    return ensure(key);
  };

  for (const invoice of input.invoices) {
    const bucket = place(invoice.at);
    if (!bucket) continue;
    bucket.money.invoicedCents += Math.round(invoice.cents);
  }
  for (const payment of input.payments) {
    const bucket = place(payment.at);
    if (!bucket) continue;
    const amount = Math.round(payment.cents);
    if (payment.method === 'card') bucket.money.cardCents += amount;
    else if (payment.method === 'cash') bucket.money.cashCents += amount;
    else if (payment.method === 'check') bucket.money.checkCents += amount;
    else if (payment.method === 'other') bucket.money.otherCents += amount;
    else if (payment.method === 'refund') bucket.money.refundCents += amount;
    else bucket.money.chargebackCents += amount;
  }
  for (const fee of input.fixtray) {
    const bucket = place(fee.at);
    if (!bucket) continue;
    const signed = fee.kind === 'settlement' ? -Math.round(fee.cents) : Math.round(fee.cents);
    bucket.fixtray.set(fee.workOrderId, (bucket.fixtray.get(fee.workOrderId) || 0) + signed);
  }
  for (const deposit of input.deposits) {
    const bucket = place(deposit.at);
    if (!bucket) continue;
    const amount = Math.round(deposit.cents);
    if (deposit.matched) bucket.money.depositsMatchedCents += amount;
    else bucket.money.depositsUnmatchedCents += amount;
  }
  for (const missing of input.missingDeposits) {
    const bucket = place(missing.at);
    if (!bucket) continue;
    bucket.money.missingDepositCents += Math.round(missing.cents);
  }
  for (const part of input.parts) {
    const bucket = place(part.at);
    if (!bucket) continue;
    if (part.kind === 'use') bucket.parts.usedQty += part.qty;
    else if (part.kind === 'return') bucket.parts.returnedQty += part.qty;
    else bucket.parts.adjustedQty += part.qty;
  }
  for (const purchase of input.purchases) {
    const bucket = place(purchase.at);
    if (!bucket) continue;
    bucket.purchases.push(purchase);
  }
  const addPunch = (punch: ShopPunch, target: 'staff' | 'work') => {
    const start = new Date(punch.start);
    const end = new Date(punch.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    const shares = splitMinutesAcrossDays({
      start,
      end,
      totalMinutes: punch.totalMinutes,
      timeZone: calendar.timeZone,
      year: input.year,
    });
    for (const share of shares) {
      const bucket = ensure(share.day);
      const map = target === 'staff' ? bucket.staff : bucket.work;
      const current = map.get(punch.personId) || { personId: punch.personId, personName: punch.personName, minutes: 0 };
      current.minutes += share.minutes;
      if (punch.personName) current.personName = punch.personName;
      map.set(punch.personId, current);
    }
  };
  for (const punch of input.staffPunches) addPunch(punch, 'staff');
  for (const punch of input.workPunches) addPunch(punch, 'work');

  const dayNode = (day: CalendarDay): ShopDayNode => {
    const bucket = buckets.get(day.id) || emptyBucket();
    const staff = peopleOf(bucket.staff);
    const work = peopleOf(bucket.work);
    return {
      id: day.id,
      label: day.label,
      weekday: day.weekday,
      money: bucketMoney(bucket),
      fixtrayLines: linesOf(bucket.fixtray),
      parts: { ...bucket.parts },
      purchases: bucket.purchases.slice().sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id)),
      staff,
      staffMinutes: staff.reduce((sum, person) => sum + person.minutes, 0),
      work,
      workMinutes: work.reduce((sum, person) => sum + person.minutes, 0),
      ...notes(),
    };
  };

  const roll = (days: ShopDayNode[]) => {
    const money = days.reduce((sum, day) => addMoney(sum, day.money), emptyMoney());
    const staff = addPeople(days.map((day) => day.staff));
    const work = addPeople(days.map((day) => day.work));
    return {
      money,
      fixtrayLines: addFixtray(days.map((day) => day.fixtrayLines)),
      parts: days.reduce((sum, day) => addParts(sum, day.parts), emptyParts()),
      staff,
      staffMinutes: staff.reduce((sum, person) => sum + person.minutes, 0),
      work,
      workMinutes: work.reduce((sum, person) => sum + person.minutes, 0),
      purchaseCount: days.reduce((sum, day) => sum + day.purchases.length, 0),
      purchaseCents: days.reduce((sum, day) => sum + day.purchases.reduce((inner, line) => inner + line.totalCents, 0), 0),
      ...notes(),
    };
  };

  const periodOf = (days: ShopDayNode[]) => {
    const rolled = roll(days);
    return {
      money: rolled.money,
      fixtrayLines: rolled.fixtrayLines,
      parts: rolled.parts,
      staff: rolled.staff,
      staffMinutes: rolled.staffMinutes,
      work: rolled.work,
      workMinutes: rolled.workMinutes,
      stockValueStartCents: rolled.stockValueStartCents,
      stockValueEndCents: rolled.stockValueEndCents,
      stockValueNote: rolled.stockValueNote,
      tipsNote: rolled.tipsNote,
      voidsNote: rolled.voidsNote,
      purchases: days.flatMap((day) => day.purchases),
    };
  };

  const weekNode = (week: CalendarWeek): ShopWeekNode => {
    const days = week.days.map(dayNode);
    return {
      id: week.id,
      label: week.label,
      splitAtMonthEdge: week.splitAtMonthEdge,
      ...periodOf(days),
      days,
    };
  };

  const monthNode = (month: CalendarMonth): ShopMonthNode => {
    const weeks = month.weeks.map(weekNode);
    const days = weeks.flatMap((week) => week.days);
    return {
      id: month.id,
      label: month.label,
      ...periodOf(days),
      weeks,
    };
  };

  const months = calendar.months.map(monthNode);
  const days = months.flatMap((month) => month.weeks.flatMap((week) => week.days));
  const yearRoll = roll(days);
  return {
    year: input.year,
    timeZone: calendar.timeZone,
    weekSplitRule: WEEK_SPLIT_RULE,
    revenueVisible: true,
    totals: yearRoll,
    months,
  };
}

function hideMoney(money: ShopMoneyTotals): ShopMoneyTotals {
  return { ...money, invoicedCents: 0, paidCents: 0, unpaidCents: 0 };
}

/** Shop revenue stays with the owner. Managers keep the other books figures. */
export function hideShopRevenue<T extends ShopYearReport>(report: T): T {
  const walkDay = (day: ShopDayNode): ShopDayNode => ({ ...day, money: hideMoney(day.money) });
  const months = report.months.map((month) => ({
    ...month,
    money: hideMoney(month.money),
    weeks: month.weeks.map((week) => ({
      ...week,
      money: hideMoney(week.money),
      days: week.days.map(walkDay),
    })),
  }));
  return {
    ...report,
    revenueVisible: false,
    totals: { ...report.totals, money: hideMoney(report.totals.money) },
    months,
  };
}

export function punchMinutes(entry: StaffPunch, now: Date): number {
  return staffPunchMinutes(entry, now);
}
