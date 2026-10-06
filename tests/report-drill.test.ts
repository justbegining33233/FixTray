import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FeeYearDrill from '@/components/books/FeeYearDrill';
import ShopYearDrill from '@/components/books/ShopYearDrill';
import { booksAccess } from '@/lib/books/access';
import { buildFeeYear, feeEventFromBooksRow, type FeeTotals, type FeeYearReport } from '@/lib/books/feeDrill';
import { dayKey, splitMinutesAcrossDays, WEEK_SPLIT_RULE, zonedDayStart } from '@/lib/books/periods';
import {
  STOCK_VALUE_EMPTY,
  TIPS_EMPTY,
  VOIDS_EMPTY,
  buildShopYear,
  hideShopRevenue,
  type ShopMoneyTotals,
  type ShopYearReport,
} from '@/lib/books/shopDrill';

const ZONE = 'America/New_York';
const FEE_FIELDS: Array<keyof FeeTotals> = [
  'onlineCollectedCents',
  'inPersonOwedCents',
  'shopPaidCents',
  'stillOwedCents',
  'feeRefundCents',
  'netFeesCents',
];
const MONEY_FIELDS: Array<keyof ShopMoneyTotals> = [
  'invoicedCents',
  'paidCents',
  'unpaidCents',
  'cardCents',
  'cashCents',
  'checkCents',
  'otherCents',
  'tipsCents',
  'refundCents',
  'chargebackCents',
  'voidCents',
  'fixtrayOwedCents',
  'depositsMatchedCents',
  'depositsUnmatchedCents',
  'missingDepositCents',
  'customerCreditCents',
];

function assertFeeRollup(report: FeeYearReport) {
  expect(report.months).toHaveLength(12);
  expect(report.weekSplitRule).toBe(WEEK_SPLIT_RULE);
  expect(report.shopRevenueIncluded).toBe(false);
  const monthSum = emptyFee();
  for (const month of report.months) {
    const weekSum = emptyFee();
    for (const week of month.weeks) {
      const daySum = emptyFee();
      for (const day of week.days) {
        addFee(daySum, day.totals);
        for (const field of FEE_FIELDS) expect(Number.isInteger(day.totals[field])).toBe(true);
      }
      expect(daySum).toEqual(week.totals);
      addFee(weekSum, week.totals);
    }
    expect(weekSum).toEqual(month.totals);
    addFee(monthSum, month.totals);
  }
  expect(monthSum).toEqual(report.totals);
}

function emptyFee(): FeeTotals {
  return {
    onlineCollectedCents: 0,
    inPersonOwedCents: 0,
    shopPaidCents: 0,
    stillOwedCents: 0,
    feeRefundCents: 0,
    netFeesCents: 0,
  };
}

function addFee(target: FeeTotals, source: FeeTotals) {
  for (const field of FEE_FIELDS) target[field] += source[field];
}

const DERIVED_MONEY = new Set<keyof ShopMoneyTotals>(['paidCents']);

function expectActivitySums(parent: ShopMoneyTotals, children: ShopMoneyTotals[]) {
  const sum = emptyMoney();
  for (const child of children) addMoney(sum, child);
  for (const field of MONEY_FIELDS) {
    if (DERIVED_MONEY.has(field)) continue;
    expect(sum[field]).toBe(parent[field]);
  }
  expect(parent.unpaidCents).toBe(children.reduce((total, child) => total + child.unpaidCents, 0));
  expect(parent.customerCreditCents).toBe(children.reduce((total, child) => total + child.customerCreditCents, 0));
  expect(parent.unpaidCents).toBeGreaterThanOrEqual(0);
  expect(parent.paidCents).toBe(parent.cardCents + parent.cashCents + parent.checkCents + parent.otherCents);
}

function assertShopRollup(report: ShopYearReport) {
  expect(report.months).toHaveLength(12);
  let staff = 0;
  let work = 0;
  for (const month of report.months) {
    let monthStaff = 0;
    let monthWork = 0;
    for (const week of month.weeks) {
      let weekStaff = 0;
      let weekWork = 0;
      for (const day of week.days) {
        weekStaff += day.staffMinutes;
        weekWork += day.workMinutes;
        expect(day.staff.reduce((sum, person) => sum + person.minutes, 0)).toBe(day.staffMinutes);
        expect(day.work.reduce((sum, person) => sum + person.minutes, 0)).toBe(day.workMinutes);
        for (const field of MONEY_FIELDS) expect(Number.isInteger(day.money[field])).toBe(true);
        expectActivitySums(day.money, [day.money]);
      }
      expectActivitySums(week.money, week.days.map((day) => day.money));
      expect(weekStaff).toBe(week.staffMinutes);
      expect(weekWork).toBe(week.workMinutes);
      monthStaff += week.staffMinutes;
      monthWork += week.workMinutes;
    }
    expectActivitySums(month.money, month.weeks.flatMap((week) => week.days).map((day) => day.money));
    expect(monthStaff).toBe(month.staffMinutes);
    expect(monthWork).toBe(month.workMinutes);
    staff += month.staffMinutes;
    work += month.workMinutes;
  }
  expectActivitySums(report.totals.money, report.months.flatMap((month) => month.weeks.flatMap((week) => week.days)).map((day) => day.money));
  expect(staff).toBe(report.totals.staffMinutes);
  expect(work).toBe(report.totals.workMinutes);
}

function emptyMoney(): ShopMoneyTotals {
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
    customerCreditCents: 0,
  };
}

function addMoney(target: ShopMoneyTotals, source: ShopMoneyTotals) {
  for (const field of MONEY_FIELDS) target[field] += source[field];
}

describe('report calendar', () => {
  it('uses America/New_York midnight as the day boundary', () => {
    expect(dayKey(new Date('2026-10-08T03:30:00.000Z'), ZONE)).toBe('2026-10-07');
    expect(dayKey(new Date('2026-10-08T04:00:00.000Z'), ZONE)).toBe('2026-10-08');
    expect(zonedDayStart('2026-10-08', ZONE).toISOString()).toBe('2026-10-08T04:00:00.000Z');
    expect(dayKey(new Date('2026-11-02T04:30:00.000Z'), ZONE)).toBe('2026-11-01');
    expect(dayKey(new Date('2026-11-02T05:00:00.000Z'), ZONE)).toBe('2026-11-02');
  });

  it('splits a Monday week at the month edge without sharing a day', () => {
    const report = buildFeeYear({ year: 2026, timeZone: ZONE, events: [] });
    const september = report.months.find((month) => month.id === '2026-09');
    const october = report.months.find((month) => month.id === '2026-10');
    const opening = september?.weeks.find((week) => week.splitAtMonthEdge && week.id.startsWith('2026-09-28'));
    const closing = october?.weeks.find((week) => week.id.startsWith('2026-09-28'));
    expect(opening?.days.map((day) => day.id)).toEqual(['2026-09-28', '2026-09-29', '2026-09-30']);
    expect(closing?.days.map((day) => day.id)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    const shared = opening?.days.filter((day) => closing?.days.some((other) => other.id === day.id)) || [];
    expect(shared).toEqual([]);
  });

  it('keeps whole minutes when a punch crosses local midnight', () => {
    const shares = splitMinutesAcrossDays({
      start: new Date('2026-10-08T02:00:00.000Z'),
      end: new Date('2026-10-08T06:00:00.000Z'),
      totalMinutes: 240,
      timeZone: ZONE,
      year: 2026,
    });
    expect(shares).toEqual([
      { day: '2026-10-07', minutes: 120 },
      { day: '2026-10-08', minutes: 120 },
    ]);
    expect(shares.reduce((sum, share) => sum + share.minutes, 0)).toBe(240);
  });
});

describe('fee year drill', () => {
  const report = buildFeeYear({
    year: 2026,
    timeZone: ZONE,
    events: [
      { id: 'online', shopId: 'shop-a', shopName: 'Alpha', workOrderId: 'WO-1', at: '2026-09-30T16:00:00.000Z', kind: 'online', feeCents: 4321 },
      { id: 'person', shopId: 'shop-a', shopName: 'Alpha', workOrderId: 'WO-2', at: '2026-10-01T16:00:00.000Z', kind: 'in_person', feeCents: 2500 },
      { id: 'paid', shopId: 'shop-a', shopName: 'Alpha', workOrderId: 'WO-2', at: '2026-10-08T15:00:00.000Z', kind: 'shop_paid', feeCents: 2500 },
      { id: 'late', shopId: 'shop-b', shopName: 'Beta', workOrderId: 'WO-3', at: '2026-10-08T03:30:00.000Z', kind: 'in_person', feeCents: 700 },
      { id: 'refund', shopId: 'shop-b', shopName: 'Beta', workOrderId: 'WO-3', at: '2026-11-02T15:00:00.000Z', kind: 'refund', feeCents: 700 },
      { id: 'outside', shopId: 'shop-a', shopName: 'Alpha', workOrderId: 'WO-9', at: '2025-12-31T15:00:00.000Z', kind: 'online', feeCents: 9999 },
    ],
  });

  it('rolls days into weeks, weeks into months, and months into the year', () => {
    assertFeeRollup(report);
    expect(JSON.stringify(report)).not.toContain('estimatedCost');
    expect(JSON.stringify(report)).not.toContain('invoicedCents');
  });

  it('keeps the stored checkout fee and puts the refund in November', () => {
    const september = report.months.find((month) => month.id === '2026-09');
    const october = report.months.find((month) => month.id === '2026-10');
    const november = report.months.find((month) => month.id === '2026-11');
    const sep30 = september?.weeks.flatMap((week) => week.days).find((day) => day.id === '2026-09-30');
    const oct1 = october?.weeks.flatMap((week) => week.days).find((day) => day.id === '2026-10-01');
    const oct7 = october?.weeks.flatMap((week) => week.days).find((day) => day.id === '2026-10-07');
    expect(sep30?.charges).toEqual([
      expect.objectContaining({ workOrderId: 'WO-1', feeCents: 4321, kind: 'online' }),
    ]);
    expect(oct1?.charges[0].feeCents).toBe(2500);
    expect(oct7?.totals.inPersonOwedCents).toBe(700);
    expect(october?.totals.feeRefundCents).toBe(0);
    expect(november?.totals.feeRefundCents).toBe(700);
    expect(september?.totals.onlineCollectedCents).toBe(4321);
    expect(october?.totals.onlineCollectedCents).toBe(0);
    expect(report.totals.onlineCollectedCents).toBe(4321);
    expect(report.totals.inPersonOwedCents).toBe(3200);
    expect(report.totals.shopPaidCents).toBe(2500);
    expect(report.totals.stillOwedCents).toBe(700);
    expect(report.totals.feeRefundCents).toBe(700);
    expect(report.totals.netFeesCents).toBe(4321 + 3200 - 700);
    const opening = september?.weeks.find((week) => week.id === '2026-09-28~2026-09');
    const closing = october?.weeks.find((week) => week.id === '2026-09-28~2026-10');
    expect(opening?.totals.onlineCollectedCents).toBe(4321);
    expect(opening?.totals.inPersonOwedCents).toBe(0);
    expect(closing?.totals.inPersonOwedCents).toBe(2500);
    expect((opening?.totals.onlineCollectedCents || 0) + (closing?.totals.onlineCollectedCents || 0)).toBe(4321);
  });

  it('reads books cents and treats an opening balance as already collected', () => {
    const stored = feeEventFromBooksRow({
      id: 'row-1',
      shopId: 'shop-a',
      workOrderId: 'WO-4',
      kind: 'job_payment',
      appliesTo: 'fee',
      amountCents: 1800,
      note: 'in-person cash',
      createdAt: '2026-10-08T16:00:00.000Z',
    });
    const opening = feeEventFromBooksRow({
      id: 'row-2',
      shopId: 'shop-a',
      workOrderId: 'WO-5',
      kind: 'job_payment',
      appliesTo: 'fee',
      amountCents: 900,
      note: 'Opening balance',
      createdAt: '2026-10-08T16:00:00.000Z',
    });
    expect(stored).toEqual(expect.objectContaining({ kind: 'in_person', feeCents: 1800 }));
    expect(opening).toEqual(expect.objectContaining({ kind: 'online', feeCents: 900 }));
    const built = buildFeeYear({
      year: 2026,
      timeZone: ZONE,
      events: [stored, opening].filter((event): event is NonNullable<typeof event> => Boolean(event)),
    });
    const day = built.months[9].weeks.flatMap((week) => week.days).find((item) => item.id === '2026-10-08');
    expect(day?.charges.map((charge) => charge.feeCents)).toEqual([1800, 900]);
    expect(day?.totals.inPersonOwedCents).toBe(1800);
    expect(day?.totals.onlineCollectedCents).toBe(900);
  });
});

describe('shop books drill', () => {
  const report = buildShopYear({
    year: 2026,
    timeZone: ZONE,
    invoices: [
      { workOrderId: 'WO-1', at: '2026-09-30T16:00:00.000Z', cents: 10000 },
      { workOrderId: 'WO-2', at: '2026-10-01T16:00:00.000Z', cents: 5000 },
    ],
    payments: [
      { id: 'card', workOrderId: 'WO-1', at: '2026-09-30T18:00:00.000Z', cents: 10000, method: 'card' },
      { id: 'cash', workOrderId: 'WO-2', at: '2026-10-02T16:00:00.000Z', cents: 2000, method: 'cash' },
      { id: 'refund', workOrderId: 'WO-2', at: '2026-11-03T16:00:00.000Z', cents: 400, method: 'refund' },
    ],
    fixtray: [
      { id: 'fee', workOrderId: 'WO-2', at: '2026-10-02T16:00:00.000Z', cents: 515, kind: 'in_person' },
    ],
    deposits: [
      { id: 'dep-1', workOrderId: 'WO-1', at: '2026-09-30T17:00:00.000Z', cents: 10000, matched: true },
      { id: 'dep-2', workOrderId: 'WO-9', at: '2026-10-05T16:00:00.000Z', cents: 300, matched: false },
    ],
    missingDeposits: [
      { workOrderId: 'WO-2', at: '2026-10-02T16:00:00.000Z', cents: 2000 },
    ],
    parts: [
      { id: 'use', at: '2026-10-02T16:00:00.000Z', kind: 'use', qty: 2 },
      { id: 'ret', at: '2026-10-03T16:00:00.000Z', kind: 'return', qty: 1 },
    ],
    purchases: [
      { id: 'po-1', at: '2026-10-06T16:00:00.000Z', vendor: 'NAPA', item: 'Filter', qty: 2, unitCostCents: 450, totalCents: 900 },
    ],
    staffPunches: [
      { personId: 'tech-1', personName: 'Ada', start: '2026-10-08T02:00:00.000Z', end: '2026-10-08T06:00:00.000Z', totalMinutes: 240 },
    ],
    workPunches: [
      { personId: 'tech-1', personName: 'Ada', start: '2026-10-02T14:00:00.000Z', end: '2026-10-02T15:30:00.000Z', totalMinutes: 90 },
    ],
  });

  it('rolls every money field and keeps staff hours off the work clock', () => {
    assertShopRollup(report);
    const september = report.months.find((month) => month.id === '2026-09');
    const october = report.months.find((month) => month.id === '2026-10');
    const november = report.months.find((month) => month.id === '2026-11');
    expect(september?.money.invoicedCents).toBe(10000);
    expect(october?.money.invoicedCents).toBe(5000);
    expect(september?.money.paidCents).toBe(10000);
    expect(october?.money.unpaidCents).toBe(3400);
    expect(november?.money.refundCents).toBe(400);
    expect(october?.money.refundCents).toBe(0);
    expect(report.totals.money.refundCents).toBe(400);
    expect(report.totals.money.unpaidCents).toBe(3400);
    expect(october?.fixtrayLines).toEqual([{ workOrderId: 'WO-2', feeCents: 515 }]);
    expect(october?.staffMinutes).toBe(240);
    expect(october?.workMinutes).toBe(90);
    expect(october?.staff[0]).toEqual({ personId: 'tech-1', personName: 'Ada', minutes: 240 });
    expect(october?.work[0].minutes).toBe(90);
    const oct7 = october?.weeks.flatMap((week) => week.days).find((day) => day.id === '2026-10-07');
    const oct8 = october?.weeks.flatMap((week) => week.days).find((day) => day.id === '2026-10-08');
    expect(oct7?.staffMinutes).toBe(120);
    expect(oct8?.staffMinutes).toBe(120);
    expect(oct7?.workMinutes).toBe(0);
  });

  it('splits the Sep 30 / Oct 1 week and does not count either day twice', () => {
    const september = report.months.find((month) => month.id === '2026-09');
    const october = report.months.find((month) => month.id === '2026-10');
    const opening = september?.weeks.find((week) => week.id === '2026-09-28~2026-09');
    const closing = october?.weeks.find((week) => week.id === '2026-09-28~2026-10');
    expect(opening?.money.invoicedCents).toBe(10000);
    expect(closing?.money.invoicedCents).toBe(5000);
    expect((opening?.money.invoicedCents || 0) + (closing?.money.invoicedCents || 0)).toBe(15000);
    expect(report.totals.money.invoicedCents).toBe(15000);
  });

  it('shows tips, voids, and stock value as empty zeros and keeps real purchases', () => {
    const october = report.months.find((month) => month.id === '2026-10');
    expect(october?.money.tipsCents).toBe(0);
    expect(october?.money.voidCents).toBe(0);
    expect(october?.tipsNote).toBe(TIPS_EMPTY);
    expect(october?.voidsNote).toBe(VOIDS_EMPTY);
    expect(october?.stockValueStartCents).toBe(0);
    expect(october?.stockValueEndCents).toBe(0);
    expect(october?.stockValueNote).toBe(STOCK_VALUE_EMPTY);
    expect(october?.purchases).toEqual([
      expect.objectContaining({ vendor: 'NAPA', item: 'Filter', qty: 2, unitCostCents: 450, totalCents: 900 }),
    ]);
    expect(october?.parts).toEqual({ usedQty: 2, returnedQty: 1, adjustedQty: 0 });
    expect(october?.money.depositsUnmatchedCents).toBe(300);
    expect(october?.money.missingDepositCents).toBe(2000);
    const empty = buildShopYear({
      year: 2026,
      timeZone: ZONE,
      invoices: [],
      payments: [],
      fixtray: [],
      deposits: [],
      missingDeposits: [],
      parts: [],
      purchases: [],
      staffPunches: [],
      workPunches: [],
    });
    expect(empty.totals.purchaseCount).toBe(0);
    expect(empty.months[9].purchases).toEqual([]);
  });

  it('hides invoiced, paid, and unpaid from managers and leaves other books figures', () => {
    expect(booksAccess('shop').shopRevenue).toBe(true);
    expect(booksAccess('manager').shopRevenue).toBe(false);
    const hidden = hideShopRevenue(report);
    expect(hidden.revenueVisible).toBe(false);
    expect(hidden.totals.money.invoicedCents).toBe(0);
    expect(hidden.totals.money.paidCents).toBe(0);
    expect(hidden.totals.money.unpaidCents).toBe(0);
    expect(hidden.totals.money.cardCents).toBe(report.totals.money.cardCents);
    expect(hidden.totals.money.fixtrayOwedCents).toBe(515);
    expect(hidden.months.every((month) => month.money.invoicedCents === 0 && month.money.paidCents === 0)).toBe(true);
    expect(hidden.months[9].money.cashCents).toBe(2000);
  });
});

describe('drill screens', () => {
  const root = join(__dirname, '..');

  it('serves the fee drill on year-end and strips shop revenue for managers', () => {
    const feeRoute = readFileSync(join(root, 'src/app/api/admin/fee-year-end/route.ts'), 'utf8');
    const booksRoute = readFileSync(join(root, 'src/app/api/shop/books/route.ts'), 'utf8');
    const feePage = readFileSync(join(root, 'src/app/admin/fee-year-end/page.tsx'), 'utf8');
    const books = readFileSync(join(root, 'src/components/ShopBooksScreen.tsx'), 'utf8');
    expect(feeRoute).toContain('loadFeeYearDrill');
    expect(feePage).toContain('FeeYearDrill');
    expect(feePage).toContain('inPersonLines');
    const exportRoute = readFileSync(join(root, 'src/app/api/shop/books/export/route.ts'), 'utf8');
    expect(booksRoute).toContain('hideShopRevenue');
    expect(booksRoute).toContain('shopRevenue');
    expect(exportRoute).toContain('shopRevenue');
    expect(books).toContain('revenueVisible');
    expect(books).toContain('ShopYearDrill');
  });

  it('renders the dark-red drill with a year breadcrumb and hides owner revenue from managers', () => {
    const fee = buildFeeYear({
      year: 2026,
      timeZone: ZONE,
      events: [
        { id: 'person', shopId: 'shop-a', shopName: 'Alpha', workOrderId: 'WO-2', at: '2026-10-08T16:00:00.000Z', kind: 'in_person', feeCents: 2500 },
      ],
    });
    const feeHtml = renderToStaticMarkup(createElement(FeeYearDrill, { report: fee, onYear: () => undefined }));
    expect(feeHtml).toContain('2026');
    expect(feeHtml).toContain('Fees collected online');
    expect(feeHtml).toContain('Fees still owed');
    expect(feeHtml).toContain('Net fees');
    expect(feeHtml).toContain('#e5332a');
    expect(feeHtml).toContain('October');
    expect(feeHtml).not.toContain('Jobs invoiced');

    const shop = hideShopRevenue(buildShopYear({
      year: 2026,
      timeZone: ZONE,
      invoices: [{ workOrderId: 'WO-2', at: '2026-10-08T16:00:00.000Z', cents: 5000 }],
      payments: [],
      fixtray: [{ id: 'fee', workOrderId: 'WO-2', at: '2026-10-08T16:00:00.000Z', cents: 2500, kind: 'in_person' }],
      deposits: [],
      missingDeposits: [],
      parts: [],
      purchases: [],
      staffPunches: [],
      workPunches: [],
    }));
    const shopHtml = renderToStaticMarkup(createElement(ShopYearDrill, { report: shop, onYear: () => undefined }));
    expect(shopHtml).toContain('Shop revenue is visible to the shop owner only.');
    expect(shopHtml).toContain('Work order WO-2');
    expect(shopHtml).toContain('$25.00');
    expect(shopHtml).not.toContain('Jobs invoiced');
    expect(shopHtml).toContain('No outside purchases');
    expect(shopHtml).toContain(TIPS_EMPTY);
  });
});
