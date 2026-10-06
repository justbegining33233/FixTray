import { customerFacingServiceFeeCents } from '@/lib/serviceFeeBill';
import {
  inPersonFeeInvoice,
  inPersonFeeOwed,
  planDeposit,
  planInPersonPayment,
  shopLedger,
  shopReport,
  type BooksRow,
} from '@/lib/books/money';
import {
  filterStockParts,
  pickStockPart,
  preparePartMove,
  ticketSync,
} from '@/lib/books/parts';
import { jobPriceAfterWorkClock, resolveClockTechId, staffPunchMinutes, workClockClose } from '@/lib/books/clocks';
import { allocateFeeSettlement } from '@/lib/feeSettlement';

const ACTOR = 'maria';
const AT = '2026-10-05T18:00:00.000Z';

describe('ticket match honesty', () => {
  it('does not call a never-invoiced unpaid ticket a match', () => {
    const sync = ticketSync({
      estimateCents: 4999,
      invoiceCents: 4999,
      paidJobCents: 0,
      standing: 'unpaid',
      invoiced: false,
    });
    expect(sync.synced).toBe(false);
    expect(sync.issues).toEqual(expect.arrayContaining(['Missing invoice', 'Unpaid']));
    expect(sync.issues.join(' ')).not.toMatch(/match/i);
  });

  it('matches only when estimate, invoice, and payment are the same cents', () => {
    expect(ticketSync({
      estimateCents: 4999,
      invoiceCents: 4999,
      paidJobCents: 4999,
      standing: 'paid',
      invoiced: true,
    }).synced).toBe(true);
    const partial = ticketSync({
      estimateCents: 4999,
      invoiceCents: 4999,
      paidJobCents: 2500,
      standing: 'partial',
      invoiced: true,
    });
    expect(partial.synced).toBe(false);
    expect(partial.issues.join(' ')).toMatch(/do not match/);
  });
});

describe('in-person pay', () => {
  it('calculates the card gross-up fee and does not take it from the shop', () => {
    const savedFeeCents = 1000;
    const jobCents = 4999;
    const fee = customerFacingServiceFeeCents(jobCents, savedFeeCents);
    const planned = planInPersonPayment({
      workOrderId: 'wo-1',
      shopId: 'shop-1',
      jobCents,
      alreadyReceivedCents: 0,
      tenderedCents: jobCents + fee,
      savedFeeCents,
      customerFacingFeeCents: fee,
      method: 'cash',
      feeAlreadyRecorded: false,
      actorId: ACTOR,
      at: AT,
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(fee).toBeGreaterThan(0);
    expect(planned.platformFeeCents).toBe(fee);
    expect(planned.shopReceivedCents).toBe(jobCents);
    expect(planned.customerPaidJobCents).toBe(jobCents);
    expect(planned.feeDeductedFromShop).toBe(false);
    expect(planned.paymentStatus).toBe('paid');
    expect(planned.entries.find((entry) => entry.appliesTo === 'job')?.amountCents).toBe(jobCents);
    const feeRow = planned.entries.find((entry) => entry.appliesTo === 'fee');
    expect(feeRow?.amountCents).toBe(fee);
    expect(feeRow?.kind).toBe('job_payment');
    const ledger = shopLedger([{
      id: 'wo-1',
      shopId: 'shop-1',
      jobCents,
      customerPaidJobCents: planned.shopReceivedCents,
      shopReceivedCents: planned.shopReceivedCents,
      platformFeeCents: planned.platformFeeCents,
      cardJobCents: planned.shopReceivedCents,
      depositCents: null,
      depositAt: null,
      openReversalIds: [],
      standing: planned.standing,
    }]);
    expect(ledger.feeDeductedFromShop).toBe(false);
    expect(ledger.shopTotalCents).toBe(jobCents);
    expect(shopReport(ledger).shopReceivedCents).toBe(jobCents);
  });

  it('leaves a short tender pending and does not invent a fee yet', () => {
    const planned = planInPersonPayment({
      workOrderId: 'wo-2',
      shopId: 'shop-1',
      jobCents: 4999,
      alreadyReceivedCents: 0,
      tenderedCents: 2500,
      savedFeeCents: 1000,
      method: 'check',
      feeAlreadyRecorded: false,
      actorId: ACTOR,
      at: AT,
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.paymentStatus).toBe('pending');
    expect(planned.platformFeeCents).toBe(0);
    expect(planned.shopReceivedCents).toBe(2500);
  });
});

describe('weekly FixTray owed', () => {
  const rows: BooksRow[] = [
    {
      id: 'fee-cash',
      workOrderId: 'wo-1',
      shopId: 'shop-1',
      kind: 'job_payment',
      appliesTo: 'fee',
      amountCents: 1547,
      createdAt: '2026-10-01T15:00:00.000Z',
    },
    {
      id: 'fee-card',
      workOrderId: 'wo-2',
      shopId: 'shop-1',
      kind: 'card_payment',
      appliesTo: 'fee',
      amountCents: 1547,
      createdAt: '2026-10-01T16:00:00.000Z',
    },
    {
      id: 'job',
      workOrderId: 'wo-1',
      shopId: 'shop-1',
      kind: 'job_payment',
      appliesTo: 'job',
      amountCents: 4999,
      createdAt: '2026-10-01T15:00:00.000Z',
    },
  ];

  it('owes the in-person fee only, until the shop pays FixTray', () => {
    const open = inPersonFeeOwed(rows);
    expect(open.owedCents).toBe(1547);
    expect(open.feeDeductedFromShop).toBe(false);
    const invoice = inPersonFeeInvoice({ shopName: 'Week Sim Shop Jose', weekLabel: '2026-09-29', owed: open });
    expect(invoice.text).toMatch(/in-person/i);
    expect(invoice.text).toMatch(/\$15\.47/);
    expect(invoice.text).not.toMatch(/\$5\.00/);
    const settled = inPersonFeeOwed([
      ...rows,
      {
        id: 'settle',
        workOrderId: 'wo-1',
        shopId: 'shop-1',
        kind: 'fee_settlement',
        appliesTo: 'fee',
        amountCents: 1547,
        createdAt: '2026-10-06T15:00:00.000Z',
      },
    ]);
    expect(settled.owedCents).toBe(0);
    const split = allocateFeeSettlement([{ workOrderId: 'wo-1', feeCents: 1547 }], 1547);
    expect(split).toEqual({ ok: true, pieces: [{ workOrderId: 'wo-1', feeCents: 1547 }] });
  });
});

describe('deposits', () => {
  it('refuses a deposit that has no matching shop receipt', () => {
    const refused = planDeposit({
      workOrderId: 'wo-unpaid',
      amountCents: 1500,
      depositAt: '2026-10-05',
      actorId: ACTOR,
      at: AT,
      shopReceivedCents: 0,
    });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error).toMatch(/payment/i);
  });

  it('accepts a deposit that matches the shop receipt', () => {
    const ok = planDeposit({
      workOrderId: 'wo-paid',
      amountCents: 4999,
      depositAt: '2026-10-06',
      actorId: ACTOR,
      at: AT,
      shopReceivedCents: 4999,
    });
    expect(ok.ok).toBe(true);
  });
});

describe('owner clock and job price', () => {
  it('lets the shop owner clock on an owner profile instead of the shop id', () => {
    const resolved = resolveClockTechId({
      role: 'shop',
      requestedTechId: 'shop-1',
      actorId: 'shop-1',
      ownerTechId: 'tech-owner',
    });
    expect(resolved).toEqual({ ok: true, techId: 'tech-owner' });
  });

  it('keeps the menu price when the work clock is 0.5h or 2h', () => {
    expect(jobPriceAfterWorkClock(4999, 30)).toBe(4999);
    expect(jobPriceAfterWorkClock(4999, 120)).toBe(4999);
    const half = workClockClose({
      menuPriceCents: 8999,
      clockIn: new Date('2026-10-05T14:00:00.000Z'),
      clockOut: new Date('2026-10-05T14:30:00.000Z'),
    });
    expect(half.hoursSpent).toBe(0.5);
    expect(half.jobPriceCents).toBe(8999);
  });

  it('counts an open staff punch in team hours', () => {
    const now = new Date('2026-10-05T22:00:00.000Z');
    const minutes = staffPunchMinutes({
      clockIn: '2026-10-05T21:00:00.000Z',
      clockOut: null,
      hoursWorked: null,
    }, now);
    expect(minutes).toBe(60);
  });
});

describe('parts return and adjust', () => {
  const stock = [
    { id: 'stk-oil', name: '5W-30 Synthetic Oil Qt', sku: 'OIL-5W30', onHand: 10 },
    { id: 'stk-filter', name: 'Oil Filter Standard', sku: 'FILTER', onHand: 8 },
  ];

  it('picks the stock id from the list and refuses a typed sku', () => {
    expect(pickStockPart(stock, 'OIL-5W30').ok).toBe(false);
    expect(filterStockParts(stock, 'oil').map((part) => part.id)).toEqual(['stk-oil', 'stk-filter']);
    const matches = filterStockParts(stock, '5w-30');
    expect(matches).toHaveLength(1);
    const picked = pickStockPart(stock, matches[0].id);
    expect(picked).toEqual({ ok: true, part: stock[0] });
  });

  it('records a return and an adjust only with a reason', () => {
    expect(preparePartMove({ kind: 'return', qty: 1, onHand: 10 }).ok).toBe(false);
    expect(preparePartMove({ kind: 'adjust', qty: -1, onHand: 8 }).ok).toBe(false);
    expect(preparePartMove({ kind: 'return', qty: 1, onHand: 10, reason: 'Sealed quart back to the shelf' })).toEqual({
      ok: true,
      onHand: 11,
      delta: 1,
    });
    expect(preparePartMove({ kind: 'adjust', qty: -1, onHand: 8, reason: 'Crushed in the box' })).toEqual({
      ok: true,
      onHand: 7,
      delta: -1,
    });
  });
});
