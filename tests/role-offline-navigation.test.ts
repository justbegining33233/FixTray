import fs from 'fs';
import vm from 'vm';
import { ROLE_HOME } from '../src/lib/roleConfig';
import { SHOP_LEVEL_ADMIN_PATHS, SHOP_SCOPED_PREFIXES } from '../src/lib/platformOwnerScope';
import { menuHrefs, type MenuRole } from '../src/lib/roleMenus';

type AccessApi = {
  PAGE_CACHE: string;
  OFFLINE_DOCUMENT: string;
  SHOP_SCOPED_PREFIXES: string[];
  SHOP_LEVEL_ADMIN_PATHS: string[];
  decision: (pathname: string, role: string) => string;
  navigationTarget: (pathname: string, role: string, hasCachedPage: boolean) => string;
  pageCacheUrl: (origin: string, role: string, pathAndSearch: string, kind: string, userId: string) => string;
  sessionMarker: (origin: string, role: string, userId: string) => string;
  stablePath: (pathname: string, search: string) => string;
};

function loadAccess(): AccessApi {
  const source = fs.readFileSync('public/offline-access.js', 'utf8');
  const context = vm.createContext({ URLSearchParams });
  vm.runInContext(source, context);
  return (context as { FixTrayOfflineAccess: AccessApi }).FixTrayOfflineAccess;
}

const access = loadAccess();

function pathOnly(href: string): string {
  const path = href.split('?')[0].replace(/\/+$/, '');
  return path || '/';
}

describe('offline navigation by role', () => {
  const roles: MenuRole[] = ['superadmin', 'shop', 'manager', 'tech', 'customer'];

  it('keeps the same shop-scope lists the platform owner already uses', () => {
    expect(access.SHOP_SCOPED_PREFIXES).toEqual([...SHOP_SCOPED_PREFIXES]);
    expect(access.SHOP_LEVEL_ADMIN_PATHS).toEqual([...SHOP_LEVEL_ADMIN_PATHS]);
  });

  it('serves each role its own menu pages and the tech workspace only to techs', () => {
    for (const role of roles) {
      for (const href of menuHrefs(role)) {
        const path = pathOnly(href);
        const target = access.navigationTarget(path, role, true);
        if (role === 'tech') expect(target).toBe('tech-shell');
        else expect(target).toBe('cached-page');
        expect(access.navigationTarget(path, role, false)).not.toBe('cached-page');
      }
    }
    for (const href of menuHrefs('superadmin')) {
      expect(access.navigationTarget(pathOnly(href), 'admin', true)).toBe('cached-page');
    }
  });

  it('reloads each role home from cache, or the offline screen when that copy is missing', () => {
    expect(access.navigationTarget(ROLE_HOME.shop, 'shop', true)).toBe('cached-page');
    expect(access.navigationTarget(ROLE_HOME.shop, 'shop', false)).toBe('offline-screen');
    expect(access.navigationTarget(ROLE_HOME.manager, 'manager', true)).toBe('cached-page');
    expect(access.navigationTarget(ROLE_HOME.manager, 'manager', false)).toBe('offline-screen');
    expect(access.navigationTarget(ROLE_HOME.customer, 'customer', true)).toBe('cached-page');
    expect(access.navigationTarget(ROLE_HOME.customer, 'customer', false)).toBe('offline-screen');
    expect(access.navigationTarget(ROLE_HOME.superadmin, 'superadmin', true)).toBe('cached-page');
    expect(access.navigationTarget(ROLE_HOME.admin, 'admin', true)).toBe('cached-page');
    expect(access.navigationTarget(ROLE_HOME.admin, 'admin', false)).toBe('offline-screen');
    expect(access.navigationTarget(ROLE_HOME.tech, 'tech', false)).toBe('tech-shell');
  });

  it('does not open another role page just because a copy is on the device', () => {
    const blocked: Array<[string, string]> = [
      ['/admin', 'shop'],
      ['/admin/home', 'shop'],
      ['/admin/home', 'manager'],
      ['/admin/home', 'customer'],
      ['/admin/home', 'tech'],
      ['/customer/dashboard', 'shop'],
      ['/customer/dashboard', 'manager'],
      ['/customer/dashboard', 'superadmin'],
      ['/shop/payroll', 'superadmin'],
      ['/shop/payroll', 'admin'],
      ['/shop/payroll', 'customer'],
      ['/shop/admin', 'customer'],
      ['/manager/home', 'shop'],
      ['/tech/home', 'shop'],
      ['/tech-offline/', 'shop'],
      ['/tech-offline/', 'manager'],
      ['/tech-offline/', 'customer'],
      ['/tech-offline/', 'superadmin'],
      ['/tech-offline/', 'admin'],
      ['/shop/admin', ''],
      ['/tech/home', ''],
    ];
    for (const [path, role] of blocked) {
      expect(access.navigationTarget(path, role, true)).toBe('offline-screen');
      expect(access.decision(path, role)).not.toBe('cached');
    }
  });

  it('keeps page snapshots separated by role and user', () => {
    const origin = 'https://fixtray.app';
    const shopA = access.pageCacheUrl(origin, 'shop', '/shop/admin', 'doc', 'user-a');
    const shopB = access.pageCacheUrl(origin, 'shop', '/shop/admin', 'doc', 'user-b');
    const customer = access.pageCacheUrl(origin, 'customer', '/customer/dashboard', 'doc', 'user-c');
    const rsc = access.pageCacheUrl(origin, 'shop', '/shop/admin', 'rsc', 'user-a');
    expect(shopA).not.toBe(shopB);
    expect(shopA).not.toBe(customer);
    expect(shopA).not.toBe(rsc);
    expect(access.sessionMarker(origin, 'shop', 'user-a')).toBe(`${origin}/__fixtray_page__/shop/user-a?`);
    expect(shopA.startsWith(access.sessionMarker(origin, 'shop', 'user-a'))).toBe(true);
    expect(access.stablePath('/shop/admin/', '?tab=security&_rsc=1')).toBe('/shop/admin?tab=security');
    expect(access.PAGE_CACHE).toBe('fixtray-pages-v1');
    expect(access.OFFLINE_DOCUMENT).toBe('/offline.html');
  });
});

describe('offline screen copy', () => {
  const html = fs.readFileSync('public/offline.html', 'utf8');
  const notice = fs.readFileSync('src/components/OfflineNotice.tsx', 'utf8');
  const sw = fs.readFileSync('public/sw.js', 'utf8');
  const page = fs.readFileSync('src/app/offline/page.tsx', 'utf8');

  it('says You\'re Offline without the HTML entity', () => {
    for (const source of [html, notice]) {
      expect(source).toContain("You're Offline");
      expect(source).not.toContain('You&apos;re Offline');
      expect(source).toContain('Payments, approvals, estimates, and pay changes need a connection.');
      expect(source).not.toContain('/tech-offline');
      expect(source).not.toContain('Download for offline');
    }
    expect(page).toContain('OfflineNotice');
    expect(page).not.toContain('You&apos;re Offline');
    expect(sw).toContain('OFFLINE_DOCUMENT');
    expect(access.OFFLINE_DOCUMENT).toBe('/offline.html');
    expect(sw).toContain('fixtray-v10');
    expect(sw).toContain('navigationTarget');
    expect(sw).toContain('readSession');
    expect(sw).not.toContain("caches.match('/offline')");
    expect(html).toContain('window.location.reload()');
    for (const home of Object.values(ROLE_HOME)) {
      expect(html).toContain(home);
    }
  });
});
