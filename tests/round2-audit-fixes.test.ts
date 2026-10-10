import { outstandingArCents, outstandingArDollars, OUTSTANDING_DEFINITION } from '../src/lib/outstandingBalance';
import { customerMayTrackJob, TRACK_UNAVAILABLE_MESSAGE, locationShareIsLive } from '../src/lib/customerJobTracking';
import { techWageLabel, techClockStatusLabel, hourlyRateIsSet } from '../src/lib/techWage';
import { splitDirectory, directoryBadge, isCustomerRecord } from '../src/lib/tenantDirectory';
import { renderParticipationAgreement, SETTINGS_PROMPT } from '../src/lib/participationAgreement';
import { FIXTRAY_SHOP_PARTICIPATION_AGREEMENT } from '../src/lib/fixtrayShopParticipationAgreement';
import { customerFacingTechnician } from '../src/lib/customerTechnician';
import { openPunchLive, MAX_LIVE_SHIFT_MS } from '../src/lib/staffClock';
import { staffPunchMinutes } from '../src/lib/books/clocks';
import { remainingSetupSteps } from '../src/lib/shopSetupSteps';
import { shopMapEmptyMessage, SHOP_ADDRESS_PROMPT } from '../src/lib/shopAddressPrompt';
import { hidesAggregatePlatformFee, maySeePerJobPlatformFee } from '../src/lib/staffMoneyAccess';
import { hideManagerFeeOwed } from '../src/lib/books/money';
import { privateNoindexSources, isNoindexPath } from '../src/lib/searchIndexing';
import { portalAccessDecision } from '../src/lib/roleMenus';
import type { ShopJobFacts } from '../src/lib/books/truth';

function job(partial: Partial<ShopJobFacts> & Pick<ShopJobFacts, 'id'>): ShopJobFacts {
  return {
    invoiceCents: null,
    events: [],
    ...partial,
  };
}

describe('round 2 audit helpers', () => {
  it('uses the same invoiced AR for every outstanding screen', () => {
    const jobs = [
      job({
        id: 'invoiced',
        invoiceCents: 17296,
        events: [],
      }),
      job({
        id: 'estimate',
        invoiceCents: null,
        events: [{ id: 'e1', workOrderId: 'estimate', at: '2026-10-05T12:00:00.000Z', kind: 'payment', cents: 45145 }],
      }),
    ];
    expect(outstandingArCents(jobs)).toBe(17296);
    expect(outstandingArDollars(jobs)).toBe(172.96);
    expect(OUTSTANDING_DEFINITION).toMatch(/Invoiced amount still owed/);
    expect(OUTSTANDING_DEFINITION).toMatch(/Estimates/);
  });

  it('shows a tech their rate and clock status, and a prompt when the rate is unset', () => {
    expect(hourlyRateIsSet(28)).toBe(true);
    expect(hourlyRateIsSet(0)).toBe(false);
    expect(techWageLabel(28).text).toBe('$28.00/hr');
    expect(techWageLabel(null)).toEqual({ text: 'No hourly rate set yet. Ask your shop', unset: true });
    expect(techClockStatusLabel(true)).toBe('Active');
    expect(techClockStatusLabel(false)).toBe('Inactive');
  });

  it('splits tenants into shops, employees, and customers with badges', () => {
    const rows = [
      { kind: 'shop' as const, name: 'Week Sim' },
      { kind: 'employee' as const, role: 'manager', name: 'Maria' },
      { kind: 'employee' as const, role: 'tech', name: 'Tony' },
      { kind: 'customer' as const, name: 'Walk-in' },
    ];
    const split = splitDirectory(rows);
    expect(split.shops).toHaveLength(1);
    expect(split.employees).toHaveLength(2);
    expect(split.customers).toHaveLength(1);
    expect(isCustomerRecord('customer')).toBe(true);
    expect(isCustomerRecord('shop')).toBe(false);
    expect(directoryBadge('shop')).toBe('Shop');
    expect(directoryBadge('employee', 'accountant')).toBe('Accountant');
    expect(directoryBadge('customer')).toBe('Customer');
    expect(split.customers.every((row) => directoryBadge(row.kind) !== 'Shop')).toBe(true);
  });

  it('fills the participation agreement from saved shop settings', () => {
    const filled = renderParticipationAgreement(FIXTRAY_SHOP_PARTICIPATION_AGREEMENT, {
      shopName: 'Week Sim Test',
      entityType: 'LLC',
      address: '100 Week Sim Blvd',
      city: 'Columbia',
      state: 'SC',
      zipCode: '29201',
      email: 'owner@example.com',
      signedBy: 'Week Sim Test',
      signedAt: '2026-10-09T16:35:00.000Z',
    });
    expect(filled.text).not.toMatch(/\[STATE\]|\[ADDRESS\]|\[ENTITY TYPE\]|\[STATE\/COUNTRY\]/);
    expect(filled.text).toContain('FixTray, Inc. (FixTray)');
    expect(filled.text).toContain('Week Sim Test');
    expect(filled.text).toContain('LLC');
    expect(filled.text).toContain('100 Week Sim Blvd, Columbia, SC, 29201');
    expect(filled.missing).toEqual([]);

    const blank = renderParticipationAgreement(FIXTRAY_SHOP_PARTICIPATION_AGREEMENT, {});
    expect(blank.text).toContain(SETTINGS_PROMPT);
    expect(blank.missing.length).toBeGreaterThan(0);
  });

  it('tracks a roadside job or a live share, and explains the other cases', () => {
    expect(customerMayTrackJob({ serviceLocation: 'roadside' }).enabled).toBe(true);
    expect(customerMayTrackJob({ serviceLocation: 'in-shop', sharingLocation: true }).enabled).toBe(true);
    const blocked = customerMayTrackJob({ serviceLocation: 'in-shop' });
    expect(blocked.enabled).toBe(false);
    expect(blocked.reason).toBe(TRACK_UNAVAILABLE_MESSAGE);
    const now = new Date('2026-10-09T18:00:00.000Z');
    expect(locationShareIsLive('2026-10-09T17:40:00.000Z', now)).toBe(true);
    expect(locationShareIsLive('2026-10-09T16:00:00.000Z', now)).toBe(false);
  });

  it('does not count a shift older than 16 hours as a live clock', () => {
    const now = new Date('2026-10-09T18:00:00.000Z');
    const fresh = new Date(now.getTime() - 60 * 60 * 1000);
    const stale = new Date(now.getTime() - MAX_LIVE_SHIFT_MS - 60 * 1000);
    expect(openPunchLive(fresh, now)).toBe(true);
    expect(openPunchLive(stale, now)).toBe(false);
    expect(staffPunchMinutes({ clockIn: fresh }, now)).toBe(60);
    expect(staffPunchMinutes({ clockIn: stale }, now)).toBe(16 * 60);
  });

  it('names the customer-facing technician and hides a manager-only assignment', () => {
    expect(customerFacingTechnician({
      assigned: { firstName: 'Maria', lastName: 'Manager', role: 'manager' },
      punches: [{ firstName: 'Tony', lastName: 'Tech', role: 'tech', clockIn: '2026-10-09T17:00:00.000Z' }],
    })?.firstName).toBe('Tony');
    expect(customerFacingTechnician({
      assigned: { firstName: 'Maria', lastName: 'Manager', role: 'manager' },
    })).toBeNull();
  });

  it('lists unfinished setup steps and the missing shop-address prompt', () => {
    const left = remainingSetupSteps({ agreementAccepted: true, businessLicense: '', insurancePolicy: 'POL', stripeConnected: false });
    expect(left.map((step) => step.id)).toEqual(['license', 'stripe']);
    expect(shopMapEmptyMessage('missing-address')).toBe(SHOP_ADDRESS_PROMPT);
    expect(shopMapEmptyMessage('pinned')).toBeNull();
  });

  it('keeps per-job fee visible and aggregate fee totals owner-only', () => {
    expect(maySeePerJobPlatformFee('manager')).toBe(true);
    expect(maySeePerJobPlatformFee('tech')).toBe(true);
    expect(hidesAggregatePlatformFee('manager')).toBe(true);
    expect(hidesAggregatePlatformFee('tech')).toBe(true);
    expect(hidesAggregatePlatformFee('shop')).toBe(false);
    expect(hidesAggregatePlatformFee('superadmin')).toBe(false);
    const owed = hideManagerFeeOwed({
      owedCents: 5000,
      collectedCents: 1000,
      accruedCents: 5000,
      settledCents: 0,
      lines: [{ workOrderId: 'wo-1' }],
      openLines: [{ workOrderId: 'wo-1' }],
      week: { owedCents: 2500, lines: [{ workOrderId: 'wo-1' }], openLines: [], collectedCents: 0, accruedCents: 2500, settledCents: 0 },
    });
    expect(owed.owedCents).toBe(0);
    expect(owed.week?.owedCents).toBe(0);
    expect(owed.lines).toEqual([]);
    expect(owed.openLines).toEqual([]);
  });

  it('opens owner pages and customer tracking, and noindexes private paths', () => {
    expect(portalAccessDecision('/shop/bays', 'shop')).toBe('allow');
    expect(portalAccessDecision('/shop/calendar', 'shop')).toBe('allow');
    expect(portalAccessDecision('/shop/team-performance', 'shop')).toBe('allow');
    expect(portalAccessDecision('/shop/customers/cust-1/crm', 'shop')).toBe('allow');
    expect(portalAccessDecision('/shop/admin/employee/tech-1', 'shop')).toBe('allow');
    expect(portalAccessDecision('/workorders/new', 'shop')).toBe('allow');
    expect(portalAccessDecision('/customer/jobs/wo-1/track', 'customer')).toBe('allow');
    expect(portalAccessDecision('/shop/bays', 'manager')).toBe('home');
    expect(isNoindexPath('/auth/login')).toBe(true);
    expect(privateNoindexSources()).toEqual(expect.arrayContaining(['/shop', '/shop/:path*', '/api', '/api/:path*', '/auth', '/auth/:path*']));
    expect(privateNoindexSources().some((source) => source.startsWith('/tech-offline'))).toBe(false);
  });
});
