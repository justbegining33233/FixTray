import { readFileSync } from 'fs';
import { join } from 'path';
import { customerFacingServiceFeeCents } from '../src/lib/serviceFeeBill';
import {
  billFromFrozenFee,
  FEE_SNAPSHOT_KEY,
  freezeFeeSnapshot,
  frozenCustomerFeeUsd,
  readCheckoutFeeForInPerson,
  readFeeSnapshot,
} from '../src/lib/feeSnapshot';
import {
  inPersonFeeOwed,
  inPersonOwedReport,
  planInPersonPayment,
  type BooksRow,
} from '../src/lib/books/money';

const NOW = '2026-10-05T22:00:00.000Z';
const LATER = '2026-10-06T15:00:00.000Z';
const ACTOR = 'maria';

describe('checkout fee snapshot', () => {
  const quoteCents = 4999;
  const originalPlatformFeeCents = 1000;
  const raisedPlatformFeeCents = 2500;

  it('freezes the customer fee and ignores a later platform fee on the same quote', () => {
    const first = freezeFeeSnapshot({
      completion: { offlineNotes: [{ body: 'keep' }] },
      quoteCents,
      livePlatformFeeCents: originalPlatformFeeCents,
      now: NOW,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const expected = customerFacingServiceFeeCents(quoteCents, originalPlatformFeeCents);
    expect(first.snapshot.customerFacingFeeCents).toBe(expected);
    expect(first.snapshot.platformFeeCents).toBe(originalPlatformFeeCents);
    expect(first.completion.offlineNotes).toEqual([{ body: 'keep' }]);
    expect(first.reused).toBe(false);

    const second = freezeFeeSnapshot({
      completion: first.completion,
      quoteCents,
      livePlatformFeeCents: raisedPlatformFeeCents,
      now: LATER,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.reused).toBe(true);
    expect(second.snapshot.customerFacingFeeCents).toBe(expected);
    expect(second.snapshot.frozenAt).toBe(NOW);
    expect(second.snapshot.platformFeeCents).toBe(originalPlatformFeeCents);
    expect(customerFacingServiceFeeCents(quoteCents, raisedPlatformFeeCents)).not.toBe(expected);

    const missingConfig = freezeFeeSnapshot({
      completion: first.completion,
      quoteCents,
      livePlatformFeeCents: null,
      now: LATER,
    });
    expect(missingConfig.ok).toBe(true);
    if (!missingConfig.ok) return;
    expect(missingConfig.snapshot.customerFacingFeeCents).toBe(expected);
  });

  it('calculates a new fee only when the shop quote changes', () => {
    const first = freezeFeeSnapshot({
      completion: null,
      quoteCents,
      livePlatformFeeCents: originalPlatformFeeCents,
      now: NOW,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const nextQuote = 8000;
    const changed = freezeFeeSnapshot({
      completion: first.completion,
      quoteCents: nextQuote,
      livePlatformFeeCents: raisedPlatformFeeCents,
      embeddedFeeCents: 1547,
      now: LATER,
    });
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    expect(changed.reused).toBe(false);
    expect(changed.snapshot.quoteCents).toBe(nextQuote);
    expect(changed.snapshot.customerFacingFeeCents).toBe(
      customerFacingServiceFeeCents(nextQuote, raisedPlatformFeeCents),
    );
    expect(changed.snapshot.customerFacingFeeCents).not.toBe(first.snapshot.customerFacingFeeCents);
  });

  it('adopts a fee already stored on a payment link without reading the live setting', () => {
    const embedded = customerFacingServiceFeeCents(quoteCents, originalPlatformFeeCents);
    const adopted = readCheckoutFeeForInPerson({
      completion: null,
      quoteCents,
      embeddedFeeCents: embedded,
      now: NOW,
    });
    expect(adopted.ok).toBe(true);
    if (!adopted.ok) return;
    expect(adopted.snapshot.customerFacingFeeCents).toBe(embedded);
    expect(readFeeSnapshot(adopted.completion)?.customerFacingFeeCents).toBe(embedded);

    const blocked = readCheckoutFeeForInPerson({
      completion: null,
      quoteCents,
      embeddedFeeCents: null,
      now: NOW,
    });
    expect(blocked.ok).toBe(false);

    const stale = readCheckoutFeeForInPerson({
      completion: adopted.completion,
      quoteCents: quoteCents + 500,
      embeddedFeeCents: embedded,
      now: LATER,
    });
    expect(stale.ok).toBe(false);
  });

  it('records the frozen customer fee on the in-person books row', () => {
    const frozen = freezeFeeSnapshot({
      completion: {},
      quoteCents,
      livePlatformFeeCents: originalPlatformFeeCents,
      now: NOW,
    });
    expect(frozen.ok).toBe(true);
    if (!frozen.ok) return;
    const laterFee = customerFacingServiceFeeCents(quoteCents, raisedPlatformFeeCents);
    expect(laterFee).not.toBe(frozen.snapshot.customerFacingFeeCents);

    const planned = planInPersonPayment({
      workOrderId: 'wo-frozen',
      shopId: 'shop-1',
      jobCents: quoteCents,
      alreadyReceivedCents: 0,
      tenderedCents: quoteCents,
      savedFeeCents: raisedPlatformFeeCents,
      customerFacingFeeCents: frozen.snapshot.customerFacingFeeCents,
      method: 'cash',
      feeAlreadyRecorded: false,
      actorId: ACTOR,
      at: NOW,
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.shopReceivedCents).toBe(quoteCents);
    expect(planned.feeDeductedFromShop).toBe(false);
    expect(planned.platformFeeCents).toBe(frozen.snapshot.customerFacingFeeCents);
    expect(planned.platformFeeCents).not.toBe(laterFee);
    const feeRow = planned.entries.find((entry) => entry.appliesTo === 'fee');
    expect(feeRow?.amountCents).toBe(frozen.snapshot.customerFacingFeeCents);

    const rows: BooksRow[] = planned.entries.map((entry, index) => ({
      id: `row-${index}`,
      workOrderId: 'wo-frozen',
      shopId: 'shop-1',
      kind: entry.kind,
      appliesTo: entry.appliesTo,
      amountCents: entry.amountCents,
      createdAt: NOW,
    }));
    const owed = inPersonFeeOwed(rows);
    expect(owed.owedCents).toBe(frozen.snapshot.customerFacingFeeCents);
    expect(owed.openLines).toEqual([
      expect.objectContaining({
        workOrderId: 'wo-frozen',
        feeCents: frozen.snapshot.customerFacingFeeCents,
      }),
    ]);
    expect(owed.feeDeductedFromShop).toBe(false);

    const report = inPersonOwedReport(
      [{ id: 'wo-frozen', shopId: 'shop-1' }, { id: 'wo-card', shopId: 'shop-1' }],
      [
        ...rows,
        {
          id: 'card-fee',
          workOrderId: 'wo-card',
          shopId: 'shop-1',
          kind: 'card_payment',
          appliesTo: 'fee',
          amountCents: 9999,
          createdAt: NOW,
        },
      ],
    );
    expect(report.lines).toEqual([
      expect.objectContaining({
        shopId: 'shop-1',
        workOrderId: 'wo-frozen',
        feeCents: frozen.snapshot.customerFacingFeeCents,
      }),
    ]);
    expect(report.owedCents).toBe(frozen.snapshot.customerFacingFeeCents);
    expect(JSON.stringify(report)).not.toContain('9999');
  });

  it('keeps the frozen dollars on an open invoice after the platform fee changes', () => {
    const frozen = freezeFeeSnapshot({
      completion: {},
      quoteCents: 100000,
      livePlatformFeeCents: 1000,
      now: NOW,
    });
    expect(frozen.ok).toBe(true);
    if (!frozen.ok) return;
    const bill = billFromFrozenFee(100000, frozen.snapshot.customerFacingFeeCents);
    expect(frozenCustomerFeeUsd(frozen.completion, 1000)).toBe(bill.serviceFee);
    expect(frozenCustomerFeeUsd(frozen.completion, 1100)).toBeUndefined();
    expect(bill.serviceFee).not.toBe(customerFacingServiceFeeCents(100000, 2500) / 100);
    expect(frozen.completion[FEE_SNAPSHOT_KEY]).toBe(frozen.snapshot);
  });
});

describe('in-person fee screens read stored lines', () => {
  const root = join(__dirname, '..');

  it('does not read the live platform fee when a job is marked paid in person', () => {
    const pay = readFileSync(join(root, 'src/app/api/workorders/[id]/pay/route.ts'), 'utf8');
    const counter = readFileSync(join(root, 'src/lib/books/counterPay.ts'), 'utf8');
    expect(pay).not.toContain('getConfiguredPlatformServiceFeeUsd');
    expect(pay).not.toContain('getPlatformServiceFeeUsd');
    expect(pay).toContain('planCounterPayment');
    expect(counter).toContain('readCheckoutFeeForInPerson');
    expect(counter).toContain('customerFacingFeeCents');
  });

  it('lists each open work order on shop books and fee year-end', () => {
    const books = readFileSync(join(root, 'src/components/ShopBooksScreen.tsx'), 'utf8');
    const year = readFileSync(join(root, 'src/app/admin/fee-year-end/page.tsx'), 'utf8');
    expect(books).toContain('week.openLines');
    expect(books).toContain('Work order');
    expect(books).toContain('still open');
    expect(year).toContain('inPersonLines');
    expect(year).toContain('work order');
  });
});
