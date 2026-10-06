import fs from 'fs';
import path from 'path';
import { customerFacingServiceFeeCents } from '../src/lib/serviceFeeBill';
import {
  assembleShopJobs,
  counterBalanceDueCents,
  depositLinesUp,
  hideManagerShopRevenue,
  monthClose,
  planInPersonPayment,
  shopLedger,
  shopReport,
  type ShopJob,
} from '../src/lib/books/money';
import { jobBalance, positionJob, rangeSnapshot, type ShopJobFacts } from '../src/lib/books/truth';
import { bankDepositEvents, buildShopStatement } from '../src/lib/books/statements';
import { partsSellCents, taxForInvoice } from '../src/lib/books/shopTax';
import {
  analyticsPerformance,
  closedJobLaborMinutes,
  closedPayrollGrossCents,
  inventoryOnHandValueCents,
  jobProfit,
  partsCostFromUsage,
  receiveInventory,
} from '../src/lib/books/floor';
import { booksAccess } from '../src/lib/books/access';
import { workOrderUpdateSchema } from '../src/lib/validationSchemas';
import { zonedDayStart } from '../src/lib/books/periods';

const ZONE = 'America/New_York';
const FROM = zonedDayStart('2026-01-01', ZONE);
const TO = zonedDayStart('2027-01-01', ZONE);

function pay(id: string, workOrderId: string, at: string, cents: number, method: 'cash' | 'card' = 'cash') {
  return { id, workOrderId, at, kind: 'payment' as const, cents, method };
}

describe('retest a740b24 ground truth', () => {
  const e2eId = 'cmuwty89u0016p69ns0z3yknk';
  const jobs: ShopJobFacts[] = [
    {
      id: 'sep',
      status: 'closed',
      invoiceCents: 30496,
      invoiceAt: '2026-09-30T16:00:00.000Z',
      invoiceRecorded: true,
      completedAt: '2026-09-30T16:00:00.000Z',
      events: [
        { id: 'inv-sep', workOrderId: 'sep', at: '2026-09-30T16:00:00.000Z', kind: 'invoice', cents: 30496 },
        pay('p-sep', 'sep', '2026-09-30T16:00:00.000Z', 30496, 'card'),
      ],
    },
    {
      id: 'early-oct',
      status: 'closed',
      invoiceCents: 21997,
      invoiceAt: '2026-10-02T16:00:00.000Z',
      invoiceRecorded: true,
      completedAt: '2026-10-02T16:00:00.000Z',
      events: [
        { id: 'inv-oct', workOrderId: 'early-oct', at: '2026-10-02T16:00:00.000Z', kind: 'invoice', cents: 21997 },
        pay('p-oct', 'early-oct', '2026-10-02T16:00:00.000Z', 21997, 'card'),
      ],
    },
    {
      id: 'wo-09',
      status: 'completed',
      invoiceCents: 1999,
      invoiceAt: '2026-10-06T15:00:00.000Z',
      invoiceRecorded: true,
      completedAt: '2026-10-06T16:00:00.000Z',
      events: [
        { id: 'inv-09', workOrderId: 'wo-09', at: '2026-10-06T15:00:00.000Z', kind: 'invoice', cents: 1999 },
        pay('p-09', 'wo-09', '2026-10-06T16:00:00.000Z', 1999),
      ],
    },
    {
      id: e2eId,
      status: 'completed',
      invoiceCents: 6298,
      invoiceAt: '2026-10-06T15:26:00.000Z',
      invoiceRecorded: false,
      completedAt: '2026-10-06T16:00:00.000Z',
      partsSellCents: 1299,
      salesTax: {
        ratePercent: 8,
        laborTaxable: true,
        partsTaxable: true,
        laborCents: 6298,
        partsCents: 0,
        taxCents: 504,
        frozenAt: '2026-10-06T15:26:00.000Z',
      },
      events: [
        { id: 'inv-e2e', workOrderId: e2eId, at: '2026-10-06T15:26:00.000Z', kind: 'invoice', cents: 6298 },
        pay('p-e2e-a', e2eId, '2026-10-06T15:27:00.000Z', 2000),
        pay('p-e2e-b', e2eId, '2026-10-06T15:27:30.000Z', 4298),
        { id: 'd1', workOrderId: e2eId, at: '2026-10-06T15:27:00.000Z', kind: 'deposit', cents: 2000, note: 'in-person cash; shop receipt 2000 cents' },
        { id: 'd2', workOrderId: e2eId, at: '2026-10-06T15:27:30.000Z', kind: 'deposit', cents: 6298, note: 'in-person cash; shop receipt 6298 cents' },
      ],
    },
    {
      id: 'wo-05',
      status: 'waiting-for-payment',
      invoiceCents: 2499,
      invoiceAt: '2026-10-03T16:00:00.000Z',
      invoiceRecorded: false,
      events: [{ id: 'inv-05', workOrderId: 'wo-05', at: '2026-10-03T16:00:00.000Z', kind: 'invoice', cents: 2499 }],
    },
    {
      id: 'wo-07',
      status: 'waiting-for-payment',
      invoiceCents: 8999,
      invoiceAt: '2026-10-04T16:00:00.000Z',
      invoiceRecorded: false,
      events: [{ id: 'inv-07', workOrderId: 'wo-07', at: '2026-10-04T16:00:00.000Z', kind: 'invoice', cents: 8999 }],
    },
    {
      id: 'cmuvrc6aq',
      status: 'waiting-for-payment',
      invoiceCents: 3799,
      invoiceAt: '2026-10-01T16:00:00.000Z',
      invoiceRecorded: false,
      salesTax: null,
      events: [{ id: 'inv-cmu', workOrderId: 'cmuvrc6aq', at: '2026-10-01T16:00:00.000Z', kind: 'invoice', cents: 3799 }],
    },
    {
      id: 'estimate',
      status: 'estimate-submitted',
      invoiceCents: null,
      events: [],
    },
    {
      id: 'walk-in',
      status: 'pending',
      invoiceCents: null,
      events: [{ id: 'walk', workOrderId: 'walk-in', at: '2026-09-29T16:00:00.000Z', kind: 'deposit', cents: 4850, note: null }],
    },
  ];

  const partsCost = [
    { id: 'cogs-seed', workOrderId: 'sep', at: '2026-09-30T16:00:00.000Z', cents: 16380 },
    { id: 'cogs-e2e', workOrderId: e2eId, at: '2026-10-06T16:00:00.000Z', cents: 450 },
  ];
  const payroll = [
    { id: 'pay-tony', personId: 'tony', at: '2026-10-05T21:00:00.000Z', cents: 142625 },
    { id: 'pay-maria', personId: 'maria', at: '2026-10-05T21:00:00.000Z', cents: 86100 },
  ];

  const statementInput = {
    jobs,
    timeZone: ZONE,
    from: FROM,
    to: TO,
    partsCost,
    payroll,
    bills: [
      { id: 'bill-1', at: '2026-10-06T15:00:00.000Z', cents: 4500, toInventory: true },
      { id: 'bill-2', at: '2026-10-06T15:00:00.000Z', cents: 1700, toInventory: true },
    ],
    billPayments: [{ id: 'bill-pay', at: '2026-10-06T15:10:00.000Z', cents: 1700 }],
    bankDeposits: [{ id: 'bank-week', at: '2026-10-04T16:00:00.000Z', cents: 52493 }],
    collectedTax: [] as Array<{ id: string; workOrderId: string; at: string; cents: number }>,
    inventoryValueCents: 23840,
  };
  const statement = buildShopStatement(statementInput);

  it('1. stores each payment, and a running-total deposit is not credit', () => {
    const planned = planInPersonPayment({
      workOrderId: e2eId,
      shopId: 'shop',
      jobCents: 6298,
      alreadyReceivedCents: 2000,
      tenderedCents: 4298,
      savedFeeCents: 1000,
      customerFacingFeeCents: 1249,
      method: 'cash',
      feeAlreadyRecorded: false,
      actorId: 'owner',
      at: '2026-10-06T15:27:30.000Z',
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const deposit = planned.entries.find((entry) => entry.kind === 'deposit');
    const jobPay = planned.entries.find((entry) => entry.kind === 'job_payment' && entry.appliesTo === 'job');
    expect(jobPay?.amountCents).toBe(4298);
    expect(deposit?.amountCents).toBe(4298);
    const balance = jobBalance({ invoiceCents: 6298, paidCents: 6298, refundCents: 0, chargebackCents: 0, depositCents: 2000 + 6298 });
    expect(balance.customerCreditCents).toBe(0);
    expect(balance.arCents).toBe(0);
    expect(positionJob(jobs.find((job) => job.id === e2eId) as ShopJobFacts).customerCreditCents).toBe(0);
  });

  it('2. does not turn a paid job or a walk-in deposit into customer credit', () => {
    expect(statement.customerCreditCents).toBe(0);
    expect(statement.asOf.customerCreditCents).toBe(0);
    expect(positionJob(jobs.find((job) => job.id === 'walk-in') as ShopJobFacts).customerCreditCents).toBe(0);
  });

  it('3. keeps the same accounts receivable, with no unbilled tax, on every report', () => {
    const year = rangeSnapshot(jobs, FROM, TO, ZONE);
    expect(year.arCents).toBe(15297);
    expect(statement.arCents).toBe(15297);
    expect(statement.asOf.arCents).toBe(15297);
    expect(statement.sheet.lines.find((line) => line.key === 'ar')?.cents).toBe(15297);
    const day = rangeSnapshot(jobs, zonedDayStart('2026-10-06', ZONE), zonedDayStart('2026-10-07', ZONE), ZONE);
    expect(day.paidCents).toBe(8297);
    expect(day.arCents).toBe(15297);
    const daySheet = buildShopStatement({ ...statementInput, from: zonedDayStart('2026-10-06', ZONE), to: zonedDayStart('2026-10-07', ZONE) });
    const weekSheet = buildShopStatement({ ...statementInput, from: zonedDayStart('2026-10-05', ZONE), to: zonedDayStart('2026-10-12', ZONE) });
    expect(daySheet.arCents).toBe(15297);
    expect(weekSheet.arCents).toBe(15297);
  });

  it('4. accepts the full counter balance and keeps the fee off shop revenue', () => {
    const fee = customerFacingServiceFeeCents(6298, 1000);
    expect(fee).toBe(1249);
    const due = counterBalanceDueCents({ jobCents: 6298, alreadyReceivedCents: 0, feeCents: fee, taxCents: 504 });
    expect(due.dueCents).toBe(6298 + 1249 + 504);
    const planned = planInPersonPayment({
      workOrderId: e2eId,
      jobCents: 6298,
      alreadyReceivedCents: 0,
      tenderedCents: due.dueCents,
      savedFeeCents: 1000,
      customerFacingFeeCents: fee,
      taxCents: 504,
      method: 'cash',
      feeAlreadyRecorded: false,
      actorId: 'owner',
      at: '2026-10-06T15:27:00.000Z',
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.shopReceivedCents).toBe(6298);
    expect(planned.platformFeeCents).toBe(1249);
    expect(planned.taxCollectedCents).toBe(504);
    expect(planned.entries.find((entry) => entry.kind === 'deposit')?.amountCents).toBe(6298);
    const payRoute = fs.readFileSync(path.join(process.cwd(), 'src/app/api/workorders/[id]/pay/route.ts'), 'utf8');
    expect(payRoute).toContain("status: 'paid'");
  });

  it('5. taxes parts from unitPrice and does not re-tax an invoice that has no snapshot', () => {
    expect(partsSellCents([{ name: 'Oil Filter Standard', unitPrice: 12.99, quantity: 1 }])).toBe(1299);
    const historical = taxForInvoice({
      invoiceCents: 3799,
      partsSellCents: 0,
      settings: { ratePercent: 8, laborTaxable: true, partsTaxable: true },
      frozen: null,
    });
    expect(historical.taxCents).toBe(0);
    const frozen = taxForInvoice({
      invoiceCents: 6298,
      partsSellCents: 0,
      settings: { ratePercent: 8, laborTaxable: true, partsTaxable: true },
      frozen: jobs.find((job) => job.id === e2eId)?.salesTax,
    });
    expect(frozen.taxCents).toBe(504);
    expect(statement.asOf.salesTaxCents).toBe(0);
  });

  it('6. posts cost of parts sold and keeps each item unit cost', () => {
    expect(partsCostFromUsage({
      partsUsed: [{ inventoryStockId: 'weeksim-inv-filter-20261005', quantity: 1 }],
      catalog: [{ id: 'weeksim-inv-filter-20261005', costCents: 450 }],
    })).toBe(450);
    expect(statement.asOf.cogsCents).toBe(16830);
    const received = receiveInventory({ onHand: 9, unitCostCents: 200, qty: 10, billUnitCostCents: 450 });
    expect(received.unitCostCents).toBe(200);
    expect(received.qty).toBe(19);
  });

  it('7. uses the tech pay rate times clocked hours on the job', () => {
    const minutes = closedJobLaborMinutes([
      { clockIn: '2026-10-06T12:00:00.000Z', clockOut: '2026-10-06T15:51:00.000Z', hoursSpent: 3.85 },
      { clockIn: '2026-10-06T18:00:00.000Z', clockOut: null, hoursSpent: 5 },
    ]);
    expect(minutes).toBe(231);
    const profit = jobProfit({
      workOrderId: 'year',
      revenueCents: 60790,
      partsCostCents: 16830,
      laborMinutes: minutes,
      hourlyRateCents: 6000,
    });
    expect(profit.laborCostCents).toBe(23100);
    expect(profit.profitCents).toBe(20860);
  });

  it('8. posts closed timesheet wages and ignores an open clock-in', () => {
    const gross = closedPayrollGrossCents([
      { clockOut: '2026-10-05T21:00:00.000Z', hoursWorked: 2287.25, hourlyRate: 1 },
      { clockOut: null, hoursWorked: 17.96, hourlyRate: 20 },
    ]);
    expect(gross).toBe(228725);
    expect(statement.asOf.payrollCents).toBe(228725);
    expect(statement.asOf.wagesPayableCents).toBe(228725);
    const eod = fs.readFileSync(path.join(process.cwd(), 'src/app/api/shop/eod-report/route.ts'), 'utf8');
    expect(eod).toContain('clockOut: { not: null }');
  });

  it('9. posts bills, bill payments, and the bank deposit', () => {
    expect(statement.asOf.apCents).toBe(4500);
    expect(statement.asOf.undepositedCents).toBe(8297);
    expect(statement.asOf.bankCents).toBe(52493 - 1700);
    expect(statement.sheet.lines.find((line) => line.key === 'ap')?.cents).toBe(4500);
    const seeded = jobs.map((job) => job.id === 'sep' || job.id === 'early-oct'
      ? {
        ...job,
        events: [
          ...job.events,
          { id: `bank-${job.id}`, workOrderId: job.id, at: job.invoiceAt || '2026-10-04T16:00:00.000Z', kind: 'deposit' as const, cents: job.invoiceCents || 0, note: null },
        ],
      }
      : job);
    const derived = bankDepositEvents(seeded);
    expect(derived.reduce((sum, row) => sum + row.cents, 0)).toBe(30496 + 21997);
    expect(derived.some((row) => row.id === 'walk' || row.id === 'd1' || row.id === 'd2')).toBe(false);
    const fromRows = buildShopStatement({
      ...statementInput,
      jobs: seeded,
      bankDeposits: derived,
    });
    expect(fromRows.asOf.undepositedCents).toBe(8297);
    expect(fromRows.asOf.bankCents).toBe(52493 - 1700);
    expect(fromRows.sheet.balanced).toBe(true);
  });

  it('10. values inventory at its own unit cost and ties net income to retained earnings', () => {
    expect(inventoryOnHandValueCents([{ quantity: 18, unitCostCents: 450 }, { quantity: 25, unitCostCents: 628 }])).not.toBe(23840);
    expect(statement.asOf.inventoryCents).toBe(23840);
    expect(statement.sheet.lines.find((line) => line.key === 'inventory')?.cents).toBe(23840);
    expect(statement.asOf.openingBalanceEquityCents).toBe(23840 - 6200 + 16830);
    expect(statement.sheet.lines.find((line) => line.key === 'equity')?.cents).toBe(0);
    expect(statement.asOf.retainedEarningsCents).toBe(statement.asOf.netIncomeCents);
    expect(statement.sheet.lines.find((line) => line.key === 'retained')?.cents).toBe(statement.asOf.netIncomeCents);
    expect(statement.trial.balanced).toBe(true);
    expect(statement.trial.debitCents).toBe(statement.trial.creditCents);
    expect(statement.sheet.balanced).toBe(true);
    expect(statement.sheet.assetsCents).toBe(statement.sheet.liabilitiesCents + statement.sheet.equityCents);
  });

  it('11. counts completed and paid jobs the way Books does', () => {
    const rows = [
      ...Array.from({ length: 7 }, (_, index) => ({ status: 'closed', techName: 'Tony', paidCents: index === 0 ? 46993 : 0 })),
      { status: 'completed', techName: 'Tony', paidCents: 1999 },
      { status: 'completed', techName: 'Tony', paidCents: 11798 },
    ];
    const chart = analyticsPerformance(rows);
    expect(chart.completedJobs).toBe(9);
    expect(chart.paidCents).toBe(60790);
    expect(chart.byTech[0]).toEqual({ techName: 'Tony', jobs: 9, paidCents: 60790 });
    const analytics = fs.readFileSync(path.join(process.cwd(), 'src/app/api/analytics/route.ts'), 'utf8');
    expect(analytics).toContain('analyticsPerformance');
    expect(analytics).toContain("wo.status === 'closed' || wo.status === 'completed'");
  });

  it('12. leaves estimates out of unpaid and accounts receivable', () => {
    const ledgerJobs: ShopJob[] = [
      { id: 'wo-05', shopId: 's', status: 'waiting-for-payment', jobCents: 2499, customerPaidJobCents: 0, shopReceivedCents: 0, platformFeeCents: 0, cardJobCents: 0, depositCents: null, depositAt: null, openReversalIds: [], standing: 'unpaid' },
      { id: 'wo-07', shopId: 's', status: 'waiting-for-payment', jobCents: 8999, customerPaidJobCents: 0, shopReceivedCents: 0, platformFeeCents: 0, cardJobCents: 0, depositCents: null, depositAt: null, openReversalIds: [], standing: 'unpaid' },
      { id: 'cmu', shopId: 's', status: 'waiting-for-payment', jobCents: 3799, customerPaidJobCents: 0, shopReceivedCents: 0, platformFeeCents: 0, cardJobCents: 0, depositCents: null, depositAt: null, openReversalIds: [], standing: 'unpaid' },
      { id: 'est', shopId: 's', status: 'estimate-submitted', jobCents: 42145, customerPaidJobCents: 0, shopReceivedCents: 0, platformFeeCents: 0, cardJobCents: 0, depositCents: null, depositAt: null, openReversalIds: [], standing: 'unpaid' },
    ];
    const ledger = shopLedger(ledgerJobs);
    expect(shopReport(ledger).unpaidCents).toBe(15297);
    expect(shopReport(ledger).unpaidCents).not.toBe(57442);
  });

  it('13. keeps shop revenue off the manager books payload', () => {
    expect(booksAccess('manager').shopRevenue).toBe(false);
    expect(booksAccess('shop').shopRevenue).toBe(true);
    expect(booksAccess('accountant').shopRevenue).toBe(true);
    const hidden = hideManagerShopRevenue({
      shopReceivedUsd: 544.92,
      report: {
        customerPaidJobCents: 54492,
        shopReceivedCents: 54492,
        shopTotalCents: 54492,
        unpaidCents: 3799,
        partialCents: 0,
        paidCents: 54492,
        platformFeeCents: 1210,
        feeDeductedFromShop: false as const,
      },
      ledger: shopLedger([{
        id: 'job',
        shopId: 's',
        status: 'completed',
        jobCents: 54492,
        customerPaidJobCents: 54492,
        shopReceivedCents: 54492,
        platformFeeCents: 0,
        cardJobCents: 54492,
        depositCents: 54492,
        depositAt: '2026-10-05T00:00:00.000Z',
        openReversalIds: [],
        standing: 'paid',
      }]),
      figures: { invoicedCents: 1, paidCents: 54492, arCents: 3799, customerCreditCents: 0, revenueCents: 54492 },
    });
    expect(hidden.report.shopReceivedCents).toBe(0);
    expect(hidden.figures?.revenueCents).toBe(0);
    expect(hidden.ledger.jobs[0].shopReceivedCents).toBe(0);
    const route = fs.readFileSync(path.join(process.cwd(), 'src/app/api/shop/books/route.ts'), 'utf8');
    expect(route).toContain('hideManagerShopRevenue');
  });

  it('14. accepts the app cuid when a vehicle or tech is attached', () => {
    const parsed = workOrderUpdateSchema.safeParse({
      vehicleId: 'cmuwty89u0016p69ns0z3yknk',
      assignedTechId: 'cmuwtxmei000gp69n4d9wzk79',
    });
    expect(parsed.success).toBe(true);
  });

  it('15. writes status history when a job is created, moves, completes, and is paid', () => {
    const root = process.cwd();
    const created = fs.readFileSync(path.join(root, 'src/app/api/workorders/route.ts'), 'utf8');
    const closeout = fs.readFileSync(path.join(root, 'src/app/api/workorders/[id]/closeout/route.ts'), 'utf8');
    const decision = fs.readFileSync(path.join(root, 'src/lib/recordEstimateDecision.ts'), 'utf8');
    const pay = fs.readFileSync(path.join(root, 'src/app/api/workorders/[id]/pay/route.ts'), 'utf8');
    expect(created).toContain("toStatus: 'pending'");
    expect(decision).toContain('statusHistory.create');
    expect(closeout).toContain('recordStatusHistory');
    expect(pay).toContain("toStatus: 'paid'");
  });

  it('16. does not create the shop-accounting tables at runtime', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/lib/ensureProductionColumns.ts'), 'utf8');
    expect(source).not.toContain('CREATE TABLE IF NOT EXISTS "ledger_accounts"');
    expect(source).not.toContain('CREATE TABLE IF NOT EXISTS "journal_entries"');
    expect(source).not.toContain('CREATE TABLE IF NOT EXISTS "vendor_bills"');
    expect(source).not.toContain('CREATE TABLE IF NOT EXISTS "bank_deposits"');
    expect(source).toContain('20261006_shop_accounting');
    const migration = fs.readFileSync(path.join(process.cwd(), 'prisma/migrations/20261006_shop_accounting/migration.sql'), 'utf8');
    expect(migration).toContain('ledger_accounts');
  });

  it('matches the seeded week on every report and the journal balances', () => {
    const year = rangeSnapshot(jobs, FROM, TO, ZONE);
    expect(year.revenueCents).toBe(60790);
    expect(year.paidCents).toBe(60790);
    const october = rangeSnapshot(jobs, zonedDayStart('2026-10-01', ZONE), zonedDayStart('2026-11-01', ZONE), ZONE);
    const september = rangeSnapshot(jobs, zonedDayStart('2026-09-01', ZONE), zonedDayStart('2026-10-01', ZONE), ZONE);
    expect(september.paidCents).toBe(30496);
    expect(october.paidCents).toBe(30294);
    const week = rangeSnapshot(jobs, zonedDayStart('2026-10-05', ZONE), zonedDayStart('2026-10-12', ZONE), ZONE);
    expect(week.paidCents).toBe(8297);
    expect(statement.asOf.cogsCents).toBe(16830);
    expect(statement.arCents).toBe(15297);
    expect(statement.customerCreditCents).toBe(0);
    expect(statement.trial.debitCents).toBe(statement.trial.creditCents);
    expect(statement.sheet.assetsCents).toBe(statement.sheet.liabilitiesCents + statement.sheet.equityCents);
    expect(statement.asOf.netIncomeCents).toBe(statement.asOf.retainedEarningsCents);
  });

  it('accepts incremental deposits and still rejects a short deposit', () => {
    const [incremental] = assembleShopJobs(
      [{ id: 'job', shopId: 's', estimatedCost: 62.98, paymentStatus: 'paid', createdAt: '2026-10-06T00:00:00.000Z' }],
      [
        { id: 'p1', workOrderId: 'job', kind: 'job_payment', appliesTo: 'job', amountCents: 2000, createdAt: '2026-10-06T15:00:00.000Z' },
        { id: 'p2', workOrderId: 'job', kind: 'job_payment', appliesTo: 'job', amountCents: 4298, createdAt: '2026-10-06T16:00:00.000Z' },
        { id: 'd1', workOrderId: 'job', kind: 'deposit', appliesTo: 'job', amountCents: 2000, depositAt: '2026-10-06T15:00:00.000Z', createdAt: '2026-10-06T15:00:00.000Z' },
        { id: 'd2', workOrderId: 'job', kind: 'deposit', appliesTo: 'job', amountCents: 4298, depositAt: '2026-10-06T16:00:00.000Z', createdAt: '2026-10-06T16:00:00.000Z' },
      ],
    );
    expect(depositLinesUp(incremental).ok).toBe(true);
    const [legacy] = assembleShopJobs(
      [{ id: 'job', shopId: 's', estimatedCost: 62.98, paymentStatus: 'paid', createdAt: '2026-10-06T00:00:00.000Z' }],
      [
        { id: 'p1', workOrderId: 'job', kind: 'job_payment', appliesTo: 'job', amountCents: 2000, createdAt: '2026-10-06T15:00:00.000Z' },
        { id: 'p2', workOrderId: 'job', kind: 'job_payment', appliesTo: 'job', amountCents: 4298, createdAt: '2026-10-06T16:00:00.000Z' },
        { id: 'd1', workOrderId: 'job', kind: 'deposit', appliesTo: 'job', amountCents: 2000, depositAt: '2026-10-06T15:00:00.000Z', createdAt: '2026-10-06T15:00:00.000Z' },
        { id: 'd2', workOrderId: 'job', kind: 'deposit', appliesTo: 'job', amountCents: 6298, depositAt: '2026-10-06T16:00:00.000Z', createdAt: '2026-10-06T16:00:00.000Z' },
      ],
    );
    expect(depositLinesUp(legacy).ok).toBe(true);
    const [short] = assembleShopJobs(
      [{ id: 'job', shopId: 's', estimatedCost: 100, paymentStatus: 'paid', createdAt: '2026-10-06T00:00:00.000Z' }],
      [
        { id: 'p', workOrderId: 'job', kind: 'job_payment', appliesTo: 'job', amountCents: 10000, createdAt: '2026-10-06T15:00:00.000Z' },
        { id: 'd', workOrderId: 'job', kind: 'deposit', appliesTo: 'job', amountCents: 9000, depositAt: '2026-10-06T15:00:00.000Z', createdAt: '2026-10-06T15:00:00.000Z' },
      ],
    );
    expect(monthClose([short]).unmatchedDeposits.map((issue) => issue.reason)).toContain('deposit_amount_mismatch');
  });
});
