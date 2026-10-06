import fs from 'fs';
import path from 'path';
import { feeCashHeld, hideManagerFeeOwed, paidJobsWithPendingLinks } from '../src/lib/books/money';
import { buildShopStatement } from '../src/lib/books/statements';
import { type ShopJobFacts } from '../src/lib/books/truth';
import {
  assignPartReturns,
  inventoryOnHandValueCents,
  jobPartsCostCents,
  partMovementFromAudit,
} from '../src/lib/books/floor';
import { buildShopYear, hideShopRevenue } from '../src/lib/books/shopDrill';
import { zonedDayStart } from '../src/lib/books/periods';

const ZONE = 'America/New_York';
const FROM = zonedDayStart('2026-01-01', ZONE);
const TO = zonedDayStart('2027-01-01', ZONE);
const FILTER = 'weeksim-inv-filter-20261005';
const WO06 = 'weeksim-week-wo-06';

function job(partial: Partial<ShopJobFacts> & { id: string; invoiceCents: number | null; at?: string; paid?: number }): ShopJobFacts {
  const at = partial.at || '2026-10-02T16:00:00.000Z';
  const events = partial.events || [
    ...(partial.invoiceCents != null ? [{ id: `inv-${partial.id}`, workOrderId: partial.id, at, kind: 'invoice' as const, cents: partial.invoiceCents }] : []),
    ...(partial.paid ? [{ id: `pay-${partial.id}`, workOrderId: partial.id, at, kind: 'payment' as const, cents: partial.paid, method: 'cash' as const }] : []),
  ];
  return {
    id: partial.id,
    status: partial.status || (partial.paid && partial.paid >= (partial.invoiceCents || 0) ? 'completed' : 'waiting-for-payment'),
    invoiceCents: partial.invoiceCents,
    invoiceAt: partial.invoiceCents != null ? at : null,
    invoiceRecorded: true,
    events,
  };
}

describe('retest a220103 ground truth', () => {
  const catalog = [{ id: FILTER, sku: 'FILTER', costCents: 450 }];
  const oilReturn = partMovementFromAudit({
    action: 'parts.return',
    details: 'return delta -1; on hand 26; reason: work order weeksim-week-wo-06',
    targetId: 'oil',
    targetType: 'inventory_stock',
  });
  const movements = assignPartReturns({
    jobs: [
      { id: WO06, partsUsed: [{ inventoryStockId: 'oil', quantity: 6, costCents: 500 }] },
      { id: 'oil-2', partsUsed: [{ inventoryStockId: 'oil', quantity: 1, costCents: 425 }] },
      { id: 'cleaner', partsUsed: [{ id: 'cleaner', quantity: 1, costCents: 930 }] },
      { id: 'e2e-a', partsUsed: [{ inventoryItemId: FILTER, quantity: 1 }] },
      { id: 'e2e-b', partsUsed: [{ inventoryItemId: FILTER, quantity: 1 }] },
      { id: 'e2e-c', partsUsed: [{ inventoryItemId: FILTER, quantity: 1 }] },
    ],
    movements: oilReturn ? [{ ...oilReturn, unitCostCents: 425 }] : [],
  });

  const filterCost = (id: string) => jobPartsCostCents({
    workOrderId: id,
    partsUsed: [{ inventoryItemId: FILTER, quantity: 1 }],
    catalog,
    movements,
  });

  const jobs: ShopJobFacts[] = [
    job({ id: 'sep', invoiceCents: 30496, paid: 30496, at: '2026-09-30T16:00:00.000Z' }),
    job({ id: 'early', invoiceCents: 21997, paid: 21997, at: '2026-10-02T16:00:00.000Z' }),
    job({ id: 'wo-09', invoiceCents: 1999, paid: 1999, at: '2026-10-06T15:00:00.000Z' }),
    job({ id: 'old-e2e', invoiceCents: 6298, paid: 6298, at: '2026-10-06T15:20:00.000Z' }),
    job({ id: 'new-e2e', invoiceCents: 6298, paid: 6298, at: '2026-10-06T16:19:00.000Z' }),
    job({ id: 'edge', invoiceCents: 4999, paid: 4999, at: '2026-10-06T17:00:00.000Z' }),
    job({ id: 'wo-05', invoiceCents: 2499, at: '2026-10-03T16:00:00.000Z' }),
    job({ id: 'wo-07', invoiceCents: 8999, at: '2026-10-04T16:00:00.000Z' }),
    job({ id: 'cmu', invoiceCents: 3799, at: '2026-10-01T16:00:00.000Z' }),
    job({ id: 'e2e-c', invoiceCents: 6298, paid: 6298, at: '2026-10-06T16:54:00.000Z' }),
    job({ id: 'partial', invoiceCents: 4999, paid: 2000, at: '2026-10-06T16:40:00.000Z' }),
  ];

  const partsCost = [
    { id: 'cogs-seed', workOrderId: 'sep', at: '2026-09-30T16:00:00.000Z', cents: 16380 },
    { id: 'cogs:e2e-a', workOrderId: 'e2e-a', at: '2026-10-06T15:20:00.000Z', cents: filterCost('e2e-a') },
    { id: 'cogs:e2e-b', workOrderId: 'e2e-b', at: '2026-10-06T16:19:00.000Z', cents: filterCost('e2e-b') },
    { id: 'cogs:e2e-c', workOrderId: 'e2e-c', at: '2026-10-06T16:54:00.000Z', cents: filterCost('e2e-c') },
  ];

  const statement = buildShopStatement({
    jobs,
    timeZone: ZONE,
    from: FROM,
    to: TO,
    partsCost,
    payroll: [{ id: 'wages', personId: 'tony', at: '2026-10-05T21:00:00.000Z', cents: 228725 }],
    bills: [
      { id: 'bill-1', at: '2026-10-06T15:00:00.000Z', cents: 4500, toInventory: true },
      { id: 'bill-2', at: '2026-10-06T15:00:00.000Z', cents: 1700, toInventory: true },
    ],
    billPayments: [{ id: 'bill-pay', at: '2026-10-06T15:10:00.000Z', cents: 1700 }],
    bankDeposits: [{ id: 'bank-week', at: '2026-10-04T16:00:00.000Z', cents: 52493 }],
    collectedTax: [
      { id: 'tax-old', workOrderId: 'new-e2e', at: '2026-10-06T16:19:00.000Z', cents: 705 },
      { id: 'tax-new', workOrderId: 'e2e-c', at: '2026-10-06T16:54:00.000Z', cents: 504 },
    ],
    writeOffs: [{ id: 'shrink', at: '2026-10-03T16:00:00.000Z', cents: 450 }],
    feeHeld: [
      { id: 'fee-old', workOrderId: 'new-e2e', at: '2026-10-06T16:19:00.000Z', cents: 1249 },
      { id: 'fee-new', workOrderId: 'e2e-c', at: '2026-10-06T16:54:00.000Z', cents: 1249 },
    ],
    inventoryValueCents: 41665,
  });

  it('reads "work order" in the audit and does not let that return zero other jobs', () => {
    expect(oilReturn?.workOrderId).toBe(WO06);
    expect(partMovementFromAudit({
      action: 'parts.return',
      details: 'return delta -1; workOrderId weeksim-week-wo-06',
      targetId: 'oil',
      targetType: 'inventory_stock',
    })?.workOrderId).toBe(WO06);
    const unassigned = partMovementFromAudit({
      action: 'parts.return',
      details: 'return delta 1; on hand 5',
      targetId: 'oil',
      targetType: 'inventory_stock',
    });
    expect(unassigned?.workOrderId).toBeNull();
    expect(jobPartsCostCents({
      workOrderId: 'e2e-c',
      partsUsed: [{ inventoryItemId: FILTER, quantity: 1 }],
      catalog,
      movements: unassigned ? [unassigned] : [],
    })).toBe(450);
    expect(jobPartsCostCents({
      workOrderId: 'oil-2',
      partsUsed: [{ inventoryStockId: 'oil', quantity: 1, costCents: 425 }],
      movements: unassigned ? [unassigned] : [],
    })).toBe(425);
    expect(filterCost('e2e-a')).toBe(450);
    expect(filterCost('e2e-b')).toBe(450);
    expect(filterCost('e2e-c')).toBe(450);
    expect(jobPartsCostCents({
      workOrderId: 'cleaner',
      partsUsed: [{ id: 'cleaner', quantity: 1, costCents: 930 }],
      movements,
    })).toBe(930);
    expect(jobPartsCostCents({
      workOrderId: 'oil-2',
      partsUsed: [{ inventoryStockId: 'oil', quantity: 1, costCents: 425 }],
      movements,
    })).toBe(425);
    expect(jobPartsCostCents({
      workOrderId: WO06,
      partsUsed: [{ inventoryStockId: 'oil', quantity: 6, costCents: 500 }],
      movements,
    })).toBe(2575);
  });

  it('posts the filter cost to COGS and inventory as soon as the job is invoiced', () => {
    expect(partsCost.reduce((sum, row) => sum + row.cents, 0)).toBe(17730);
    expect(statement.asOf.cogsCents).toBe(17730);
    const posted = statement.entries.find((entry) => entry.sourceId === 'cogs:e2e-c');
    expect(posted?.lines).toEqual([
      { accountKey: 'cogsParts', debitCents: 450, creditCents: 0, workOrderId: 'e2e-c' },
      { accountKey: 'inventory', debitCents: 0, creditCents: 450, workOrderId: 'e2e-c' },
    ]);
    expect(inventoryOnHandValueCents([
      { quantity: 1, unitCostCents: 23840 },
      { quantity: 16, unitCostCents: 450 },
      { quantity: 25, unitCostCents: 425 },
    ])).toBe(41665);
    expect(statement.asOf.inventoryCents).toBe(41665);
  });

  it('ties year net income to retained earnings once COGS is 17730', () => {
    const yearNi = 98681 - 17730 - 450 - 228725;
    expect(yearNi).toBe(-148224);
    expect(statement.period.netIncomeCents).toBe(yearNi);
    expect(statement.asOf.retainedEarningsCents).toBe(yearNi);
    expect(statement.asOf.netIncomeCents).toBe(statement.asOf.retainedEarningsCents);
    const dayFrom = zonedDayStart('2026-10-06', ZONE);
    const dayTo = zonedDayStart('2026-10-07', ZONE);
    const day = buildShopStatement({
      jobs,
      timeZone: ZONE,
      from: dayFrom,
      to: dayTo,
      partsCost,
      payroll: [{ id: 'wages', personId: 'tony', at: '2026-10-05T21:00:00.000Z', cents: 228725 }],
      writeOffs: [{ id: 'shrink', at: '2026-10-03T16:00:00.000Z', cents: 450 }],
      inventoryValueCents: 41665,
    });
    const before = buildShopStatement({
      jobs,
      timeZone: ZONE,
      from: FROM,
      to: dayFrom,
      partsCost,
      payroll: [{ id: 'wages', personId: 'tony', at: '2026-10-05T21:00:00.000Z', cents: 228725 }],
      writeOffs: [{ id: 'shrink', at: '2026-10-03T16:00:00.000Z', cents: 450 }],
      inventoryValueCents: 41665,
    });
    expect(day.period.netIncomeCents).toBe(day.asOf.retainedEarningsCents - before.asOf.retainedEarningsCents);
  });

  it('does not treat a paid invoice link as fee cash', () => {
    const backfilled = feeCashHeld({
      feeCents: 1210,
      jobPaidCents: 1999,
      taxCollectedCents: 0,
      linkStatus: 'paid',
      linkAmountCents: 3209,
      note: null,
    });
    const collected = feeCashHeld({
      feeCents: 1249,
      jobPaidCents: 6298,
      taxCollectedCents: 504,
      linkStatus: 'paid',
      linkAmountCents: 8051,
      note: 'in-person cash; platform fee; fee cash collected 1249 cents; not a shop expense',
    });
    expect(backfilled).toBe(0);
    expect(collected).toBe(1249);
    expect(collected + collected + backfilled).toBe(2498);
    expect(paidJobsWithPendingLinks([
      { id: 'wo-09', paymentStatus: 'paid', shopReceivedCents: 1999, jobCents: 1999, linkStatus: 'pending' },
    ])).toEqual(['wo-09']);
    expect(statement.asOf.dueToPlatformCents).toBe(2498);
    // 80385 collected − 52493 banked + 1209 tax + 2498 fee. The retest wrote 31600; the cents add to 31599.
    expect(statement.asOf.undepositedCents).toBe(80385 - 52493 + 1209 + 2498);
    expect(statement.asOf.undepositedCents).toBe(31599);
  });

  it('balances the seeded week after the new job and the backfill', () => {
    expect(statement.books.paidCents).toBe(80385);
    expect(statement.books.invoicedCents).toBe(98681);
    expect(statement.arCents).toBe(18296);
    expect(statement.customerCreditCents).toBe(0);
    expect(statement.asOf.salesTaxCents).toBe(1209);
    expect(statement.asOf.apCents).toBe(4500);
    expect(statement.asOf.bankCents).toBe(50793);
    expect(statement.asOf.inventoryShrinkCents).toBe(450);
    expect(statement.sheet.balanced).toBe(true);
    expect(statement.trial.debitCents).toBe(statement.trial.creditCents);
    expect(statement.sheet.assetsCents).toBe(statement.sheet.liabilitiesCents + statement.sheet.equityCents);
    for (const entry of statement.entries) {
      const debit = entry.lines.reduce((sum, line) => sum + line.debitCents, 0);
      const credit = entry.lines.reduce((sum, line) => sum + line.creditCents, 0);
      expect(debit).toBe(credit);
    }
  });

  it('hides fee lines and stock value from a manager', () => {
    const owed = hideManagerFeeOwed({
      owedCents: 0,
      lines: [
        { workOrderId: 'e2e-c', feeCents: 1249 },
        { workOrderId: 'wo-09', feeCents: 1210 },
      ],
      openLines: [{ workOrderId: 'e2e-c', feeCents: 1249 }],
      collectedCents: 2498,
      accruedCents: 3708,
      settledCents: 0,
      week: {
        owedCents: 1210,
        lines: [{ workOrderId: 'wo-09', feeCents: 1210 }],
        openLines: [{ workOrderId: 'wo-09', feeCents: 1210 }],
        collectedCents: 1210,
        accruedCents: 1210,
        settledCents: 0,
      },
    });
    expect(owed.lines).toEqual([]);
    expect(owed.openLines).toEqual([]);
    expect(owed.week.lines).toEqual([]);
    expect(owed.week.openLines).toEqual([]);
    expect(owed.accruedCents).toBe(0);
    const books = fs.readFileSync(path.join(process.cwd(), 'src/app/api/shop/books/route.ts'), 'utf8');
    expect(books).toContain('hideManagerFeeOwed');
    expect(books).toContain('unitCostCents: 0');
    const report = buildShopYear({
      year: 2026,
      timeZone: ZONE,
      invoices: [],
      payments: [],
      fixtray: [],
      deposits: [],
      missingDeposits: [],
      parts: [{ id: 'use-filter', at: '2026-10-06T16:54:00.000Z', kind: 'use', qty: 1 }],
      purchases: [],
      staffPunches: [],
      workPunches: [],
      onHandValueCents: 41665,
    });
    expect(report.totals.stockValueEndCents).toBe(41665);
    const hidden = hideShopRevenue(report);
    expect(hidden.totals.stockValueEndCents).toBe(0);
    expect(hidden.totals.parts.usedQty).toBe(1);
    expect(hidden.months[9].stockValueEndCents).toBe(0);
  });

  it('still leaves shop-accounting tables to the migration', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/lib/ensureProductionColumns.ts'), 'utf8');
    expect(source).not.toContain('CREATE TABLE IF NOT EXISTS "journal_entries"');
    expect(source).toContain('20261006_shop_accounting');
  });
});
