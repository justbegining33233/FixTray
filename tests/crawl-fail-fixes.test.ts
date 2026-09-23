import { describe, it, expect } from '@jest/globals';
import { shellHrefForRole, SHOP_JOBS_HREF } from '../src/lib/roleNav';
import { portalDashboardHref } from '../src/lib/portalHome';

describe('shop jobs nav', () => {
  it('opens a shop work-order list instead of a missing path', () => {
    expect(SHOP_JOBS_HREF).toBe('/shop/jobs');
    expect(shellHrefForRole('/shop/jobs', 'shop')).toBe('/shop/jobs');
    expect(shellHrefForRole('/tech/new-roadside-job', 'shop')).toBe('/shop/new-roadside-job');
    expect(shellHrefForRole('/tech/new-roadside-job', 'tech')).toBe('/tech/new-roadside-job');
  });
});

describe('manager shell destinations', () => {
  it('does not send calendar switch view or new roadside to shop or tech pages that 403', () => {
    expect(shellHrefForRole('/shop/jobs', 'manager')).toBe('/manager/assignments');
    expect(shellHrefForRole('/shop/home', 'manager')).toBe('/manager/dashboard');
    expect(shellHrefForRole('/shop/estimates', 'manager')).toBe('/manager/estimates');
    expect(shellHrefForRole('/shop/dvi', 'manager')).toBe('/manager/inspections');
    expect(shellHrefForRole('/shop/work-authorizations', 'manager')).toBe('/manager/work-authorizations');
    expect(shellHrefForRole('/tech/new-roadside-job', 'manager')).toBe('/shop/new-roadside-job');
    expect(shellHrefForRole('/shop/new-inshop-job', 'manager')).toBe('/shop/new-inshop-job');
    expect(shellHrefForRole('/shop/calendar', 'manager')).toBe('/shop/calendar');
    expect(shellHrefForRole('/shop/customer-messages', 'manager')).toBe('/manager/messages');
    expect(shellHrefForRole('/shop/analytics', 'manager')).toBe('/manager/reports');
    expect(portalDashboardHref('manager')).toBe('/manager/home');
  });
});
