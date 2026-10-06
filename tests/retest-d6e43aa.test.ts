import fs from 'fs';
import path from 'path';
import { customerFacingServiceFeeCents } from '../src/lib/serviceFeeBill';
import { feeCashHeld, paidJobsWithPendingLinks, planInPersonPayment } from '../src/lib/books/money';
import { buildShopStatement } from '../src/lib/books/statements';
import { factsAsOf, positionJob, type ShopJobFacts } from '../src/lib/books/truth';
import {
  analyticsPerformance,
  assignPartReturns,
  inventoryOnHandValueCents,
  jobPartsCostCents,
  jobProfit,
  partMovementFromAudit,
} from '../src/lib/books/floor';
import { hideShopRevenue, buildShopYear } from '../src/lib/books/shopDrill';
import { workOrderLinkAllowed } from '../src/lib/workOrderOwnership';
import { zonedDayStart } from '../src/lib/books/periods';

const ZONE = 'America/New_York';
const FROM = zonedDayStart('2026-01-01', ZONE);
const TO = zonedDayStart('2027-01-01', ZONE);

function job(partial: Partial<ShopJobFacts> & { id: string; invoiceCents: number | null; at?: string; paid?: number }): ShopJobFacts {
  const at = partial.at || '2026-10-02T16:00:00.000Z';
  const events = partial.events || [
    ...(partial.invoiceCents != null ? [{ id: `inv-${partial.id}`, workOrderId: partial.id, at, kind: 'invoice' as const, cents: partial.invoiceCents }] : []),
    ...(partial.paid ? [{ id: `pay-${partial.id}`, workOrderId: partial.id, at, kind: 'payment' as const, cents: partial.paid, method: 'cash' as const }] : []),
  ];
  return {
    id: partial.id,
    status: partial.status || (partial.paid ? 'completed' : 'waiting-for-payment'),
    invoiceCents: partial.invoiceCents,
    invoiceAt: partial.invoiceCents != null ? at : null,
    invoiceRecorded: true,
    events,
  };
}

describe('retest d6e43aa ground truth', () => {
  const jobs: ShopJobFacts[] = [
    job({ id: 'sep', invoiceCents: 30496, paid: 30496, at: '2026-09-30T16:00:00.000Z' }),
    job({ id: 'early', invoiceCents: 21997, paid: 21997, at: '2026-10-02T16:00:00.000Z' }),
    job({ id: 'wo-09', invoiceCents: 1999, paid: 1999, at: '2026-10-06T15:00:00.000Z' }),
    job({ id: 'old-e2e', invoiceCents: 6298, paid: 6298, at: '2026-10-06T15:20:00.000Z' }),
    job({ id: 'new-e2e', invoiceCents: 6298, paid: 6298, at: '2026-10-06T16:19:00.000Z' }),
    job({ id: 'edge', invoiceCents: 4999, paid: 4999, at: '2026-10-06T17:00:00.000Z', status: 'waiting-for-payment' }),
    job({ id: 'wo-05', invoiceCents: 2499, at: '2026-10-03T16:00:00.000Z' }),
    job({ id: 'wo-07', invoiceCents: 8999, at: '2026-10-04T16:00:00.000Z' }),
    job({ id: 'cmu', invoiceCents: 3799, at: '2026-10-01T16:00:00.000Z' }),
  ];

  const statement = buildShopStatement({
    jobs,
    timeZone: ZONE,
    from: FROM,
    to: TO,
    partsCost: [
      { id: 'cogs-rest', workOrderId: 'sep', at: '2026-09-30T16:00:00.000Z', cents: 17280 - 2575 },
      { id: 'cogs-wo-05', workOrderId: 'wo-05', at: '2026-10-06T16:00:00.000Z', cents: 2575 },
    ],
    payroll: [{ id: 'wages', personId: 'tony', at: '2026-10-05T21:00:00.000Z', cents: 228725 }],
    bills: [
      { id: 'bill-1', at: '2026-10-06T15:00:00.000Z', cents: 4500, toInventory: true },
      { id: 'bill-2', at: '2026-10-06T15:00:00.000Z', cents: 1700, toInventory: true },
    ],
    billPayments: [{ id: 'bill-pay', at: '2026-10-06T15:10:00.000Z', cents: 1700 }],
    bankDeposits: [{ id: 'bank-week', at: '2026-10-04T16:00:00.000Z', cents: 52493 }],
    collectedTax: [{ id: 'tax', workOrderId: 'new-e2e', at: '2026-10-06T16:19:00.000Z', cents: 705 }],
    writeOffs: [{ id: 'shrink', at: '2026-10-03T16:00:00.000Z', cents: 450 }],
    feeHeld: [{ id: 'fee-new', workOrderId: 'new-e2e', at: '2026-10-06T16:19:00.000Z', cents: 1249 }],
    inventoryValueCents: 42115,
  });

  it('1. costs invoiced parts, the work-order picker, and a return', () => {
    const catalog = [{ id: 'weeksim-inv-filter-20261005', costCents: 450 }];
    expect(jobPartsCostCents({
      workOrderId: 'new-e2e',
      partsUsed: [{ inventoryItemId: 'weeksim-inv-filter-20261005', quantity: 1 }],
      catalog,
    })).toBe(450);
    const gross = jobPartsCostCents({
      workOrderId: 'wo-06',
      partsUsed: [{ inventoryStockId: 'oil', quantity: 6, costCents: 500 }],
    });
    expect(gross).toBe(3000);
    const net = jobPartsCostCents({
      workOrderId: 'wo-06',
      partsUsed: [{ inventoryStockId: 'oil', quantity: 6, costCents: 500 }],
      movements: [{ kind: 'return', qty: 1, itemId: 'oil', workOrderId: 'wo-06', unitCostCents: 425 }],
    });
    expect(net).toBe(2575);
    const parsed = partMovementFromAudit({
      action: 'parts.return',
      details: 'return delta 1; on hand 5',
      targetId: 'oil',
      targetType: 'inventory_stock',
    });
    const assigned = assignPartReturns({
      jobs: [
        { id: 'wo-06', partsUsed: [{ inventoryStockId: 'oil', quantity: 6 }] },
        { id: 'wo-05', partsUsed: [{ inventoryStockId: 'filter', quantity: 1 }] },
      ],
      movements: parsed ? [parsed] : [],
    });
    expect(assigned[0]?.workOrderId).toBe('wo-06');
    expect(statement.asOf.cogsCents).toBe(17280);
    const route = fs.readFileSync(path.join(process.cwd(), 'src/app/api/shop/accounting/route.ts'), 'utf8');
    expect(route).toContain('isInvoicedJobStatus');
    expect(route).toContain('inventoryItem.findMany');
  });

  it('2. values both inventory tables and expenses a write-off', () => {
    const onHand = inventoryOnHandValueCents([
      { quantity: 1, unitCostCents: 23840 },
      { quantity: 17, unitCostCents: 450 },
      { quantity: 25, unitCostCents: 425 },
    ]);
    expect(onHand).toBe(42115);
    expect(statement.asOf.inventoryCents).toBe(42115);
    expect(statement.sheet.lines.find((line) => line.key === 'inventory')?.cents).toBe(42115);
    expect(statement.asOf.inventoryShrinkCents).toBe(450);
    expect(statement.asOf.openingBalanceEquityCents).toBe(42115 - 6200 + 17280 + 450);
  });

  it('3. uses period net income and ties retained earnings to the change', () => {
    const yearNi = 87384 - 17280 - 450 - 228725;
    expect(statement.period.netIncomeCents).toBe(yearNi);
    expect(statement.asOf.retainedEarningsCents).toBe(yearNi);
    const dayFrom = zonedDayStart('2026-10-06', ZONE);
    const dayTo = zonedDayStart('2026-10-07', ZONE);
    const day = buildShopStatement({
      jobs,
      timeZone: ZONE,
      from: dayFrom,
      to: dayTo,
      partsCost: [
        { id: 'cogs-rest', workOrderId: 'sep', at: '2026-09-30T16:00:00.000Z', cents: 17280 - 2575 },
        { id: 'cogs-wo-05', workOrderId: 'wo-05', at: '2026-10-06T16:00:00.000Z', cents: 2575 },
      ],
      payroll: [{ id: 'wages', personId: 'tony', at: '2026-10-05T21:00:00.000Z', cents: 228725 }],
      bills: [],
      collectedTax: [],
      writeOffs: [{ id: 'shrink', at: '2026-10-03T16:00:00.000Z', cents: 450 }],
      inventoryValueCents: 42115,
    });
    const before = buildShopStatement({
      jobs,
      timeZone: ZONE,
      from: FROM,
      to: dayFrom,
      partsCost: [
        { id: 'cogs-rest', workOrderId: 'sep', at: '2026-09-30T16:00:00.000Z', cents: 17280 - 2575 },
        { id: 'cogs-wo-05', workOrderId: 'wo-05', at: '2026-10-06T16:00:00.000Z', cents: 2575 },
      ],
      payroll: [{ id: 'wages', personId: 'tony', at: '2026-10-05T21:00:00.000Z', cents: 228725 }],
      writeOffs: [{ id: 'shrink', at: '2026-10-03T16:00:00.000Z', cents: 450 }],
      inventoryValueCents: 42115,
    });
    expect(day.period.netIncomeCents).toBe(19594 - 2575);
    expect(day.period.netIncomeCents).not.toBe(day.asOf.retainedEarningsCents);
    expect(day.asOf.retainedEarningsCents - before.asOf.retainedEarningsCents).toBe(day.period.netIncomeCents);
  });

  it('4. raises job profit when a part is returned', () => {
    const parts = jobPartsCostCents({
      workOrderId: 'wo-06',
      partsUsed: [{ inventoryStockId: 'oil', quantity: 6, costCents: 500 }],
      movements: [{ kind: 'return', qty: 1, itemId: 'oil', workOrderId: 'wo-06', unitCostCents: 425 }],
    });
    const profit = jobProfit({
      workOrderId: 'paid',
      revenueCents: 72087,
      partsCostCents: 17280 - 425 + (parts - 2575),
      laborMinutes: 0,
      hourlyRateCents: 2800,
    });
    expect(parts).toBe(2575);
    expect(profit.partsCostCents).toBe(17280 - 425);
  });

  it('5. gives the tech every payment, including a job that is not completed', () => {
    const chart = analyticsPerformance([
      { status: 'closed', techName: 'Tony', paidCents: 58290 },
      { status: 'completed', techName: 'Tony', paidCents: 6298 },
      { status: 'waiting-for-payment', techName: 'Tony', paidCents: 4999 },
      { status: 'completed', techName: 'Tony', paidCents: 2500 },
    ]);
    expect(chart.completedJobs).toBe(3);
    expect(chart.paidCents).toBe(72087);
    expect(chart.byTech[0].paidCents).toBe(72087);
    const analytics = fs.readFileSync(path.join(process.cwd(), 'src/app/api/analytics/route.ts'), 'utf8');
    expect(analytics).toContain('paidJobCount');
  });

  it('6. rejects another payment when nothing is unpaid', () => {
    const extra = planInPersonPayment({
      workOrderId: 'paid',
      jobCents: 4999,
      alreadyReceivedCents: 4999,
      tenderedCents: 200,
      savedFeeCents: 1000,
      customerFacingFeeCents: 1210,
      taxCents: 400,
      taxAlreadyCollectedCents: 400,
      method: 'cash',
      feeAlreadyRecorded: true,
      actorId: 'owner',
      at: '2026-10-06T18:00:00.000Z',
    });
    expect(extra.ok).toBe(false);
    const page = fs.readFileSync(path.join(process.cwd(), 'src/app/workorders/[id]/page.tsx'), 'utf8');
    expect(page).toContain("wo.paymentStatus === 'paid'");
  });

  it('7. leaves a partial tender unpaid and does not book the fee', () => {
    const fee = customerFacingServiceFeeCents(4999, 1000);
    expect(fee).toBe(1210);
    const planned = planInPersonPayment({
      workOrderId: 'edge',
      jobCents: 4999,
      alreadyReceivedCents: 0,
      tenderedCents: 5200,
      savedFeeCents: 1000,
      customerFacingFeeCents: fee,
      taxCents: 400,
      method: 'cash',
      feeAlreadyRecorded: false,
      actorId: 'owner',
      at: '2026-10-06T18:00:00.000Z',
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.paymentStatus).toBe('pending');
    expect(planned.shopReceivedCents).toBe(4999);
    expect(planned.taxCollectedCents).toBe(201);
    expect(planned.feeCollectedCents).toBe(0);
    expect(planned.platformFeeCents).toBe(0);
    expect(planned.entries.find((entry) => entry.appliesTo === 'fee')).toBeUndefined();
  });

  it('8. puts collected fee cash on the balance sheet and ignores an uncollected fee', () => {
    expect(statement.asOf.undepositedCents).toBe(72087 + 705 + 1249 - 52493);
    expect(statement.asOf.dueToPlatformCents).toBe(1249);
    expect(statement.sheet.lines.find((line) => line.key === 'dueToPlatform')?.cents).toBe(1249);
    expect(feeCashHeld({
      feeCents: 1249,
      jobPaidCents: 6298,
      taxCollectedCents: 504,
      linkStatus: 'paid',
      linkAmountCents: 8051,
      note: 'in-person cash; platform fee; fee cash collected 1249 cents; not a shop expense',
    })).toBe(1249);
    expect(feeCashHeld({
      feeCents: 1210,
      jobPaidCents: 1999,
      taxCollectedCents: 0,
      linkStatus: 'paid',
      linkAmountCents: 3209,
    })).toBe(0);
    expect(feeCashHeld({
      feeCents: 1210,
      jobPaidCents: 4999,
      taxCollectedCents: 201,
      linkStatus: 'paid',
      linkAmountCents: 6609,
    })).toBe(0);
    expect(statement.sheet.balanced).toBe(true);
    expect(statement.trial.debitCents).toBe(statement.trial.creditCents);
    expect(statement.sheet.assetsCents).toBe(statement.sheet.liabilitiesCents + statement.sheet.equityCents);
  });

  it('10. keeps a past end-of-day from seeing a later invoice', () => {
    const withLater = [...jobs, job({ id: 'later', invoiceCents: 6298, at: '2026-10-06T16:00:00.000Z' })];
    const asOf = factsAsOf(withLater, zonedDayStart('2026-10-06', ZONE));
    const ar = asOf.reduce((sum, row) => sum + positionJob(row).arCents, 0);
    expect(ar).toBe(15297);
    const later = withLater.reduce((sum, row) => sum + positionJob(row).arCents, 0);
    expect(later).toBe(15297 + 6298);
    const eod = fs.readFileSync(path.join(process.cwd(), 'src/app/api/shop/eod-report/route.ts'), 'utf8');
    expect(eod).toContain('factsAsOf');
  });

  it('11. hides cash, deposits, and fee owed from a manager drill', () => {
    const report = buildShopYear({
      year: 2026,
      timeZone: ZONE,
      invoices: [{ workOrderId: 'wo', at: '2026-10-06T16:00:00.000Z', cents: 19594 }],
      payments: [{ id: 'p', workOrderId: 'wo', at: '2026-10-06T16:00:00.000Z', cents: 19594, method: 'cash' }],
      fixtray: [{ id: 'fee', workOrderId: 'wo', at: '2026-10-06T16:00:00.000Z', cents: 1249, kind: 'in_person' }],
      deposits: [{ id: 'd', workOrderId: 'wo', at: '2026-10-06T16:00:00.000Z', cents: 6298, matched: true }],
      missingDeposits: [],
      parts: [],
      purchases: [],
      staffPunches: [],
      workPunches: [],
    });
    const hidden = hideShopRevenue(report);
    expect(hidden.totals.money.cashCents).toBe(0);
    expect(hidden.totals.money.depositsMatchedCents).toBe(0);
    expect(hidden.totals.money.fixtrayOwedCents).toBe(0);
    expect(hidden.totals.fixtrayLines).toEqual([]);
  });

  it('12. rejects a vehicle or tech that is not this shop\'s', () => {
    expect(workOrderLinkAllowed({
      shopId: 'shop',
      customerId: 'carla',
      nextVehicleId: 'ana-car',
      vehicle: { id: 'ana-car', customerId: 'ana' },
    }).ok).toBe(false);
    expect(workOrderLinkAllowed({
      shopId: 'shop',
      customerId: 'carla',
      nextTechId: 'missing',
      tech: null,
    }).ok).toBe(false);
    expect(workOrderLinkAllowed({
      shopId: 'shop',
      customerId: 'carla',
      nextVehicleId: 'camry',
      vehicle: { id: 'camry', customerId: 'carla' },
    }).ok).toBe(true);
  });

  it('13. marks a pending invoice link paid when the shop job is already paid', () => {
    expect(paidJobsWithPendingLinks([
      { id: 'cmuwty89u0016p69ns0z3yknk', paymentStatus: 'paid', shopReceivedCents: 6298, jobCents: 6298, linkStatus: 'pending' },
      { id: 'open', paymentStatus: 'pending', shopReceivedCents: 2000, jobCents: 6298, linkStatus: 'pending' },
    ])).toEqual(['cmuwty89u0016p69ns0z3yknk']);
    const books = fs.readFileSync(path.join(process.cwd(), 'src/app/api/shop/books/route.ts'), 'utf8');
    expect(books).toContain("action === 'mark-paid-links'");
  });

  it('14. still does not create shop-accounting tables at runtime', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/lib/ensureProductionColumns.ts'), 'utf8');
    expect(source).not.toContain('CREATE TABLE IF NOT EXISTS "journal_entries"');
    expect(source).toContain('20261006_shop_accounting');
  });

  it('balances the seeded week', () => {
    expect(statement.books.paidCents).toBe(72087);
    expect(statement.books.invoicedCents).toBe(87384);
    expect(statement.arCents).toBe(15297);
    expect(statement.customerCreditCents).toBe(0);
    expect(statement.asOf.apCents).toBe(4500);
    expect(statement.asOf.bankCents).toBe(50793);
    expect(statement.asOf.salesTaxCents).toBe(705);
    expect(statement.asOf.netIncomeCents).toBe(statement.asOf.retainedEarningsCents);
    expect(statement.sheet.balanced).toBe(true);
  });
});
