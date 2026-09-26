import { NextRequest } from 'next/server';
import { generateAccessToken } from '../src/lib/auth';
import { PLATFORM_HOME, isPlatformActor, isShopScopedPath, platformOwnerRedirect } from '../src/lib/platformOwnerScope';
import { roleDeniedRedirect } from '../src/lib/roleNav';
import { gateCrossRole, requestHeadersWithNativePlatform } from '../src/proxy';

describe('platform owner scope', () => {
  it('treats admin login roles as the platform owner and nobody else', () => {
    expect(isPlatformActor({ role: 'superadmin' })).toBe(true);
    expect(isPlatformActor({ role: 'admin', isOwner: true })).toBe(true);
    for (const role of ['shop', 'manager', 'tech', 'customer']) {
      expect(isPlatformActor({ role, isSuperAdmin: true, isOwner: true })).toBe(false);
    }
  });

  it.each([
    '/shop/dvi', '/shop/jobs', '/shop/inventory', '/shop/home', '/shop/profile', '/shop/manage-team',
    '/tech/home', '/tech/my-shifts', '/manager/admin', '/manager/schedule', '/customer/features',
    '/workorders', '/workorders/new', '/reports', '/tech-offline/', '/tech-offline/index.html',
    '/admin/dvi-approvals', '/admin/inventory', '/admin/environmental-fees', '/admin/compliance-dashboard',
    '/admin/campaigns', '/admin/performance',
  ])('sends the platform owner home from %s', (path) => {
    expect(platformOwnerRedirect(path, { role: 'superadmin' })).toBe(PLATFORM_HOME);
    expect(roleDeniedRedirect(path, 'superadmin')).toBe(PLATFORM_HOME);
  });

  it.each([
    '/admin/home', '/admin/pending-shops', '/admin/shops', '/admin/manage-shops', '/admin/user-management',
    '/admin/settings', '/admin/revenue', '/admin/test', '/admin/activity-logs', '/admin/messaging',
    '/superadmin/users', '/superadmin/settings',
  ])('keeps the platform owner on %s', (path) => {
    expect(isShopScopedPath(path)).toBe(false);
    expect(platformOwnerRedirect(path, { role: 'superadmin' })).toBeNull();
  });

  it('redirects a signed-in platform owner at the edge and leaves everyone else', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'platform-owner-scope-test-secret';
    const owner = generateAccessToken({ id: 'owner-1', username: 'supadm1006', role: 'superadmin', isOwner: true });
    const storedAdmin = generateAccessToken({ id: 'owner-2', username: 'supadm1006', role: 'admin', isOwner: true });
    const shop = generateAccessToken({ id: 'shop-1', role: 'shop' });

    for (const token of [owner, storedAdmin]) {
      for (const path of ['/shop/profile', '/manager/admin', '/tech/home', '/customer/features', '/reports', '/tech-offline/', '/admin/dvi-approvals']) {
        const gate = await gateCrossRole(new NextRequest(`http://localhost${path}`, {
          headers: { cookie: `sos_auth=${token}` },
        }));
        expect(gate?.status).toBe(307);
        expect(gate?.headers.get('location')).toBe('http://localhost/admin/home');
      }
    }

    const shopGate = await gateCrossRole(new NextRequest('http://localhost/shop/reports', {
      headers: { cookie: `sos_auth=${shop}` },
    }));
    expect(shopGate).toBeNull();

    const offlineTech = await gateCrossRole(new NextRequest('http://localhost/tech-offline/', {
      headers: { cookie: `sos_auth=${shop}` },
    }));
    expect(offlineTech).toBeNull();

    const anonymous = await gateCrossRole(new NextRequest('http://localhost/tech-offline/'));
    expect(anonymous).toBeNull();

    const forbidden = await gateCrossRole(new NextRequest('http://localhost/admin/user-management', {
      headers: { cookie: `sos_auth=${shop}` },
    }));
    expect(forbidden?.headers.get('x-middleware-rewrite') || '').toContain('/forbidden');

    const kept = await gateCrossRole(new NextRequest('http://localhost/admin/user-management', {
      headers: { cookie: `sos_auth=${owner}` },
    }));
    expect(kept).toBeNull();
  });

  it('forwards the Android app cookie so the phone shell stays on at tablet width', () => {
    const headers = requestHeadersWithNativePlatform(new NextRequest('http://localhost/admin/home', {
      headers: { cookie: 'x-fixtray-native=android', 'user-agent': 'Mozilla/5.0' },
    }));
    expect(headers.get('x-fixtray-native')).toBe('android');
    const fromUa = requestHeadersWithNativePlatform(new NextRequest('http://localhost/admin/home', {
      headers: { 'user-agent': 'FixTray-Android-App-Pro' },
    }));
    expect(fromUa.get('x-fixtray-native')).toBe('android');
    const browser = requestHeadersWithNativePlatform(new NextRequest('http://localhost/admin/home', {
      headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile' },
    }));
    expect(browser.get('x-fixtray-native')).toBeNull();
  });

  it('never redirects shop, manager, tech, or customer users', () => {
    expect(platformOwnerRedirect('/shop/dvi', { role: 'shop' })).toBeNull();
    expect(platformOwnerRedirect('/manager/schedule', { role: 'manager' })).toBeNull();
    expect(platformOwnerRedirect('/tech/home', { role: 'tech' })).toBeNull();
    expect(platformOwnerRedirect('/customer/dashboard', { role: 'customer' })).toBeNull();
    expect(roleDeniedRedirect('/admin/pending-shops', 'shop')).toBe('/forbidden?from=%2Fadmin%2Fpending-shops');
    expect(roleDeniedRedirect('/shop/dvi', 'manager')).toBe('/manager/inspections');
  });
});
