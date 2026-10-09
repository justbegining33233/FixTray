import {
  hidesAggregatePlatformFee,
  mayListPaymentLinks,
  mayReadPayrollRates,
  maySeeAggregatePlatformFee,
  maySeePerJobPlatformFee,
  maySettlePlatformFee,
  presentCloseoutForRole,
  redactPlatformFeeForRole,
} from '../src/lib/staffMoneyAccess';

describe('staff money access', () => {
  it('lets the owner and manager read payroll rates and invoice links', () => {
    expect(mayReadPayrollRates('shop')).toBe(true);
    expect(mayReadPayrollRates('manager')).toBe(true);
    expect(mayReadPayrollRates('tech')).toBe(false);
    expect(mayReadPayrollRates('superadmin')).toBe(false);
    expect(mayListPaymentLinks('tech')).toBe(false);
    expect(mayListPaymentLinks('manager')).toBe(true);
    expect(mayListPaymentLinks('customer')).toBe(false);
  });

  it('lets only the shop owner settle the platform fee', () => {
    expect(maySettlePlatformFee('shop')).toBe(true);
    expect(maySettlePlatformFee('manager')).toBe(false);
    expect(maySettlePlatformFee('tech')).toBe(false);
  });

  it('keeps the per-job FixTray fee and customer total for a manager and a tech', () => {
    const source = {
      id: 'wo-1',
      estimatedCost: 100,
      fixtrayServiceFee: 10,
      completion: { fixtrayFeeSnapshot: { customerFacingFeeCents: 1000, quoteCents: 10000, platformFeeCents: 500, frozenAt: '2026-01-01' }, note: 'keep' },
      estimateBill: { subtotal: 100, serviceFee: 10, total: 110 },
    };
    for (const role of ['manager', 'tech', 'shop'] as const) {
      const payload = redactPlatformFeeForRole(role, source);
      expect(maySeePerJobPlatformFee(role)).toBe(true);
      expect(payload.fixtrayServiceFee).toBe(10);
      expect(payload.estimateBill).toEqual({ subtotal: 100, serviceFee: 10, total: 110 });
      expect(payload.completion).toEqual(source.completion);
    }
    const hidden = redactPlatformFeeForRole('guest', source);
    expect(hidden.fixtrayServiceFee).toBeUndefined();
    expect(hidden.estimateBill).toEqual({ subtotal: 100, serviceFee: 0, fixtrayFee: 0, total: 100 });
  });

  it('shows the per-job fee on a manager closeout and hides aggregate fee totals', () => {
    const shown = presentCloseoutForRole('manager', {
      workOrder: { completion: { fixtrayFeeSnapshot: { customerFacingFeeCents: 1000 } } },
      invoice: { quoteAmount: 80, serviceFee: 10, totalDue: 90 },
      paymentLink: { token: 'pay-token', amount: 90, serviceFee: 10, url: '/customer/pay/pay-token' },
    });
    expect(shown.invoice).toEqual({ quoteAmount: 80, serviceFee: 10, totalDue: 90 });
    expect(shown.paymentLink?.amount).toBe(90);
    expect((shown.workOrder?.completion as { fixtrayFeeSnapshot?: unknown }).fixtrayFeeSnapshot).toEqual({ customerFacingFeeCents: 1000 });
    const tech = presentCloseoutForRole('tech', {
      invoice: { quoteAmount: 80, serviceFee: 10, totalDue: 90 },
    });
    expect(tech.invoice?.totalDue).toBe(90);
    expect(maySeeAggregatePlatformFee('shop')).toBe(true);
    expect(maySeeAggregatePlatformFee('admin')).toBe(true);
    expect(maySeeAggregatePlatformFee('superadmin')).toBe(true);
    expect(hidesAggregatePlatformFee('manager')).toBe(true);
    expect(hidesAggregatePlatformFee('tech')).toBe(true);
    expect(maySeeAggregatePlatformFee('manager')).toBe(false);
    expect(maySeeAggregatePlatformFee('tech')).toBe(false);
    expect(maySettlePlatformFee('manager')).toBe(false);
  });
});
