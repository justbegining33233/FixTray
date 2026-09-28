import fs from 'fs';
import path from 'path';
import { allMobileNavHrefs, MOBILE_ROLE_NAVS } from '../src/lib/mobileRoleNav';
import { isShopScopedPath } from '../src/lib/platformOwnerScope';
import {
  canOpenMenuPath,
  menuHrefs,
  menuRoleFor,
  portalAccessDecision,
  renderedMenuHrefs,
  roleHome,
  type MenuRole,
} from '../src/lib/roleMenus';

const MANAGER_SHOP_PAGES = [
  '/shop/automations',
  '/shop/campaigns',
  '/shop/condition-reports',
  '/shop/customers/cust-1/crm',
  '/shop/environmental-fees',
  '/shop/eod-report',
  '/shop/inspections',
  '/shop/loaners',
  '/shop/parts-labor',
  '/shop/photos',
  '/shop/purchase-orders-receiving',
  '/shop/team-performance',
  '/shop/calendar',
];

const APP = path.join(process.cwd(), 'src/app');

function staticPages(roleDir: string): string[] {
  const root = path.join(APP, roleDir);
  if (!fs.existsSync(root)) return [];
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

describe('role menus', () => {
  it.each(['superadmin', 'shop', 'manager', 'tech', 'customer'] as const)(
    '%s phone hrefs equal the computer menu',
    (role: MenuRole) => {
      expect(allMobileNavHrefs(MOBILE_ROLE_NAVS[role]).slice().sort()).toEqual(menuHrefs(role).slice().sort());
    },
  );

  it('renders the same hrefs in the computer sidebar', () => {
    expect(renderedMenuHrefs('shop', 'shop', false).slice().sort()).toEqual(menuHrefs('shop').slice().sort());
    expect(renderedMenuHrefs('manager', 'manager', false).slice().sort()).toEqual(menuHrefs('manager').slice().sort());
    expect(renderedMenuHrefs('tech', 'tech', false).slice().sort()).toEqual(menuHrefs('tech').slice().sort());
    expect(renderedMenuHrefs('admin', 'superadmin', true).slice().sort()).toEqual(menuHrefs('superadmin').slice().sort());
    expect(renderedMenuHrefs('superadmin', 'superadmin', true).slice().sort()).toEqual(menuHrefs('superadmin').slice().sort());
  });

  it('keeps the job pages that were only on the phone', () => {
    expect(menuHrefs('manager')).toEqual(expect.arrayContaining([
      '/manager/approvals',
      '/manager/schedule',
      '/manager/leave-requests',
      '/manager/assignments',
      '/manager/inspections',
      '/manager/reports',
    ]));
    expect(menuHrefs('tech')).toEqual(expect.arrayContaining([
      '/tech/timesheet',
      '/tech/leave-requests',
      '/tech-offline',
    ]));
    expect(menuHrefs('superadmin')).toEqual(expect.arrayContaining([
      '/admin/pending-shops',
      '/admin/accepted-shops',
      '/admin/test',
      '/admin/revenue',
      '/superadmin/profile',
    ]));
  });

  it('sends managers home from shop pages that are not in their menu', () => {
    for (const page of MANAGER_SHOP_PAGES) {
      expect(portalAccessDecision(page, 'manager')).toBe('home');
      expect(roleHome('manager')).toBe('/manager/home');
    }
  });

  it('sends each role home from pages outside its menu', () => {
    expect(portalAccessDecision('/shop/calendar', 'tech')).toBe('home');
    expect(roleHome('tech')).toBe('/tech/home');
    for (const role of ['shop', 'manager', 'tech', 'customer'] as const) {
      expect(portalAccessDecision('/reports', role)).toBe('home');
      expect(portalAccessDecision('/reports', role)).not.toBe('forbidden');
    }
    expect(portalAccessDecision('/superadmin/dashboard', 'superadmin')).toBe('home');
    expect(portalAccessDecision('/admin/security-settings', 'superadmin')).toBe('home');
    expect(portalAccessDecision('/admin/command-center', 'superadmin')).toBe('home');
    expect(portalAccessDecision('/admin', 'superadmin')).toBe('home');
    expect(portalAccessDecision('/superadmin', 'superadmin')).toBe('home');
    expect(portalAccessDecision('/customer/features', 'customer')).toBe('home');
    expect(portalAccessDecision('/customer/addresses', 'customer')).toBe('home');
    expect(portalAccessDecision('/tech-offline', 'shop')).toBe('home');
    expect(portalAccessDecision('/tech-offline', 'manager')).toBe('home');
    expect(roleHome('shop')).toBe('/shop/admin');
    expect(roleHome('customer')).toBe('/customer/dashboard');
    expect(roleHome('superadmin')).toBe('/admin/home');
  });

  it('still opens children, work-order details, and personal pages', () => {
    expect(portalAccessDecision('/workorders/wo-1', 'shop')).toBe('allow');
    expect(portalAccessDecision('/workorders/wo-1', 'manager')).toBe('allow');
    expect(portalAccessDecision('/workorders/wo-1', 'tech')).toBe('allow');
    expect(portalAccessDecision('/shop/fleet/fleet-1', 'shop')).toBe('allow');
    expect(portalAccessDecision('/shop/settings/two-factor', 'shop')).toBe('allow');
    expect(portalAccessDecision('/manager/schedule/new', 'manager')).toBe('allow');
    expect(portalAccessDecision('/tech/leave-requests/new', 'tech')).toBe('allow');
    expect(portalAccessDecision('/customer/notifications', 'customer')).toBe('allow');
    expect(portalAccessDecision('/customer/appointments/new', 'customer')).toBe('allow');
    expect(portalAccessDecision('/admin/shops/shop-1', 'superadmin')).toBe('allow');
    expect(portalAccessDecision('/admin/shop-details/shop-1', 'superadmin')).toBe('allow');
    expect(canOpenMenuPath('tech', '/shop/calendar')).toBe(false);
  });

  it('keeps /admin as forbidden for shop, manager, tech, and customer', () => {
    for (const role of ['shop', 'manager', 'tech', 'customer'] as const) {
      expect(portalAccessDecision('/admin/user-management', role)).toBe('forbidden');
      expect(portalAccessDecision('/admin/home', role)).toBe('forbidden');
    }
  });

  it('sends the platform owner home from shop-scoped pages', () => {
    expect(portalAccessDecision('/shop/home', 'superadmin')).toBe('home');
    expect(portalAccessDecision('/reports', 'superadmin')).toBe('home');
    expect(portalAccessDecision('/tech-offline', 'superadmin')).toBe('home');
    expect(isShopScopedPath('/admin/dvi-approvals')).toBe(true);
    expect(portalAccessDecision('/admin/dvi-approvals', 'superadmin')).toBe('home');
  });

  it.each([
    ['shop', ['shop']],
    ['manager', ['manager']],
    ['tech', ['tech']],
    ['customer', ['customer']],
    ['superadmin', ['admin', 'superadmin']],
  ] as const)('matches the menu rule for every static %s page', (role, dirs) => {
    const menuRole = menuRoleFor(role);
    expect(menuRole).toBe(role);
    for (const page of dirs.flatMap(staticPages)) {
      const decision = portalAccessDecision(page, role);
      if (role === 'superadmin' && isShopScopedPath(page)) {
        expect(decision).toBe('home');
        continue;
      }
      expect(decision).toBe(canOpenMenuPath(menuRole as MenuRole, page) ? 'allow' : 'home');
    }
  });
});
