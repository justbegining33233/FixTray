import { customerFacingServiceFeeCents } from '../src/lib/serviceFeeBill';
import { buildConnectDestinationSplit } from '../src/lib/stripeConnectSplit';
import {
  accountantFeeCsv,
  allocateRefund,
  assembleShopJobs,
  depositLinesUp,
  feeMovements,
  inMonth,
  monthClose,
  openingBalanceEntries,
  planAllocatedReversal,
  planCardPayment,
  planDeposit,
  planSourceReversal,
  platformFeeYear,
  reportsMatchLedger,
  shopLedger,
  shopReport,
  usdToCents,
  type BooksRow,
  type OrderInput,
} from '../src/lib/books/money';
import {
  applyWorkHours,
  correctClock,
  hoursLabel,
  laborPayCents,
  sumStaffMinutes,
  sumWorkMinutes,
} from '../src/lib/books/clocks';
import {
  applyQty,
  bpsFromPercent,
  linesFromWorkOrder,
  partValue,
  taxCents,
  ticketPreview,
  ticketSync,
  ticketTax,
} from '../src/lib/books/parts';
import {
  DEFAULT_QB_MAP,
  qbAccounts,
  quickBooksExportAudit,
  quickBooksHandoff,
  QUICKBOOKS_OWNS_BOOKS_COPY,
  SHOP_PAID_IN_FULL_COPY,
} from '../src/lib/books/quickbooks';
import { memberAndCustomerFeeCopy } from '../src/lib/publicFeeCopy';

const AT = '2026-10-05T15:00:00.000Z';
const ACTOR = 'owner-1';

function order(partial: Partial<OrderInput> & { id: string }): OrderInput {
  return {
    shopId: 'shop-1',
    estimatedCost: 100,
    amountPaid: null,
    paymentStatus: 'unpaid',
    createdAt: '2026-10-02T12:00:00.000Z',
    ...partial,
  };
}

function row(partial: Partial<BooksRow> & Pick<BooksRow, 'id' | 'kind' | 'appliesTo' | 'amountCents'>): BooksRow {
  return {
    workOrderId: 'job-1',
    status: 'posted',
    createdAt: '2026-10-02T12:00:00.000Z',
    ...partial,
  };
}

describe('shop job money', () => {
  const savedFeeCents = 1000;
  const jobCents = 100_000;
  const liveFee = customerFacingServiceFeeCents(jobCents, savedFeeCents);

  it('pays the shop the full job and keeps the live fee off the payout', () => {
    const split = buildConnectDestinationSplit({
      quoteUsd: jobCents / 100,
      serviceFeeUsd: liveFee / 100,
      connectedAccountId: 'acct_123',
    });
    expect(split.ok).toBe(true);
    if (!split.ok) return;
    expect(split.shopPayoutCents).toBe(jobCents);
    expect(split.applicationFeeCents).toBe(liveFee);
    expect(split.shopPayoutCents).not.toBe(jobCents - liveFee);
    expect(liveFee).not.toBe(500);
    expect(liveFee).not.toBe(savedFeeCents);

    const plan = planCardPayment({
      paymentIntentId: 'pi_card',
      workOrderId: 'job-1',
      shopId: 'shop-1',
      jobCents,
      chargedCents: split.chargeCents,
      actorId: ACTOR,
      at: AT,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.shopReceivedCents).toBe(jobCents);
    expect(plan.customerPaidJobCents).toBe(plan.shopReceivedCents);
    expect(plan.platformFeeCents).toBe(liveFee);
    expect(plan.cardJobCents).toBe(plan.shopReceivedCents);
    expect(plan.audit.actorId).toBe(ACTOR);
    expect(plan.audit.at).toBe(AT);
    expect(plan.entries.some((entry) => entry.appliesTo === 'fee' && entry.amountCents === liveFee)).toBe(true);
  });

  it('adds jobs, then reverses a job refund and a fee chargeback on their own lines', () => {
    const orders = [
      order({ id: 'job-1', estimatedCost: 100, amountPaid: 110, paymentStatus: 'paid' }),
      order({ id: 'job-2', estimatedCost: 250.5, amountPaid: 250.5, paymentStatus: 'paid' }),
      order({ id: 'job-3', estimatedCost: 80, amountPaid: 20, paymentStatus: 'pending' }),
      order({ id: 'job-4', estimatedCost: 40, paymentStatus: 'unpaid' }),
    ];
    const rows: BooksRow[] = [
      row({ id: 'p1', workOrderId: 'job-1', kind: 'card_payment', appliesTo: 'job', amountCents: 10_000, createdAt: '2026-10-02T12:00:00.000Z' }),
      row({ id: 'f1', workOrderId: 'job-1', kind: 'card_payment', appliesTo: 'fee', amountCents: 1_000, createdAt: '2026-10-02T12:00:01.000Z' }),
      row({ id: 'p2', workOrderId: 'job-2', kind: 'card_payment', appliesTo: 'job', amountCents: 25_050, createdAt: '2026-10-03T12:00:00.000Z' }),
      row({ id: 'p3', workOrderId: 'job-3', kind: 'job_payment', appliesTo: 'job', amountCents: 2_000, createdAt: '2026-10-04T12:00:00.000Z' }),
      row({ id: 'r1', workOrderId: 'job-1', kind: 'refund', appliesTo: 'job', amountCents: 1_500, sourceId: 're_1', createdAt: '2026-10-05T12:00:00.000Z' }),
      row({ id: 'c1', workOrderId: 'job-1', kind: 'chargeback', appliesTo: 'fee', amountCents: 400, sourceId: 'dp_1', createdAt: '2026-10-05T13:00:00.000Z' }),
    ];
    const ledger = shopLedger(assembleShopJobs(orders, rows));
    expect(ledger.shopReceivedCents).toBe(10_000 - 1_500 + 25_050 + 2_000);
    expect(ledger.customerPaidJobCents).toBe(ledger.shopReceivedCents);
    expect(ledger.shopTotalCents).toBe(ledger.shopReceivedCents);
    expect(ledger.shopTotalCents).not.toBe(ledger.shopReceivedCents - ledger.platformFeeCents);
    expect(ledger.platformFeeCents).toBe(1_000 - 400);
    expect(ledger.feeDeductedFromShop).toBe(false);

    const report = shopReport(ledger);
    expect(reportsMatchLedger(ledger, report)).toBe(true);
    expect(report.paidCents).toBe(25_050);
    expect(report.partialCents).toBe((10_000 - 8_500) + (8_000 - 2_000));
    expect(report.unpaidCents).toBe(4_000);
    expect(ledger.jobs.find((job) => job.id === 'job-1')?.standing).toBe('partial');
    expect(ledger.jobs.find((job) => job.id === 'job-2')?.standing).toBe('paid');
    expect(ledger.jobs.find((job) => job.id === 'job-3')?.standing).toBe('partial');
    expect(ledger.jobs.find((job) => job.id === 'job-4')?.standing).toBe('unpaid');
  });

  it('uses the charged fee on a legacy paid job and does not subtract it from the shop', () => {
    const charged = jobCents + liveFee;
    const jobs = assembleShopJobs([
      order({
        id: 'legacy',
        estimatedCost: jobCents / 100,
        amountPaid: charged / 100,
        paymentStatus: 'paid',
      }),
    ], []);
    expect(jobs[0].shopReceivedCents).toBe(jobCents);
    expect(jobs[0].customerPaidJobCents).toBe(jobCents);
    expect(jobs[0].platformFeeCents).toBe(liveFee);
    const year = platformFeeYear(feeMovements([
      order({
        id: 'legacy',
        estimatedCost: jobCents / 100,
        amountPaid: charged / 100,
        paymentStatus: 'paid',
        createdAt: '2026-10-01T00:00:00.000Z',
      }),
    ], []));
    expect(year.collectedCents).toBe(liveFee);
    expect(year.netCents).toBe(liveFee);
    expect(year.collectedCents).not.toBe(savedFeeCents);
  });

  it('lines the card job amount up with shop received and the deposit date', () => {
    const jobs = assembleShopJobs(
      [order({ id: 'job-1', paymentStatus: 'paid', amountPaid: 110 })],
      [
        row({ id: 'p', kind: 'card_payment', appliesTo: 'job', amountCents: 10_000 }),
        row({ id: 'f', kind: 'card_payment', appliesTo: 'fee', amountCents: 1_047 }),
        row({
          id: 'd',
          kind: 'deposit',
          appliesTo: 'job',
          amountCents: 10_000,
          depositAt: '2026-10-04T00:00:00.000Z',
          createdAt: '2026-10-04T00:00:00.000Z',
        }),
      ],
    );
    expect(depositLinesUp(jobs[0]).ok).toBe(true);
    expect(jobs[0].cardJobCents).toBe(jobs[0].shopReceivedCents);
    expect(jobs[0].depositCents).toBe(jobs[0].shopReceivedCents);
    expect(jobs[0].depositAt).toBe('2026-10-04T00:00:00.000Z');
    expect(jobs[0].platformFeeCents).toBe(1047);
  });

  it('rejects a reversal larger than its source and keeps an open reversal off the totals', () => {
    const tooBig = planSourceReversal({
      kind: 'refund',
      appliesTo: 'job',
      amountCents: 50,
      sourceRemainingCents: 40,
      status: 'posted',
      sourceId: 're_big',
      workOrderId: 'job-1',
      actorId: ACTOR,
      at: AT,
    });
    expect(tooBig.ok).toBe(false);

    const feeOnly = planSourceReversal({
      kind: 'chargeback',
      appliesTo: 'fee',
      amountCents: 4047,
      sourceRemainingCents: 4047,
      status: 'posted',
      sourceId: 'dp_fee',
      workOrderId: 'job-1',
      actorId: ACTOR,
      at: AT,
    });
    expect(feeOnly.ok).toBe(true);
    if (!feeOnly.ok) return;
    expect(feeOnly.shopDeltaCents).toBe(0);
    expect(feeOnly.feeDeltaCents).toBe(-4047);
    expect(feeOnly.audit.actorId).toBe(ACTOR);
    expect(feeOnly.audit.at).toBe(AT);

    const open = planAllocatedReversal({
      kind: 'refund',
      amountCents: 10_000,
      jobRemainingCents: 10_000,
      feeRemainingCents: 1000,
      status: 'open',
      sourceId: 're_open',
      workOrderId: 'job-1',
      actorId: ACTOR,
      at: AT,
    });
    expect(open.ok).toBe(true);
    if (!open.ok) return;
    expect(open.shopDeltaCents).toBe(0);
    expect(open.feeDeltaCents).toBe(0);

    const posted = allocateRefund(11_000, 10_000, 1_000, 'auto');
    expect(posted).toEqual({ jobCents: 10_000, feeCents: 1_000 });
    const feeNamed = allocateRefund(1_000, 10_000, 1_000, 'fee');
    expect(feeNamed).toEqual({ jobCents: 0, feeCents: 1_000 });
  });

  it('keeps a legacy job intact when a later refund reverses only the job', () => {
    const legacyOrder = order({
      id: 'job-1',
      estimatedCost: 100,
      amountPaid: 110.47,
      paymentStatus: 'paid',
    });
    const legacy = assembleShopJobs([legacyOrder], []);
    const openings = openingBalanceEntries(legacy[0]).map((entry, index) => row({
      id: `open-${index}`,
      kind: entry.kind,
      appliesTo: entry.appliesTo,
      amountCents: entry.amountCents,
      createdAt: '2026-10-02T12:00:00.000Z',
    }));
    const after = assembleShopJobs([legacyOrder], [
      ...openings,
      row({ id: 'r', kind: 'refund', appliesTo: 'job', amountCents: 2_000, sourceId: 're_part', createdAt: '2026-10-06T12:00:00.000Z' }),
    ]);
    expect(after[0].shopReceivedCents).toBe(legacy[0].shopReceivedCents - 2_000);
    expect(after[0].customerPaidJobCents).toBe(after[0].shopReceivedCents);
    expect(after[0].platformFeeCents).toBe(legacy[0].platformFeeCents);
  });
});

describe('platform fee year', () => {
  it('nets collected fees minus fee refunds and chargebacks and leaves shop revenue out', () => {
    const movements = feeMovements(
      [
        order({ id: 'job-1', shopId: 'shop-a', estimatedCost: 100 }),
        order({ id: 'job-2', shopId: 'shop-b', estimatedCost: 200 }),
      ],
      [
        row({ id: 'fa', workOrderId: 'job-1', kind: 'card_payment', appliesTo: 'fee', amountCents: 4047, createdAt: '2026-10-01T00:00:00.000Z' }),
        row({ id: 'ja', workOrderId: 'job-1', kind: 'card_payment', appliesTo: 'job', amountCents: 100_000, createdAt: '2026-10-01T00:00:00.000Z' }),
        row({ id: 'fb', workOrderId: 'job-2', kind: 'card_payment', appliesTo: 'fee', amountCents: 5100, createdAt: '2026-10-02T00:00:00.000Z' }),
        row({ id: 'fr', workOrderId: 'job-1', kind: 'refund', appliesTo: 'fee', amountCents: 1000, sourceId: 're_f', createdAt: '2026-10-03T00:00:00.000Z' }),
        row({ id: 'fc', workOrderId: 'job-2', kind: 'chargeback', appliesTo: 'fee', amountCents: 100, sourceId: 'dp_f', createdAt: '2026-10-04T00:00:00.000Z' }),
      ],
    );
    const year = platformFeeYear(movements);
    expect(year.collectedCents).toBe(4047 + 5100);
    expect(year.refundedCents).toBe(1000 + 100);
    expect(year.netCents).toBe(year.collectedCents - year.refundedCents);
    expect(year.perShop).toEqual([
      { shopId: 'shop-a', collectedCents: 4047, refundedCents: 1000, netCents: 3047 },
      { shopId: 'shop-b', collectedCents: 5100, refundedCents: 100, netCents: 5000 },
    ]);
    const encoded = JSON.stringify(year);
    expect(encoded).not.toContain('100000');
    expect(encoded).not.toContain('bay');
    expect(encoded).not.toContain('revenue');
    expect(Object.keys(year.perShop[0]).sort()).toEqual(['collectedCents', 'netCents', 'refundedCents', 'shopId']);
    const csv = accountantFeeCsv(year);
    expect(csv.startsWith('date,shop_id,kind,fee_cents\n')).toBe(true);
    expect(csv).toContain('4047');
    expect(csv).not.toContain('revenue');
    expect(csv).not.toContain('100000');
    expect(csv).toContain(`total,,net,${year.netCents}`);
  });
});

describe('month close and QuickBooks', () => {
  function paidJob() {
    return assembleShopJobs(
      [order({ id: 'job-1', paymentStatus: 'paid', amountPaid: 110 })],
      [
        row({ id: 'p', kind: 'card_payment', appliesTo: 'job', amountCents: 10_000 }),
        row({ id: 'f', kind: 'card_payment', appliesTo: 'fee', amountCents: 4047 }),
        row({
          id: 'd',
          kind: 'deposit',
          appliesTo: 'job',
          amountCents: 10_000,
          depositAt: '2026-10-04T00:00:00.000Z',
        }),
      ],
    );
  }

  it('blocks a dirty month and exports a clean one without the fee', () => {
    const dirty = assembleShopJobs(
      [
        order({ id: 'job-1', paymentStatus: 'paid', amountPaid: 110 }),
        order({ id: 'job-2', estimatedCost: 50, paymentStatus: 'unpaid' }),
      ],
      [
        row({ id: 'p', kind: 'card_payment', appliesTo: 'job', amountCents: 10_000 }),
        row({ id: 'f', kind: 'card_payment', appliesTo: 'fee', amountCents: 4047 }),
        row({ id: 'd', kind: 'deposit', appliesTo: 'job', amountCents: 9_000, depositAt: '2026-10-04T00:00:00.000Z' }),
        row({ id: 'open', kind: 'refund', appliesTo: 'job', amountCents: 100, status: 'open', sourceId: 're_open' }),
      ],
    );
    const close = monthClose(dirty);
    expect(close.readyToSync).toBe(false);
    expect(close.unmatchedDeposits.map((issue) => issue.reason)).toContain('deposit_amount_mismatch');
    expect(close.openRefunds.map((issue) => issue.id)).toContain('open');
    expect(close.unpaid.map((issue) => issue.id)).toContain('job-2');
    const blocked = quickBooksHandoff({
      jobs: dirty,
      reversals: [],
      labor: [],
      close,
    });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.blocked).toBe(true);
    expect(blocked.warnings.length).toBeGreaterThan(0);
    expect(blocked).not.toHaveProperty('csv');

    const clean = paidJob();
    const handoff = quickBooksHandoff({
      jobs: clean,
      reversals: [
        { id: 'fee-refund', appliesTo: 'fee', kind: 'refund', amountCents: 4047, at: AT },
        { id: 'nope', appliesTo: 'job', kind: 'refund', amountCents: 0, at: AT, status: 'open' },
      ],
      labor: [{ personId: 'tech-1', minutes: 510, hourlyRateCents: 2_000 }],
      tax: [{ workOrderId: 'job-1', taxCents: 825 }],
      map: { sales: 'Shop Sales', feeExpense: 'FixTray Fee' },
    });
    expect(handoff.ok).toBe(true);
    if (!handoff.ok) return;
    expect(handoff.copy).toBe(SHOP_PAID_IN_FULL_COPY);
    expect(handoff.ownsBooks).toBe(QUICKBOOKS_OWNS_BOOKS_COPY);
    expect(handoff.map.sales).toBe('Shop Sales');
    expect(handoff.map).not.toHaveProperty('feeExpense');
    expect(handoff.csv).toContain('Shop Sales');
    expect(handoff.csv).toContain('10000');
    expect(handoff.csv).not.toContain('4047');
    expect(handoff.csv).not.toContain('FixTray Fee');
    expect(handoff.csv).toContain(SHOP_PAID_IN_FULL_COPY);
    expect(handoff.csv).toContain('labor');
    expect(laborPayCents(510, 2_000)).toBe(17_000);
    expect(handoff.csv).toContain('17000');
    const audit = quickBooksExportAudit({ actorId: ACTOR, at: AT, shopId: 'shop-1', rowCount: 3 });
    expect(audit.actorId).toBe(ACTOR);
    expect(audit.at).toBe(AT);
    expect(qbAccounts(null)).toEqual(DEFAULT_QB_MAP);
  });

  it('filters a month in UTC', () => {
    expect(inMonth('2026-10-31T23:00:00.000Z', '2026-10')).toBe(true);
    expect(inMonth('2026-11-01T00:00:00.000Z', '2026-10')).toBe(false);
    const deposit = planDeposit({
      workOrderId: 'job-1',
      amountCents: 10_000,
      depositAt: '2026-10-04',
      actorId: ACTOR,
      at: AT,
    });
    expect(deposit.ok).toBe(true);
    if (!deposit.ok) return;
    expect(deposit.audit.action).toBe('books.deposit');
  });
});

describe('staff and work clocks', () => {
  it('sums each person and keeps work hours off the staff clock', () => {
    const people = [
      { personId: 'a', minutes: 510 },
      { personId: 'b', minutes: 510 },
      { personId: 'c', minutes: 510 },
    ];
    const total = sumStaffMinutes(people);
    expect(total.totalMinutes).toBe(1530);
    expect(total.totalHoursLabel).toBe('25.5');
    expect(hoursLabel(510)).toBe('8.5');
    expect(total.totalMinutes).not.toBe(people[0].minutes);
    expect(total.byPerson).toHaveLength(3);

    const staff = [
      { id: 'staff-a', personId: 'a', minutes: 510 },
      { id: 'same-id', personId: 'b', minutes: 480 },
    ];
    const work = [{ id: 'same-id', personId: 'b', minutes: 90 }];
    const next = applyWorkHours(staff, work, { id: 'same-id', minutes: 120 });
    expect(next.staff).toEqual(staff);
    expect(next.work).toEqual([{ id: 'same-id', personId: 'b', minutes: 120 }]);
    expect(sumWorkMinutes(next.work)).toBe(120);
    expect(sumStaffMinutes(next.staff.map((entry) => ({ personId: entry.personId, minutes: entry.minutes }))).totalMinutes).toBe(990);
  });

  it('requires a reason and audits a staff correction without editing work time', () => {
    const staff = [{ id: 's1', personId: 'a', minutes: 480 }];
    const work = [{ id: 'w1', personId: 'a', minutes: 60 }];
    const missing = correctClock({
      clock: 'staff',
      entryId: 's1',
      nextMinutes: 500,
      reason: '   ',
      actorId: ACTOR,
      at: AT,
      staff,
      work,
    });
    expect(missing.ok).toBe(false);
    expect(missing.staff[0].minutes).toBe(480);

    const corrected = correctClock({
      clock: 'staff',
      entryId: 's1',
      nextMinutes: 510,
      reason: 'Missed the last half hour',
      actorId: ACTOR,
      at: AT,
      shopId: 'shop-1',
      staff,
      work,
    });
    expect(corrected.ok).toBe(true);
    if (!corrected.ok) return;
    expect(corrected.staff[0].minutes).toBe(510);
    expect(corrected.work).toEqual(work);
    expect(corrected.audit.actorId).toBe(ACTOR);
    expect(corrected.audit.at).toBe(AT);
    expect(corrected.audit.details).toContain('Missed the last half hour');

    const workFix = correctClock({
      clock: 'work',
      entryId: 'w1',
      nextMinutes: 45,
      reason: 'Stopped for parts',
      actorId: ACTOR,
      at: AT,
      staff: corrected.staff,
      work,
    });
    expect(workFix.ok).toBe(true);
    if (!workFix.ok) return;
    expect(workFix.staff[0].minutes).toBe(510);
    expect(workFix.work[0].minutes).toBe(45);
  });
});

describe('parts, tax, and ticket sync', () => {
  it('keeps cost and sell apart and moves quantity on use, return, and adjust', () => {
    expect(partValue(3, 400, 1250)).toEqual({ costCents: 1200, sellCents: 3750 });
    const used = applyQty(10, { kind: 'use', qty: 4 });
    expect(used).toEqual({ ok: true, onHand: 6, delta: -4 });
    const returned = applyQty(6, { kind: 'return', qty: 2 });
    expect(returned).toEqual({ ok: true, onHand: 8, delta: 2 });
    expect(applyQty(8, { kind: 'adjust', qty: -3 }).ok).toBe(false);
    const adjusted = applyQty(8, { kind: 'adjust', qty: -3, reason: 'Count was short' });
    expect(adjusted).toEqual({ ok: true, onHand: 5, delta: -3 });
    expect(applyQty(2, { kind: 'use', qty: 3 }).ok).toBe(false);
  });

  it('writes separate tax lines and syncs estimate, invoice, and the job payment', () => {
    expect(taxCents(10_000, 825)).toBe(825);
    expect(bpsFromPercent(8.25)).toBe(825);
    const tax = ticketTax(
      [
        { kind: 'labor', amountCents: 8_000 },
        { kind: 'part', amountCents: 2_000 },
        { kind: 'shop_fee', amountCents: 500 },
      ],
      { rateBps: 825, appliesToLabor: false, appliesToParts: true, appliesToShopFees: false },
    );
    expect(tax.taxLines).toEqual([
      { kind: 'labor', baseCents: 8_000, taxCents: 0 },
      { kind: 'part', baseCents: 2_000, taxCents: 165 },
      { kind: 'shop_fee', baseCents: 500, taxCents: 0 },
    ]);
    expect(tax.shopJobCents).toBe(8_000 + 2_000 + 500 + 165);
    const lines = linesFromWorkOrder({
      estimate: {
        lineItems: [
          { kind: 'labor', quantity: 2, unitPrice: 40 },
          { kind: 'part', quantity: 1, unitPrice: 20 },
          { description: 'FixTray Service Fee', total: 10 },
        ],
      },
    });
    expect(lines).toEqual([
      { kind: 'labor', amountCents: 8_000 },
      { kind: 'part', amountCents: 2_000 },
    ]);
    const preview = ticketPreview({
      lines,
      rule: { rateBps: 0, appliesToLabor: false, appliesToParts: false, appliesToShopFees: false },
      paidJobCents: 10_000,
      standing: 'paid',
      storedEstimateCents: 10_000,
    });
    expect(preview.sync.synced).toBe(true);
    expect(preview.invoiceCents).toBe(preview.estimateCents);
    expect(ticketSync({
      estimateCents: 10_000,
      invoiceCents: 10_000 + 4047,
      paidJobCents: 10_000,
      standing: 'paid',
    }).synced).toBe(false);
    expect(ticketSync({
      estimateCents: 10_000,
      invoiceCents: 10_000,
      paidJobCents: 4_000,
      standing: 'partial',
    }).synced).toBe(true);
    expect(usdToCents(100.005)).toBe(10001);
  });
});

describe('site copy', () => {
  it('says the shop is paid in full and the fee is separate, with no dollar amount', () => {
    const copy = memberAndCustomerFeeCopy();
    expect(copy).toContain('paid in full');
    expect(copy).toContain('separate');
    expect(copy).not.toMatch(/\$\d/);
    expect(copy).toContain('does not charge members a subscription');
  });
});
