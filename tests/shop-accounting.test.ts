import fs from 'fs';
import path from 'path';
import { customerFacingServiceFeeCents } from '../src/lib/serviceFeeBill';
import { freezeFeeSnapshot } from '../src/lib/feeSnapshot';
import { planCounterPayment } from '../src/lib/books/counterPay';
import { assembleShopJobs, inPersonFeeOwed, monthClose, owedFeeBreakdown, planInPersonPayment, type BooksRow, type InPersonMethod } from '../src/lib/books/money';
import { booksDayKey, shopDayRange, shopWeekRange } from '../src/lib/books/periods';
import { arAging, isStillOpenStatus, jobBalance, positionJob, rangeSnapshot, type ShopJobFacts } from '../src/lib/books/truth';
import {
  balanceSheetBalances,
  balanceSheetView,
  isFeeAccountKey,
  postInventoryAdjustment,
  postPartsCogs,
  postVendorBill,
  statementTotals,
  trialBalance,
} from '../src/lib/books/journal';
import { cashBasisIncome, journalForFacts } from '../src/lib/books/statements';
import { invoiceTax } from '../src/lib/books/shopTax';
import { allocateTechRevenue, jobProfit, partsCostFromUsage, receiveInventory } from '../src/lib/books/floor';
import { booksAccess, shopIdForBooks } from '../src/lib/books/access';
import { menuHrefs, portalAccessDecision } from '../src/lib/roleMenus';
import { buildShopYear } from '../src/lib/books/shopDrill';
import { mergeWorkOrderView } from '../src/lib/workOrderView';
import { buildQboBooksPush, fullQboMap, postQboEntities, qboTotalsMatchBooks } from '../src/lib/books/qboPush';

const ZONE = 'America/New_York';
const AT = '2026-10-05T15:00:00.000Z';
const LATE = '2026-10-06T03:42:00.000Z';

function job(partial: Partial<ShopJobFacts> & { id: string }): ShopJobFacts {
  return {
    invoiceCents: 10000,
    invoiceAt: AT,
    status: 'completed',
    completedAt: AT,
    partsSellCents: 4000,
    events: [],
    ...partial,
  };
}

describe('one shop calculation', () => {
  const week = shopWeekRange(new Date(AT), ZONE);
  const paid = job({
    id: 'wo-paid',
    events: [
      { id: 'inv-paid', workOrderId: 'wo-paid', at: AT, kind: 'invoice', cents: 10000 },
      { id: 'pay-paid', workOrderId: 'wo-paid', at: AT, kind: 'payment', cents: 10000, method: 'check' },
    ],
  });
  const open = job({
    id: 'wo-open',
    status: 'waiting-for-payment',
    completedAt: null,
    events: [{ id: 'inv-open', workOrderId: 'wo-open', at: AT, kind: 'invoice', cents: 10000 }],
  });
  const over = job({
    id: 'wo-over',
    events: [
      { id: 'inv-over', workOrderId: 'wo-over', at: AT, kind: 'invoice', cents: 10000 },
      { id: 'pay-over', workOrderId: 'wo-over', at: AT, kind: 'payment', cents: 12000, method: 'cash' },
    ],
  });
  const missing = job({
    id: 'wo-missing',
    invoiceCents: null,
    events: [{ id: 'pay-missing', workOrderId: 'wo-missing', at: AT, kind: 'payment', cents: 5000, method: 'check' }],
  });
  const facts = [paid, open, over, missing];

  it('uses the same week figures for books, cash, AR, and completed jobs', () => {
    const snap = rangeSnapshot(facts, week.start, week.end);
    expect(snap.invoicedCents).toBe(30000);
    expect(snap.paidCents).toBe(27000);
    expect(snap.revenueCents).toBe(27000);
    expect(snap.checkCents).toBe(15000);
    expect(snap.cashCents).toBe(12000);
    expect(snap.completedCount).toBe(3);
    expect(snap.arCents).toBe(10000);
    expect(snap.customerCreditCents).toBe(7000);
    expect(snap.arCents).toBeGreaterThanOrEqual(0);
    const again = rangeSnapshot(facts, week.start, week.end);
    expect(again).toEqual(snap);
  });

  it('never lets AR go negative', () => {
    const overPosition = positionJob(over);
    expect(overPosition.arCents).toBe(0);
    expect(overPosition.customerCreditCents).toBe(2000);
    expect(overPosition.flags).toContain('overpayment');
    const missingPosition = positionJob(missing);
    expect(missingPosition.arCents).toBe(0);
    expect(missingPosition.customerCreditCents).toBe(5000);
    expect(missingPosition.flags).toEqual(expect.arrayContaining(['missing_invoice', 'payment_without_invoice']));
    for (const row of arAging(facts, new Date(AT), ZONE)) {
      expect(row.arCents).toBeGreaterThan(0);
    }
  });

  it('matches the profit and loss and the balance sheet to books', () => {
    const snap = rangeSnapshot([paid], week.start, week.end);
    const entries = journalForFacts([paid], week.start, week.end, { ratePercent: 0, laborTaxable: false, partsTaxable: false }, ZONE);
    const balance = trialBalance(entries);
    const statements = statementTotals(entries);
    expect(balance.balanced).toBe(true);
    expect(balance.debitCents).toBe(balance.creditCents);
    expect(balanceSheetBalances(entries)).toBe(true);
    expect(statements.laborIncomeCents + statements.partsIncomeCents).toBe(snap.invoicedCents);
    expect(statements.netIncomeCents).toBe(snap.revenueCents);
    expect(statements.arCents).toBe(0);
  });

  it('reads the same helpers on the report routes', () => {
    const root = process.cwd();
    for (const file of [
      'src/app/api/shop/stats/route.ts',
      'src/app/api/shop/eod-report/route.ts',
      'src/app/api/analytics/route.ts',
      'src/app/api/ar-aging/route.ts',
      'src/app/api/shop/accounting/route.ts',
      'src/lib/books/loadShopBooks.ts',
    ]) {
      const source = fs.readFileSync(path.join(root, file), 'utf8');
      expect(source.includes('rangeSnapshot') || source.includes('positionJobs') || source.includes('loadShopFacts')).toBe(true);
    }
  });
});

describe('shop timezone', () => {
  it('keeps 11:42pm Eastern on October 5', () => {
    const late = new Date(LATE);
    const fifth = shopDayRange('2026-10-05', ZONE);
    const sixth = shopDayRange('2026-10-06', ZONE);
    expect(late.getTime()).toBeGreaterThanOrEqual(fifth.start.getTime());
    expect(late.getTime()).toBeLessThan(fifth.end.getTime());
    expect(late.getTime()).toBeLessThan(sixth.start.getTime());
    const week = shopWeekRange(late, ZONE);
    expect(week.label).toBe('2026-10-05');
  });
});

describe('in-person fee snapshot', () => {
  const quoteCents = 21997;
  const frozen = freezeFeeSnapshot({
    completion: {},
    quoteCents,
    livePlatformFeeCents: 1000,
    now: AT,
  });

  it.each(['cash', 'check', 'card'] as InPersonMethod[])('stores the frozen fee for %s', (method) => {
    expect(frozen.ok).toBe(true);
    if (!frozen.ok) return;
    const counter = planCounterPayment({
      workOrderId: 'wo-counter',
      shopId: 'shop-jose',
      completion: frozen.completion,
      quoteCents,
      alreadyReceivedCents: 0,
      tenderedCents: quoteCents,
      method,
      feeAlreadyRecorded: false,
      actorId: 'jose',
      at: AT,
    });
    expect(counter.ok).toBe(true);
    if (!counter.ok) return;
    const fee = counter.planned.entries.find((entry) => entry.appliesTo === 'fee');
    const jobLine = counter.planned.entries.find((entry) => entry.appliesTo === 'job');
    expect(fee?.amountCents).toBe(customerFacingServiceFeeCents(quoteCents, 1000));
    expect(fee?.amountCents).toBe(frozen.snapshot.customerFacingFeeCents);
    expect(jobLine?.amountCents).toBe(quoteCents);
    const rows: BooksRow[] = counter.planned.entries.map((entry, index) => ({
      id: `${method}-${index}`,
      workOrderId: 'wo-counter',
      shopId: 'shop-jose',
      kind: entry.kind,
      appliesTo: entry.appliesTo,
      amountCents: entry.amountCents,
      status: entry.status,
      createdAt: AT,
      note: entry.note,
    }));
    const owed = inPersonFeeOwed(rows);
    expect(owed.openLines.map((line) => line.workOrderId)).toContain('wo-counter');
    expect(owed.owedCents).toBe(fee?.amountCents);
    expect(owed.feeDeductedFromShop).toBe(false);
  });

  it('marks the counter path from the pay route', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/app/api/workorders/[id]/pay/route.ts'), 'utf8');
    expect(source).toContain('planCounterPayment');
    expect(source).toContain('card_in_person');
  });
});

describe('sales tax from owner settings', () => {
  it('stays at zero until the owner sets a rate and a taxable base', () => {
    expect(invoiceTax({ laborCents: 6000, partsCents: 4000, settings: { ratePercent: 0, laborTaxable: true, partsTaxable: true } }).taxCents).toBe(0);
    expect(invoiceTax({ laborCents: 6000, partsCents: 4000, settings: { ratePercent: 8, laborTaxable: false, partsTaxable: false } }).taxCents).toBe(0);
  });

  it('taxes labor and parts once each', () => {
    const both = invoiceTax({ laborCents: 6000, partsCents: 4000, settings: { ratePercent: 10, laborTaxable: true, partsTaxable: true } });
    expect(both.taxCents).toBe(1000);
    expect(both.laborTaxCents).toBe(600);
    expect(both.partsTaxCents).toBe(400);
    expect(invoiceTax({ laborCents: 6000, partsCents: 4000, settings: { ratePercent: 10, laborTaxable: true, partsTaxable: false } }).taxCents).toBe(600);
    expect(invoiceTax({ laborCents: 6000, partsCents: 4000, settings: { ratePercent: 10, laborTaxable: false, partsTaxable: true } }).taxCents).toBe(400);
  });
});

describe('journal, inventory, and job profit', () => {
  it('receives a vendor bill into inventory and then cost of goods', () => {
    const received = receiveInventory({ onHand: 2, unitCostCents: 100, qty: 3, billUnitCostCents: 250 });
    expect(received.qty).toBe(5);
    expect(received.unitCostCents).toBe(250);
    expect(received.valueCents).toBe(1250);
    const bill = postVendorBill({ id: 'bill-1', date: '2026-10-05', amountCents: 750, toInventory: true });
    const cogs = postPartsCogs({ id: 'cogs-1', workOrderId: 'wo-paid', date: '2026-10-05', amountCents: 250 });
    const entries = [bill, cogs];
    expect(trialBalance(entries).balanced).toBe(true);
    const statements = statementTotals(entries);
    expect(statements.inventoryCents).toBe(500);
    expect(statements.cogsCents).toBe(250);
    expect(statements.apCents).toBe(750);
    expect(balanceSheetBalances(entries)).toBe(true);
  });

  it('shows rate not set when the tech has no pay rate', () => {
    const missing = jobProfit({ workOrderId: 'wo', revenueCents: 10000, partsCostCents: 2000, laborMinutes: 60, hourlyRateCents: 0 });
    expect(missing.rateNote).toBe('rate not set');
    expect(missing.profitCents).toBeNull();
    const priced = jobProfit({ workOrderId: 'wo', revenueCents: 10000, partsCostCents: 2000, laborMinutes: 60, hourlyRateCents: 3000 });
    expect(priced.profitCents).toBe(5000);
    expect(priced.rateNote).toBeNull();
  });
});

describe('accountant access', () => {
  const allowed = [
    '/shop/books',
    '/shop/accounting',
    '/shop/accounting/exports',
    '/shop/ar-aging',
    '/shop/accounting/ap',
    '/shop/accounting/tax',
    '/shop/accounting/pl',
    '/shop/accounting/balance-sheet',
    '/shop/accounting/chart',
    '/shop/accounting/productivity',
    '/shop/accounting/quickbooks',
    '/shop/profit-margins',
  ];

  it('opens only this shop\'s books pages', () => {
    for (const page of allowed) expect(portalAccessDecision(page, 'accountant')).toBe('allow');
    expect(portalAccessDecision('/shop/jobs', 'accountant')).toBe('home');
    for (const page of ['/shop/accounting/pl', '/shop/accounting/balance-sheet', '/shop/accounting/chart', '/shop/accounting/tax', '/shop/accounting/ap', '/shop/profit-margins', '/shop/accounting/productivity', '/shop/accounting/quickbooks']) {
      expect(menuHrefs('shop')).toContain(page);
      expect(menuHrefs('accountant')).toContain(page);
      expect(menuHrefs('manager')).not.toContain(page);
      expect(menuHrefs('tech')).not.toContain(page);
      expect(menuHrefs('customer')).not.toContain(page);
    }
    expect(portalAccessDecision('/admin/home', 'accountant')).toBe('forbidden');
    expect(portalAccessDecision('/admin/fee-year-end', 'accountant')).toBe('forbidden');
    expect(portalAccessDecision('/superadmin/dashboard', 'accountant')).toBe('home');
    expect(booksAccess('accountant').accountantRead).toBe(true);
    expect(booksAccess('accountant').quickBooksConnect).toBe(false);
    expect(booksAccess('accountant').platformFeeYear).toBe(false);
    expect(booksAccess('manager').shopRevenue).toBe(false);
    expect(shopIdForBooks({ role: 'accountant', id: 'person', shopId: 'shop-jose' })).toBe('shop-jose');
    expect(shopIdForBooks({ role: 'accountant', id: 'person', shopId: 'other-shop' })).toBe('other-shop');
  });
});

describe('QuickBooks push', () => {
  const week = shopWeekRange(new Date(AT), ZONE);
  const facts = [job({
    id: 'wo-paid',
    customerId: 'cust-1',
    events: [
      { id: 'inv-paid', workOrderId: 'wo-paid', at: AT, kind: 'invoice', cents: 10000, taxCents: 0 },
      { id: 'pay-paid', workOrderId: 'wo-paid', at: AT, kind: 'payment', cents: 10000, method: 'check' },
    ],
  })];

  it('matches books, leaves out the fee, and does not duplicate a re-sync', async () => {
    expect(isFeeAccountKey('fixtrayFee')).toBe(true);
    expect(fullQboMap({ fee: '99' }).ok).toBe(false);
    const first = buildQboBooksPush({
      shopId: 'shop-jose',
      month: '2026-10',
      jobs: facts,
      start: week.start,
      end: week.end,
      customers: [{ id: 'cust-1', name: 'Carla' }],
      map: { sales: '81', payments: '82', refunds: '83', labor: '84', parts: '85', tax: '86' },
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.feeIncluded).toBe(false);
    expect(qboTotalsMatchBooks(first.totals, first.books)).toBe(true);
    const payload = JSON.stringify(first.requests).toLowerCase();
    expect(payload).not.toContain('fixtray fee');
    expect(payload).not.toContain('platform fee');
    const posted = Object.fromEntries(first.requests.map((row) => [row.idempotencyKey, 'qbo-1']));
    const second = buildQboBooksPush({
      shopId: 'shop-jose',
      month: '2026-10',
      jobs: facts,
      start: week.start,
      end: week.end,
      customers: [{ id: 'cust-1', name: 'Carla' }],
      map: { sales: '81' },
      alreadyPosted: posted,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.requests).toHaveLength(0);
    expect(qboTotalsMatchBooks(second.totals, second.books)).toBe(true);

    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(String(url));
      const entity = String(url).includes('/invoice') ? 'Invoice' : 'Customer';
      return new Response(JSON.stringify({ [entity]: { Id: '1' } }), { status: 200 });
    }) as typeof fetch;
    const postedOnce = await postQboEntities({
      apiHost: 'https://quickbooks.example',
      realmId: '123',
      accessToken: 'token',
      requests: first.requests.filter((row) => row.entity === 'Customer' || row.entity === 'Invoice'),
      fetchImpl,
    });
    expect(postedOnce.ok).toBe(true);
    if (!postedOnce.ok) return;
    const again = await postQboEntities({
      apiHost: 'https://quickbooks.example',
      realmId: '123',
      accessToken: 'token',
      requests: first.requests.filter((row) => row.entity === 'Customer' || row.entity === 'Invoice'),
      alreadyPosted: postedOnce.posted,
      fetchImpl,
    });
    expect(again.ok).toBe(true);
    expect(calls.length).toBe(2);
  });
});

describe('preview books disagreements', () => {
  const week = shopWeekRange(new Date('2026-10-06T16:00:00.000Z'), ZONE);

  it('counts an Oct 5 date-only payment inside the Oct 5 week', () => {
    expect(booksDayKey(new Date('2026-10-05T00:00:00.000Z'), ZONE)).toBe('2026-10-05');
    const report = buildShopYear({
      year: 2026,
      timeZone: ZONE,
      invoices: [],
      payments: [
        { id: 'wo8', workOrderId: 'wo-08', at: '2026-10-05T00:00:00.000Z', cents: 8999, method: 'card' },
        { id: 'wo10', workOrderId: 'wo-10', at: '2026-10-05T00:00:00.000Z', cents: 4999, method: 'cash' },
        { id: 'wo9', workOrderId: 'wo-09', at: '2026-10-05T00:00:00.000Z', cents: 3000, method: 'cash' },
      ],
      fixtray: [],
      deposits: [
        { id: 'd8', workOrderId: 'wo-08', at: '2026-10-05T00:00:00.000Z', cents: 8999, matched: true },
        { id: 'd10', workOrderId: 'wo-10', at: '2026-10-05T00:00:00.000Z', cents: 4999, matched: true },
        { id: 'd9', workOrderId: 'wo-09', at: '2026-10-05T00:00:00.000Z', cents: 3000, matched: true },
      ],
      missingDeposits: [],
      parts: [],
      purchases: [],
      staffPunches: [],
      workPunches: [],
    });
    const october = report.months.find((month) => month.id === '2026-10');
    const slice = october?.weeks.find((item) => item.id.startsWith('2026-10-05'));
    expect(slice?.money.paidCents).toBe(8999 + 4999 + 3000);
    expect(slice?.money.depositsMatchedCents).toBe(16998);
    const snap = rangeSnapshot([
      job({
        id: 'wo-08',
        invoiceCents: null,
        events: [{ id: 'p8', workOrderId: 'wo-08', at: '2026-10-05T00:00:00.000Z', kind: 'payment', cents: 8999, method: 'card' }],
      }),
    ], week.start, week.end, ZONE);
    expect(snap.paidCents).toBe(8999);
  });

  it('keeps AR and customer credit apart', () => {
    const report = buildShopYear({
      year: 2026,
      timeZone: ZONE,
      invoices: [{ workOrderId: 'open-ar', at: '2026-10-06T16:00:00.000Z', cents: 3799 }],
      payments: [{ id: 'seed', workOrderId: 'seeded', at: '2026-10-05T00:00:00.000Z', cents: 52493, method: 'card' }],
      fixtray: [],
      deposits: [],
      missingDeposits: [],
      parts: [],
      purchases: [],
      staffPunches: [],
      workPunches: [],
    });
    expect(report.totals.money.unpaidCents).toBe(3799);
    expect(report.totals.money.customerCreditCents).toBe(52493);
    const october = report.months.find((month) => month.id === '2026-10');
    expect(october?.money.unpaidCents).toBe(3799);
    expect(october?.money.customerCreditCents).toBe(52493);
    const facts = [
      job({ id: 'open-ar', invoiceCents: 3799, events: [{ id: 'inv', workOrderId: 'open-ar', at: '2026-10-06T16:00:00.000Z', kind: 'invoice', cents: 3799 }] }),
      job({ id: 'seeded', invoiceCents: null, events: [{ id: 'pay', workOrderId: 'seeded', at: '2026-10-05T00:00:00.000Z', kind: 'payment', cents: 52493, method: 'card' }] }),
    ];
    const positions = facts.map(positionJob);
    expect(positions.reduce((sum, row) => sum + row.arCents, 0)).toBe(3799);
    expect(positions.reduce((sum, row) => sum + row.customerCreditCents, 0)).toBe(52493);
  });

  it('uses shop payments for job profit and tech revenue, and inventory cost for parts', () => {
    expect(partsCostFromUsage({
      partsUsed: [{ id: 'filter', quantity: 2 }],
      catalog: [{ id: 'filter', costCents: 450 }],
    })).toBe(900);
    const revenue = allocateTechRevenue([
      { techId: 'tony', cents: 8999 },
      { techId: 'tony', cents: 4999 },
      { techId: 'maria', cents: 0 },
    ]);
    expect(revenue.find((row) => row.techId === 'tony')?.revenueCents).toBe(13998);
    expect(revenue.find((row) => row.techId === 'maria')?.revenueCents).toBe(0);
    expect(revenue.reduce((sum, row) => sum + row.revenueCents, 0)).not.toBe(61492 + 3799);
  });

  it('uses open AR for what is still owed and does not count a completed job as open', () => {
    const facts = [
      job({ id: 'real', invoiceCents: 3799, events: [{ id: 'inv', workOrderId: 'real', at: AT, kind: 'invoice', cents: 3799 }] }),
      job({ id: 'seed', invoiceCents: null, events: [{ id: 'pay', workOrderId: 'seed', at: AT, kind: 'payment', cents: 13500, method: 'cash' }] }),
    ];
    const outstanding = facts.map(positionJob).reduce((sum, row) => sum + row.arCents, 0);
    expect(outstanding).toBe(3799);
    expect(isStillOpenStatus('completed')).toBe(false);
    expect(isStillOpenStatus('closed')).toBe(false);
    expect(isStillOpenStatus('in-progress')).toBe(true);
  });

  it('applies an earlier deposit to a job paid off later and does not leave that job unpaid', () => {
    const report = buildShopYear({
      year: 2026,
      timeZone: ZONE,
      invoices: [
        { workOrderId: 'wo-09', at: '2026-10-06T16:00:00.000Z', cents: 4999 },
        { workOrderId: 'other', at: '2026-10-06T16:00:00.000Z', cents: 3799 },
      ],
      payments: [
        { id: 'dep-pay', workOrderId: 'wo-09', at: '2026-10-05T00:00:00.000Z', cents: 3000, method: 'cash' },
        { id: 'rest', workOrderId: 'wo-09', at: '2026-10-06T16:00:00.000Z', cents: 1999, method: 'cash' },
      ],
      fixtray: [],
      deposits: [{ id: 'd', workOrderId: 'wo-09', at: '2026-10-05T00:00:00.000Z', cents: 3000, matched: false }],
      missingDeposits: [],
      parts: [],
      purchases: [],
      staffPunches: [],
      workPunches: [],
    });
    const october = report.months.find((month) => month.id === '2026-10');
    const slice = october?.weeks.find((item) => item.id.startsWith('2026-10-05'));
    const sixth = slice?.days.find((day) => day.id === '2026-10-06');
    expect(slice?.money.paidCents).toBe(4999);
    expect(sixth?.money.unpaidCents).toBe(3799);
    expect(report.totals.money.unpaidCents).toBe(3799);
    const balance = jobBalance({ invoiceCents: 4999, paidCents: 4999, refundCents: 0, chargebackCents: 0, depositCents: 3000 });
    expect(balance.arCents).toBe(0);
    const planned = planInPersonPayment({
      workOrderId: 'wo-09',
      shopId: 'shop',
      jobCents: 4999,
      alreadyReceivedCents: 3000,
      tenderedCents: 1999,
      savedFeeCents: 1000,
      customerFacingFeeCents: customerFacingServiceFeeCents(4999, 1000),
      method: 'cash',
      feeAlreadyRecorded: false,
      actorId: 'owner',
      at: '2026-10-06T16:00:00.000Z',
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const deposit = planned.entries.find((entry) => entry.kind === 'deposit');
    expect(deposit?.amountCents).toBe(4999);
    const rows: BooksRow[] = [
      { id: 'prior', workOrderId: 'wo-09', kind: 'job_payment', appliesTo: 'job', amountCents: 3000, createdAt: '2026-10-05T00:00:00.000Z' },
      { id: 'old', workOrderId: 'wo-09', kind: 'deposit', appliesTo: 'job', amountCents: 3000, depositAt: '2026-10-05T00:00:00.000Z', createdAt: '2026-10-05T00:00:00.000Z' },
      ...planned.entries.map((entry, index) => ({
        id: `new-${index}`,
        workOrderId: 'wo-09',
        kind: entry.kind,
        appliesTo: entry.appliesTo,
        amountCents: entry.amountCents,
        depositAt: entry.depositAt,
        createdAt: '2026-10-06T16:00:00.000Z',
      })),
    ];
    const [assembled] = assembleShopJobs(
      [{ id: 'wo-09', shopId: 'shop', estimatedCost: 49.99, amountPaid: 49.99, paymentStatus: 'paid', createdAt: '2026-10-06T16:00:00.000Z' }],
      rows,
    );
    expect(monthClose([assembled]).unmatchedDeposits.map((issue) => issue.reason)).not.toContain('deposit_amount_mismatch');
  });

  it('states cash-basis income as Books revenue and shows a balancing sheet', () => {
    const facts = [
      job({
        id: 'open-ar',
        invoiceCents: 3799,
        events: [{ id: 'inv', workOrderId: 'open-ar', at: '2026-10-06T15:00:00.000Z', kind: 'invoice', cents: 3799 }],
      }),
      job({
        id: 'collected',
        invoiceCents: null,
        events: [{ id: 'pay', workOrderId: 'collected', at: '2026-10-05T00:00:00.000Z', kind: 'payment', cents: 21997, method: 'card' }],
      }),
    ];
    const span = { start: shopDayRange('2026-10-01', ZONE).start, end: shopDayRange('2026-10-06', ZONE).end };
    const books = rangeSnapshot(facts, span.start, span.end, ZONE);
    const cash = cashBasisIncome({ revenueCents: books.revenueCents, cogsCents: 0, payrollCents: 0, shopSuppliesCents: 0 });
    expect(cash.basis).toBe('cash');
    expect(cash.revenueCents).toBe(books.revenueCents);
    expect(cash.revenueCents).toBe(21997);
    expect(cash.netIncomeCents).toBe(21997);
    expect(cash.netIncomeCents).not.toBe(books.invoicedCents);
    const entries = journalForFacts(facts, new Date('2000-01-01T00:00:00.000Z'), span.end, { ratePercent: 0, laborTaxable: false, partsTaxable: false }, ZONE);
    entries.push(postInventoryAdjustment({ id: 'stock', date: '2026-10-06', amountCents: 5000, direction: 'increase' }));
    const sheet = balanceSheetView(entries);
    expect(sheet.lines.map((line) => line.key)).toEqual(expect.arrayContaining(['undeposited', 'bank', 'ar', 'inventory', 'credit', 'equity']));
    expect(sheet.lines.find((line) => line.key === 'undeposited')?.cents).toBeGreaterThan(0);
    expect(sheet.lines.find((line) => line.key === 'inventory')?.cents).toBe(5000);
    expect(sheet.balanced).toBe(true);
    expect(sheet.assetsCents).toBe(sheet.liabilitiesCents + sheet.equityCents);
  });

  it('keeps the customer, vehicle, and tech when a complete response has none', () => {
    const previous = {
      id: 'wo-09',
      status: 'in-progress',
      customerId: 'cust-1',
      vehicleId: 'veh-1',
      assignedTechId: 'tech-1',
      customer: { firstName: 'Week', lastName: 'Sim' },
      vehicle: { make: 'Ford', model: 'F-150' },
      assignedTo: { firstName: 'Tony', lastName: 'Tech' },
    };
    const next = mergeWorkOrderView(previous, {
      id: 'wo-09',
      status: 'completed',
      paymentStatus: 'paid',
      customer: null,
      vehicle: null,
      assignedTo: null,
    });
    expect(next?.customer).toEqual(previous.customer);
    expect(next?.vehicle).toEqual(previous.vehicle);
    expect(next?.assignedTo).toEqual(previous.assignedTo);
    expect(next?.customerId).toBe('cust-1');
    const closeout = fs.readFileSync(path.join(process.cwd(), 'src/app/api/workorders/[id]/closeout/route.ts'), 'utf8');
    expect(closeout).not.toMatch(/customerId:\s*null/);
    expect(closeout).not.toMatch(/assignedTechId:\s*null/);
    expect(closeout).toContain('completedAt: new Date()');
  });

  it('owes the gross-up on the full job, not the cash remainder', () => {
    const jobCents = 4999;
    const platformNetCents = 1000;
    const cashPortionCents = 1999;
    const fee = customerFacingServiceFeeCents(jobCents, platformNetCents);
    const line = owedFeeBreakdown({
      jobCents,
      platformNetCents,
      storedFeeCents: fee,
      cashPortionCents,
    });
    expect(fee).toBe(1210);
    expect(line.matchesFullJob).toBe(true);
    expect(line.customerFeeCents).toBe(customerFacingServiceFeeCents(line.jobCents, line.platformNetCents));
    expect(line.jobCents).toBe(4999);
    expect(line.cashPortionFeeCents).not.toBe(line.customerFeeCents);
    const screen = fs.readFileSync(path.join(process.cwd(), 'src/components/ShopBooksScreen.tsx'), 'utf8');
    expect(screen).toContain('gross-up on the full job');
    const columns = fs.readFileSync(path.join(process.cwd(), 'src/lib/ensureProductionColumns.ts'), 'utf8');
    expect(columns).toContain("NEXT_PHASE === 'phase-production-build'");
  });
});
