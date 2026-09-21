import { describe, it, expect } from '@jest/globals';
import { forbiddenFromPath, isRoleAllowed } from '../src/lib/roleAccess';
import { workOrderNotificationCopy } from '../src/lib/notificationCopy';
import { payableHours, timesheetBounds } from '../src/lib/timesheetPeriod';
import { serviceCategoryLabel } from '../src/lib/serviceCategoryLabel';
import { canConnectIntegration, integrationFieldsComplete } from '../src/lib/integrationConnect';
import { sendNowAppearance } from '../src/lib/campaignAction';
import { exclusiveActiveIndex } from '../src/lib/exclusiveTab';
import { GUESSED_SHOP_REDIRECTS } from '../src/lib/legacyShopRoutes';
import { normalizeDateRange } from '../src/lib/appointmentValidation';

describe('VIS-015 notification copy', () => {
  it('includes the short id and service when that data exists', () => {
    const copy = workOrderNotificationCopy({
      id: 'cmu39te40000310ga9fdrupxm',
      serviceType: 'Oil Change',
      customerName: 'Ada Customer',
      vehicle: 'Ford F-150',
    });
    expect(copy.title).toBe('New work order WO-9FDRUPXM: Oil Change');
    expect(copy.body).toContain('Ada Customer');
    expect(copy.body).toContain('Ford F-150');
  });

  it('does not invent a generic Service label', () => {
    expect(workOrderNotificationCopy({ id: 'abc12345' }).title).toBe('New work order WO-ABC12345');
    expect(workOrderNotificationCopy({ serviceType: 'Service' }).title).not.toContain(': Service');
    const status = workOrderNotificationCopy({
      id: 'abc12345',
      issueDescription: { symptoms: 'No start' },
      status: 'in-progress',
      kind: 'status',
    });
    expect(status.title).toContain('WO-ABC12345');
    expect(status.title).toContain('No start');
  });
});

describe('VIS-016 cross-role access', () => {
  it('rejects a customer on shop, tech, manager, and admin URLs', () => {
    expect(isRoleAllowed('/admin', 'customer')).toBe(false);
    expect(isRoleAllowed('/superadmin/users', 'customer')).toBe(false);
    expect(isRoleAllowed('/shop/board', 'customer')).toBe(false);
    expect(isRoleAllowed('/manager/board', 'customer')).toBe(false);
    expect(isRoleAllowed('/tech/jobs', 'customer')).toBe(false);
    expect(forbiddenFromPath('/tech/jobs')).toBe('/forbidden?from=%2Ftech%2Fjobs');
  });

  it('allows a role on its own prefix', () => {
    expect(isRoleAllowed('/customer/dashboard', 'customer')).toBe(true);
    expect(isRoleAllowed('/shop/home', 'shop')).toBe(true);
    expect(isRoleAllowed('/health', 'customer')).toBe(true);
  });
});

describe('VIS-026 integrations', () => {
  it('refuses Connect while the integration is disabled and until fields are filled', () => {
    expect(canConnectIntegration(false)).toBe(false);
    expect(canConnectIntegration(true)).toBe(true);
    expect(integrationFieldsComplete([{ k: 'clientId' }], { clientId: '  ' })).toBe(false);
    expect(integrationFieldsComplete([{ k: 'clientId' }], { clientId: 'abc' })).toBe(true);
  });
});

describe('VIS-035 exclusive tabs', () => {
  it('highlights only the first tab when two targets match', () => {
    const tabs = [
      { href: '/tech/dvi' },
      { href: '/tech/dvi' },
      { href: '/tech/photos' },
    ];
    expect(exclusiveActiveIndex(tabs, '/tech/dvi')).toBe(0);
    expect(exclusiveActiveIndex(tabs, '/tech/photos')).toBe(2);
    expect(exclusiveActiveIndex([{ href: '/tech/jobs' }, { href: '/tech/dvi' }], '/tech/jobs')).toBe(0);
  });
});

describe('VIS-037 / VIS-067 timesheet', () => {
  const now = new Date(2026, 8, 16, 15, 0, 0);

  it('uses one Sunday-Saturday label for the selected week', () => {
    const week = timesheetBounds('week', now);
    expect(week.start.getDay()).toBe(0);
    expect(week.end.getDay()).toBe(6);
    expect(week.label).toBe(`${week.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${week.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`);
    expect(week.start.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(week.end.getTime()).toBeGreaterThanOrEqual(now.getTime());
    const month = timesheetBounds('month', now);
    expect(month.start.getDate()).toBe(1);
    expect(month.end.getMonth()).toBe(8);
  });

  it('does not count an open entry as pay hours when the tech is not clocked in', () => {
    const openStart = new Date(2026, 8, 16, 12, 0, 0);
    const entries = [
      { clockIn: openStart.toISOString(), clockOut: new Date(2026, 8, 16, 14, 0, 0).toISOString(), hoursWorked: 2 },
      { clockIn: openStart.toISOString(), clockOut: null, hoursWorked: 0 },
    ];
    expect(payableHours(entries, { clockedIn: false, now })).toBe(2);
    expect(payableHours(entries, { clockedIn: true, now })).toBeGreaterThan(2);
  });
});

describe('VIS-044 service category copy', () => {
  it('labels stored keys and hides a category that repeats the service name', () => {
    expect(serviceCategoryLabel('gas')).toBe('Gas');
    expect(serviceCategoryLabel('small-engine')).toBe('Small engine');
    expect(serviceCategoryLabel('Oil Change', 'Oil Change')).toBe('');
    expect(serviceCategoryLabel('')).toBe('');
  });
});

describe('VIS-078 analytics range', () => {
  it('swaps a reversed range so the caller can explain it', () => {
    expect(normalizeDateRange('2026-10-01', '2026-09-01')).toEqual({
      start: '2026-09-01',
      end: '2026-10-01',
      reversed: true,
    });
    expect(normalizeDateRange('2026-09-01', '2026-10-01').reversed).toBe(false);
  });
});

describe('VIS-080 send now', () => {
  it('uses a muted style when sending is not allowed', () => {
    expect(sendNowAppearance(false).background).not.toBe('#22c55e');
    expect(sendNowAppearance(false).cursor).toBe('not-allowed');
    expect(sendNowAppearance(true).background).toBe('#22c55e');
  });
});

describe('VIS-103 guessed shop routes', () => {
  it('redirects billing and messages guesses to real pages', () => {
    expect(GUESSED_SHOP_REDIRECTS).toEqual(expect.arrayContaining([
      { source: '/shop/messages', destination: '/shop/customer-messages', permanent: false },
      { source: '/shop/settings/billing', destination: '/shop/subscribe', permanent: false },
    ]));
  });
});
