import fs from 'fs';
import path from 'path';
import { customerFacingServiceFeeCents } from '../src/lib/serviceFeeBill';
import { freezeFeeSnapshot } from '../src/lib/feeSnapshot';
import { planCounterPayment } from '../src/lib/books/counterPay';
import { inPersonFeeOwed, type BooksRow, type InPersonMethod } from '../src/lib/books/money';
import { shopDayRange, shopWeekRange } from '../src/lib/books/periods';
import { arAging, positionJob, rangeSnapshot, type ShopJobFacts } from '../src/lib/books/truth';
import {
  balanceSheetBalances,
  isFeeAccountKey,
  postPartsCogs,
  postVendorBill,
  statementTotals,
  trialBalance,
} from '../src/lib/books/journal';
import { journalForFacts } from '../src/lib/books/statements';
import { invoiceTax } from '../src/lib/books/shopTax';
import { jobProfit, receiveInventory } from '../src/lib/books/floor';
import { booksAccess, shopIdForBooks } from '../src/lib/books/access';
import { portalAccessDecision } from '../src/lib/roleMenus';
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
  ];

  it('opens only this shop\'s books pages', () => {
    for (const page of allowed) expect(portalAccessDecision(page, 'accountant')).toBe('allow');
    expect(portalAccessDecision('/shop/jobs', 'accountant')).toBe('home');
    expect(portalAccessDecision('/shop/profit-margins', 'accountant')).toBe('home');
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
