import { describe, expect, it } from '@jest/globals';
import { customerChargeDisplay, customerLedgerSummary } from '../src/lib/customerLedger';

describe('customer insights and payments use the same payment records', () => {
  it('does not add the live fee on top of a recorded $1.08 payment', () => {
    const orders = [
      {
        id: 'paid',
        status: 'completed',
        paymentStatus: 'paid',
        estimatedCost: 1.08,
        amountPaid: 1.08,
      },
      {
        id: 'open',
        status: 'waiting-for-payment',
        paymentStatus: 'unpaid',
        estimatedCost: 13.5,
        amountPaid: null,
      },
    ];

    const ledger = customerLedgerSummary(orders, 10);
    expect(ledger.totalSpent).toBe(1.08);
    expect(ledger.totalPaid).toBe(1.08);
    expect(ledger.paidCount).toBe(1);
    expect(ledger.servicesCompleted).toBe(1);
    expect(ledger.totalPending).toBe(24.51);
    expect(ledger.pendingCount).toBe(1);

    const paid = customerChargeDisplay(orders[0], 10);
    expect(paid.amount).toBe(1.08);
    expect(paid.fixtrayFee).toBe(0);
    expect(paid.amount).not.toBe(11.72);

    const open = customerChargeDisplay(orders[1], 10);
    expect(open.amount).toBe(24.51);
    expect(open.serviceCost).toBe(13.5);
    expect(open.fixtrayFee).toBe(11.01);
  });

  it('keeps a recorded charge that already includes the fee', () => {
    const order = {
      status: 'completed',
      paymentStatus: 'paid',
      estimatedCost: 1.08,
      amountPaid: 11.08,
    };
    const ledger = customerLedgerSummary([order], 10);
    expect(ledger.totalPaid).toBe(11.08);
    expect(ledger.totalSpent).toBe(11.08);
    expect(customerChargeDisplay(order, 10)).toEqual({
      amount: 11.08,
      serviceCost: 1.08,
      fixtrayFee: 10,
    });
    expect(customerChargeDisplay(order, 20).amount).toBe(11.08);
  });
});
