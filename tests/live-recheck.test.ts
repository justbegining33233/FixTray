import { billWithServiceFee } from '../src/lib/serviceFeeBill';
import { matchingEstimateBill } from '../src/lib/customerLedger';
import { staffStatusWords } from '../src/lib/staffPresence';
import { teamRowsFromEmployeePerformance } from '../src/lib/teamPerformanceSource';
import { FIXTRAY_SHOP_PARTICIPATION_AGREEMENT } from '../src/lib/fixtrayShopParticipationAgreement';
import { AGREEMENT_PLACEHOLDER, FEE_SCHEDULE_REFERENCE, renderParticipationAgreement } from '../src/lib/participationAgreement';
import { maySeeAggregatePlatformFee, maySeePerJobPlatformFee } from '../src/lib/staffMoneyAccess';

describe('live re-check', () => {
  it('shows the same per-job fee and customer total as the estimates list', () => {
    const savedFeeUsd = 10;
    const fifty = billWithServiceFee(49.99, savedFeeUsd);
    const ninety = billWithServiceFee(89.99, savedFeeUsd);
    expect(fifty.serviceFee).toBe(12.1);
    expect(fifty.total).toBe(62.09);
    expect(ninety.total).toBe(103.29);

    const detail = matchingEstimateBill({
      estimatedCost: 49.99,
      lineItemTotal: 49.99,
      estimateBill: fifty,
      platformFeeUsd: 0,
    });
    expect(detail.serviceFee).toBe(fifty.serviceFee);
    expect(detail.total).toBe(fifty.total);

    const fallback = matchingEstimateBill({
      estimatedCost: 89.99,
      lineItemTotal: 89.99,
      platformFeeUsd: savedFeeUsd,
    });
    expect(fallback).toEqual(ninety);
  });

  it('keeps aggregate fee totals with the shop owner', () => {
    expect(maySeePerJobPlatformFee('manager')).toBe(true);
    expect(maySeePerJobPlatformFee('tech')).toBe(true);
    expect(maySeeAggregatePlatformFee('manager')).toBe(false);
    expect(maySeeAggregatePlatformFee('tech')).toBe(false);
    expect(maySeeAggregatePlatformFee('shop')).toBe(true);
  });

  it('does not treat an assigned job as a live clock', () => {
    const assignedButOff = staffStatusWords({ clockedIn: false, onJob: true });
    expect(assignedButOff.clock).toBe('Off');
    expect(assignedButOff.job).toBe('On job');

    const clockedOnJob = staffStatusWords({ clockedIn: true, onJob: true });
    expect(clockedOnJob.clock).toBe('Clocked in');
    expect(clockedOnJob.job).toBe('On job');

    const clockedOnly = staffStatusWords({ clockedIn: true, onJob: false });
    expect(clockedOnly.clock).toBe('Clocked in');
    expect(clockedOnly.job).toBe('Available');
  });

  it('reads team performance from the employee analytics roster', () => {
    const fromAnalytics = teamRowsFromEmployeePerformance({
      techPerformance: [
        { techId: 't1', name: 'Alex Tech', completedJobs: 1, hoursWorked: 2, completionRate: 50, revenue: 40 },
        { techId: 't2', name: 'Blair Manager', completedJobs: 0, hoursWorked: 0, completionRate: 0, revenue: 0 },
      ],
    });
    expect(fromAnalytics).toHaveLength(2);
    expect(teamRowsFromEmployeePerformance({ performance: [{ id: 't1', name: 'Alex Tech' }] })).toEqual([]);
  });

  it('never leaves a bracket placeholder in a rendered agreement', () => {
    expect(FIXTRAY_SHOP_PARTICIPATION_AGREEMENT).toMatch(AGREEMENT_PLACEHOLDER);
    const rendered = renderParticipationAgreement(FIXTRAY_SHOP_PARTICIPATION_AGREEMENT, {
      shopName: 'Week Sim',
      entityType: 'LLC',
      address: '1 Main',
      city: 'Columbia',
      state: 'SC',
      zipCode: '29201',
      email: 'owner@example.com',
      signedBy: 'Owner Name',
      signedAt: '2026-10-11T00:00:00.000Z',
      ownerTitle: 'Owner',
    });
    expect(rendered.text).not.toMatch(AGREEMENT_PLACEHOLDER);
    expect(rendered.text).toContain(FEE_SCHEDULE_REFERENCE);
    expect(rendered.text).not.toMatch(/\$\d/);
    expect(rendered.text).toContain('Owner');
    expect(rendered.text).toContain('1 Main, Columbia, SC, 29201');
  });
});
