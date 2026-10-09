import {
  mayListPaymentLinks,
  mayReadPayrollRates,
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

  it('drops the FixTray fee from a manager work-order payload, including the snapshot', () => {
    const payload = redactPlatformFeeForRole('manager', {
      id: 'wo-1',
      estimatedCost: 100,
      fixtrayServiceFee: 10,
      completion: { fixtrayFeeSnapshot: { customerFacingFeeCents: 1000, quoteCents: 10000, platformFeeCents: 500, frozenAt: '2026-01-01' }, note: 'keep' },
      estimateBill: { subtotal: 100, serviceFee: 10, total: 110 },
    });
    expect(payload.fixtrayServiceFee).toBeUndefined();
    expect(payload.estimateBill).toEqual({ subtotal: 100, serviceFee: 0, fixtrayFee: 0, total: 100 });
    expect(payload.completion).toEqual({ note: 'keep' });
    expect(redactPlatformFeeForRole('shop', { fixtrayServiceFee: 10 }).fixtrayServiceFee).toBe(10);
  });

  it('shows a manager only the job amount on an invoice closeout', () => {
    const shown = presentCloseoutForRole('manager', {
      workOrder: { completion: { fixtrayFeeSnapshot: { customerFacingFeeCents: 1000 } } },
      invoice: { quoteAmount: 80, serviceFee: 10, totalDue: 90 },
      paymentLink: { token: 'pay-token', amount: 90, serviceFee: 10, url: '/customer/pay/pay-token' },
    });
    expect(shown.invoice).toEqual({ quoteAmount: 80, serviceFee: 0, totalDue: 80 });
    expect(shown.paymentLink?.amount).toBe(80);
    expect(shown.paymentLink?.token).toBe('pay-token');
    expect((shown.workOrder?.completion as { fixtrayFeeSnapshot?: unknown }).fixtrayFeeSnapshot).toBeUndefined();
    const owner = presentCloseoutForRole('shop', {
      invoice: { quoteAmount: 80, serviceFee: 10, totalDue: 90 },
    });
    expect(owner.invoice?.serviceFee).toBe(10);
  });
});
