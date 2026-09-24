import { readFileSync } from 'fs';
import { describe, expect, it } from '@jest/globals';
import { NextRequest } from 'next/server';
import { generateAccessToken } from '../src/lib/auth';
import { actorSatisfiesRoles, isRouteAllowed } from '../src/lib/roleAccess';
import { gateCrossRole } from '../src/proxy';
import {
  formatShopCount,
  formatShopMoney,
  formatShopRating,
  normalizeShopDetails,
  shopDetailsMetrics,
} from '../src/lib/shopDetailsView';

const SHOP_ID = 'cmu39htty0005c3kp808c31h4';

describe('SA-001 shop details metrics', () => {
  it('maps the live /api/admin/shops/:id envelope onto totalWorkOrders', () => {
    const view = normalizeShopDetails({
      shop: {
        id: SHOP_ID,
        name: 'North Shop',
        ownerName: 'Ada',
        email: 'ada@shop.test',
        totalJobs: 4,
        completedJobs: 1,
        totalRevenue: 25,
        techCount: 2,
        rating: 4.5,
        stats: {
          totalWorkOrders: 4,
          completedWorkOrders: 1,
          totalRevenue: 25,
          technicians: 2,
          customers: 3,
          avgRating: 4.5,
        },
      },
    });

    expect(view?.id).toBe(SHOP_ID);
    expect(view?.shopName).toBe('North Shop');
    expect(view?.stats.totalWorkOrders).toBe(4);
    expect(view?.stats.customers).toBe(3);
    expect(formatShopCount(view?.stats.totalWorkOrders)).toBe('4');
    expect(formatShopMoney(view?.stats.totalRevenue)).toBe('$25');
    expect(formatShopRating(view?.stats.avgRating)).toBe('4.5');
  });

  it('uses job fields when stats is missing and defaults the rest to 0 or an em dash', () => {
    const envelope = {
      shop: {
        id: SHOP_ID,
        name: 'North Shop',
        totalJobs: 7,
        completedJobs: 2,
        totalRevenue: 80,
        techCount: 1,
      },
    };

    expect(() => (envelope as { shop: { stats?: { totalWorkOrders: number } } }).shop.stats!.totalWorkOrders).toThrow(TypeError);

    const view = normalizeShopDetails(envelope);
    const metrics = shopDetailsMetrics(view);
    expect(metrics.totalWorkOrders).toBe(7);
    expect(metrics.completedWorkOrders).toBe(2);
    expect(metrics.totalRevenue).toBe(80);
    expect(metrics.technicians).toBe(1);
    expect(metrics.customers).toBe(0);
    expect(formatShopCount(metrics.customers)).toBe('0');
    expect(formatShopMoney(metrics.totalRevenue)).toBe('$80');
    expect(formatShopRating(metrics.avgRating)).toBe('\u2014');
    expect(formatShopRating(shopDetailsMetrics(null).avgRating)).toBe('\u2014');
    expect(formatShopCount(shopDetailsMetrics({ stats: {} }).totalWorkOrders)).toBe('0');
    expect(formatShopMoney(undefined)).toBe('$0');
  });
});

describe('SA-002 owner access to /superadmin/tenants', () => {
  it('lets the owner and superadmin through a superadmin gate without elevating other roles', () => {
    expect(actorSatisfiesRoles({ role: 'admin', isOwner: true }, ['superadmin'])).toBe(true);
    expect(actorSatisfiesRoles({ role: 'admin', isSuperAdmin: true }, ['superadmin'])).toBe(true);
    expect(actorSatisfiesRoles({ role: 'superadmin' }, ['superadmin'])).toBe(true);
    expect(actorSatisfiesRoles({ role: 'admin' }, ['superadmin'])).toBe(false);
    expect(actorSatisfiesRoles({ role: 'customer', isOwner: true }, ['superadmin'])).toBe(false);
    expect(actorSatisfiesRoles({ role: 'shop', isSuperAdmin: true }, ['shop'])).toBe(true);
    expect(isRouteAllowed('/superadmin/tenants', { role: 'admin', isOwner: true })).toBe(true);
    expect(isRouteAllowed('/superadmin/tenants', { role: 'customer', isOwner: true })).toBe(false);
    expect(isRouteAllowed('/superadmin/users', 'customer')).toBe(false);
  });

  it('does not rewrite the owner to /forbidden', async () => {
    const token = generateAccessToken({
      id: 'owner-1',
      username: 'supadm1006',
      role: 'admin',
      isOwner: true,
      isSuperAdmin: false,
    });
    const request = new NextRequest('http://localhost/superadmin/tenants', {
      headers: { cookie: `sos_auth=${token}` },
    });

    expect(await gateCrossRole(request)).toBeNull();
  });

  it('still forbids a customer and a non-owner admin', async () => {
    const customer = generateAccessToken({ id: 'c-1', role: 'customer', isOwner: true });
    const admin = generateAccessToken({ id: 'a-1', username: 'staff', role: 'admin', isOwner: false, isSuperAdmin: false });

    const customerGate = await gateCrossRole(new NextRequest('http://localhost/superadmin/tenants', {
      headers: { cookie: `sos_auth=${customer}` },
    }));
    const adminGate = await gateCrossRole(new NextRequest('http://localhost/superadmin/tenants', {
      headers: { cookie: `sos_auth=${admin}` },
    }));

    expect(customerGate).not.toBeNull();
    expect(adminGate).not.toBeNull();
    expect(customerGate?.headers.get('x-middleware-rewrite') || '').toContain('/forbidden');
    expect(adminGate?.headers.get('x-middleware-rewrite') || '').toContain('/forbidden');
  });
});

describe('owner access to pending shops and user management', () => {
  const owner = { role: 'superadmin', isOwner: true, isSuperAdmin: false };
  const adminPages = ['/admin/pending-shops', '/admin/user-management'] as const;

  it('lets a superadmin role through an admin page gate without elevating other roles', () => {
    expect(actorSatisfiesRoles(owner, ['admin'])).toBe(true);
    expect(actorSatisfiesRoles({ role: 'superadmin' }, ['admin'])).toBe(true);
    expect(actorSatisfiesRoles({ role: 'admin', isOwner: true }, ['admin'])).toBe(true);
    expect(actorSatisfiesRoles({ role: 'admin' }, ['admin', 'superadmin'])).toBe(true);
    expect(actorSatisfiesRoles({ role: 'shop' }, ['admin'])).toBe(false);
    expect(actorSatisfiesRoles({ role: 'tech' }, ['admin'])).toBe(false);
    expect(actorSatisfiesRoles({ role: 'customer', isOwner: true }, ['admin'])).toBe(false);
    expect(actorSatisfiesRoles({ role: 'manager', isSuperAdmin: true }, ['admin'])).toBe(false);
    expect(actorSatisfiesRoles({ role: 'admin' }, ['superadmin'])).toBe(false);

    for (const path of adminPages) {
      expect(isRouteAllowed(path, owner)).toBe(true);
      expect(isRouteAllowed(path, { role: 'shop' })).toBe(false);
      expect(isRouteAllowed(path, { role: 'customer' })).toBe(false);
      expect(isRouteAllowed(path, { role: 'tech' })).toBe(false);
      expect(isRouteAllowed(path, { role: 'manager' })).toBe(false);
    }
  });

  it('does not rewrite the owner to /forbidden on the admin list pages', async () => {
    const token = generateAccessToken({
      id: 'owner-1',
      username: 'supadm1006',
      role: 'superadmin',
      isOwner: true,
      isSuperAdmin: false,
    });

    for (const path of adminPages) {
      const gate = await gateCrossRole(new NextRequest(`http://localhost${path}`, {
        headers: { cookie: `sos_auth=${token}` },
      }));
      expect(gate).toBeNull();
    }
  });

  it('still forbids shop, tech, customer, and manager on those pages', async () => {
    const roles = ['shop', 'tech', 'customer', 'manager'] as const;
    for (const role of roles) {
      const token = generateAccessToken({ id: `${role}-1`, role, isOwner: true, isSuperAdmin: true });
      for (const path of adminPages) {
        const gate = await gateCrossRole(new NextRequest(`http://localhost${path}`, {
          headers: { cookie: `sos_auth=${token}` },
        }));
        expect(gate).not.toBeNull();
        expect(gate?.headers.get('x-middleware-rewrite') || '').toContain('/forbidden');
        expect(gate?.headers.get('x-middleware-rewrite') || '').toContain(encodeURIComponent(path));
      }
    }
  });

  it('lists admin and superadmin on the page guards that 403d the owner', () => {
    const pending = readFileSync('src/app/admin/pending-shops/page.tsx', 'utf8');
    const users = readFileSync('src/app/admin/user-management/page.tsx', 'utf8');
    const addUser = readFileSync('src/app/admin/user-management/new/page.tsx', 'utf8');
    expect(pending).toContain("useRequireAuth(['admin', 'superadmin'])");
    expect(users).toContain("useRequireAuth(['admin', 'superadmin'])");
    expect(addUser).toContain("useRequireAuth(['admin', 'superadmin'])");
  });
});
