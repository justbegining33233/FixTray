import { describe, it, expect } from '@jest/globals';
import {
  actorRoleForShell,
  managerShopRedirect,
  roleDeniedRedirect,
  roleFromAccessToken,
  shellHrefForRole,
  SHOP_JOBS_HREF,
} from '../src/lib/roleNav';
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
    expect(shellHrefForRole('/shop/home', 'Manager')).toBe('/manager/dashboard');
    expect(portalDashboardHref('manager')).toBe('/manager/home');
  });

  it('sends the four shop-switch targets to manager pages instead of forbidden', () => {
    expect(managerShopRedirect('/shop/home', 'manager')).toBe('/manager/dashboard');
    expect(managerShopRedirect('/shop/estimates', 'manager')).toBe('/manager/estimates');
    expect(managerShopRedirect('/shop/dvi', 'manager')).toBe('/manager/inspections');
    expect(managerShopRedirect('/shop/work-authorizations', 'manager')).toBe('/manager/work-authorizations');
    expect(managerShopRedirect('/shop/jobs', 'manager')).toBe('/manager/assignments');
    expect(roleDeniedRedirect('/shop/home', 'manager')).toBe('/manager/dashboard');
    expect(roleDeniedRedirect('/shop/estimates', 'manager')).toBe('/manager/estimates');
    expect(roleDeniedRedirect('/shop/dvi', 'manager')).toBe('/manager/inspections');
    expect(roleDeniedRedirect('/shop/work-authorizations', 'manager')).toBe('/manager/work-authorizations');
  });

  it('leaves shop, tech, calendar, and roadside on their own pages', () => {
    expect(managerShopRedirect('/shop/home', 'shop')).toBeNull();
    expect(managerShopRedirect('/shop/estimates', 'tech')).toBeNull();
    expect(managerShopRedirect('/shop/calendar', 'manager')).toBeNull();
    expect(managerShopRedirect('/shop/new-roadside-job', 'manager')).toBeNull();
    expect(managerShopRedirect('/shop/new-inshop-job', 'manager')).toBeNull();
    expect(roleDeniedRedirect('/shop/settings', 'manager')).toBe('/forbidden?from=%2Fshop%2Fsettings');
    expect(roleDeniedRedirect('/shop/home', 'tech')).toBe('/forbidden?from=%2Fshop%2Fhome');
    expect(actorRoleForShell({ tokenRole: 'manager', userRole: 'shop', shellRole: 'shop' })).toBe('manager');
    expect(actorRoleForShell({ userRole: 'shop', shellRole: 'shop' })).toBe('shop');
    const token = `x.${Buffer.from(JSON.stringify({ role: 'manager' })).toString('base64url')}.y`;
    expect(roleFromAccessToken(token)).toBe('manager');
  });
});
