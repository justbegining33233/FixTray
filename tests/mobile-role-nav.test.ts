import {
  MOBILE_ROLE_NAVS,
  allMobileNavHrefs,
  isSuperAdminActor,
  mobileNavForActor,
} from '../src/lib/mobileRoleNav';
import { isShopScopedPath } from '../src/lib/platformOwnerScope';
import { isShopEdgeSensitivePath } from '../src/lib/shopRestrictedRoutes';
import { menuHrefs, type MenuRole } from '../src/lib/roleMenus';

describe('mobile role tabs', () => {
  it('uses the approved primary labels', () => {
    expect(MOBILE_ROLE_NAVS.superadmin.tabs.map((tab) => tab.label)).toEqual(['Overview', 'Shops', 'Customers', 'Analytics']);
    expect(MOBILE_ROLE_NAVS.shop.tabs.map((tab) => tab.label)).toEqual(['Home', 'Orders', 'Messages', 'Team']);
    expect(MOBILE_ROLE_NAVS.manager.tabs.map((tab) => tab.label)).toEqual(['Home', 'Assign', 'Team', 'Messages']);
    expect(MOBILE_ROLE_NAVS.tech.tabs.map((tab) => tab.label)).toEqual(['Home', 'My Jobs', 'Clock', 'Messages']);
    expect(MOBILE_ROLE_NAVS.customer.tabs.map((tab) => tab.label)).toEqual(['Home', 'Appts', 'Repairs', 'Chat']);
  });

  it('shows Super Admin tabs only to a superadmin', () => {
    expect(mobileNavForActor('admin', { role: 'shop' })).toBeNull();
    expect(mobileNavForActor('admin', { role: 'manager' })).toBeNull();
    expect(mobileNavForActor('admin', { role: 'tech' })).toBeNull();
    expect(mobileNavForActor('admin', { role: 'customer' })).toBeNull();
    expect(mobileNavForActor('admin', { role: 'admin', isSuperAdmin: false })).toBeNull();
    expect(mobileNavForActor('superadmin', { role: 'shop' })).toBeNull();
    expect(isSuperAdminActor({ role: 'admin', isSuperAdmin: false })).toBe(false);

    const byRole = mobileNavForActor('admin', { role: 'superadmin' });
    const byFlag = mobileNavForActor('superadmin', { role: 'admin', isSuperAdmin: true });
    expect(byRole?.id).toBe('superadmin');
    expect(byFlag?.tabs.map((tab) => tab.label)).toEqual(['Overview', 'Shops', 'Customers', 'Analytics']);
    expect(mobileNavForActor('shop', { role: 'customer' })?.id).toBe('shop');
  });

  it('shows owner tools only to the platform owner, and hides offline and duplicate homes', () => {
    const labels = (isOwner: boolean) =>
      mobileNavForActor('admin', { role: 'superadmin', isOwner })?.more.flatMap((group) => group.items.map((item) => item.label)) || [];
    expect(labels(true)).toContain('Owner Tools');
    expect(labels(false)).not.toContain('Owner Tools');
    const hrefs = allMobileNavHrefs(MOBILE_ROLE_NAVS.superadmin);
    expect(hrefs.filter((href) => href.startsWith('/admin/owner'))).toEqual(['/admin/owner']);
    expect(hrefs).not.toContain('/tech-offline');
    expect(hrefs).not.toContain('/admin');
    expect(hrefs).not.toContain('/superadmin');
    expect(hrefs.filter((href) => href.includes('security'))).toEqual(['/admin/security']);
  });

  it.each(['superadmin', 'shop', 'manager', 'tech', 'customer'] as const)('%s app menu hrefs match the web menu', (roleId: MenuRole) => {
    expect(allMobileNavHrefs(MOBILE_ROLE_NAVS[roleId]).slice().sort()).toEqual(menuHrefs(roleId).slice().sort());
  });

  it('lists only platform pages for the platform owner', () => {
    const nav = mobileNavForActor('admin', { role: 'superadmin', isSuperAdmin: true, isOwner: true });
    const hrefs = nav ? allMobileNavHrefs(nav) : [];
    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs.filter((href) => isShopScopedPath(href))).toEqual([]);
    const labels = [
      ...(nav?.tabs.map((tab) => tab.label) ?? []),
      ...(nav?.more.flatMap((group) => group.items.map((item) => item.label)) ?? []),
    ];
    for (const shopLabel of ['Offline', 'DVI Approvals', 'Compliance', 'Inventory', 'Environmental Fees', 'Campaigns', 'Performance', 'Command Center', 'Security Settings', 'Platform Security', 'Platform Home', 'Admin Home']) {
      expect(labels).not.toContain(shopLabel);
    }
    expect(labels).toEqual(expect.arrayContaining(['Shop Approvals', 'Shops', 'Users', 'Platform Settings', 'Revenue & Payouts', 'Health', 'Activity Logs', 'Messaging']));
    expect(labels.filter((label) => label === 'Profile' || label === 'My Profile' || label === 'Platform Profile')).toEqual(['Profile']);
    expect(labels.filter((label) => label === 'Command Center' || label === 'Platform Home' || label === 'Admin Home' || label === 'Dashboard')).toEqual([]);
    expect(hrefs.filter((href) => href === '/admin/home')).toEqual(['/admin/home']);
  });

  it('keeps shop edge pages and the offline app off shop, manager, and customer menus', () => {
    expect(allMobileNavHrefs(MOBILE_ROLE_NAVS.shop)).not.toContain('/tech-offline');
    expect(allMobileNavHrefs(MOBILE_ROLE_NAVS.shop).filter((href) => isShopEdgeSensitivePath(href))).toEqual([]);
    expect(allMobileNavHrefs(MOBILE_ROLE_NAVS.manager)).not.toContain('/tech-offline');
    expect(allMobileNavHrefs(MOBILE_ROLE_NAVS.customer)).not.toContain('/tech-offline');
    expect(allMobileNavHrefs(MOBILE_ROLE_NAVS.tech)).toContain('/tech-offline');
    expect(mobileNavForActor('shop', { role: 'shop' })).toBe(MOBILE_ROLE_NAVS.shop);
    expect(mobileNavForActor('tech', { role: 'tech' })).toBe(MOBILE_ROLE_NAVS.tech);
    expect(mobileNavForActor('customer', { role: 'customer' })).toBe(MOBILE_ROLE_NAVS.customer);
    expect(mobileNavForActor('manager', { role: 'manager' })).toBe(MOBILE_ROLE_NAVS.manager);
  });
});
