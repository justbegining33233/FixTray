import fs from 'fs';
import path from 'path';
import {
  MOBILE_ROLE_NAVS,
  allMobileNavHrefs,
  hrefPath,
  isSuperAdminActor,
  mobileNavForActor,
  pageCoveredByNav,
} from '../src/lib/mobileRoleNav';

const APP = path.join(process.cwd(), 'src/app');

function staticPages(roleDir: string): string[] {
  const root = path.join(APP, roleDir);
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.name !== 'page.tsx') continue;
      const route = full.slice(APP.length).replace(/\/page\.tsx$/, '').replace(/\\/g, '/') || '/';
      if (route.endsWith('/login') || route.includes('[')) continue;
      found.push(route);
    }
  };
  walk(root);
  return found.sort();
}

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

  it.each([
    ['superadmin', ['admin', 'superadmin']],
    ['shop', ['shop']],
    ['manager', ['manager']],
    ['tech', ['tech']],
    ['customer', ['customer']],
  ] as const)('covers every static %s page from tabs + More', (roleId, dirs) => {
    const hrefs = allMobileNavHrefs(MOBILE_ROLE_NAVS[roleId]).map(hrefPath);
    const pages = dirs.flatMap(staticPages);
    const missing = pages.filter((page) => !pageCoveredByNav(page, hrefs));
    expect(missing).toEqual([]);
  });
});
