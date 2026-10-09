import { NextRequest } from 'next/server';
import { generateAccessToken } from '../src/lib/auth';
import { isShopOperationalApi, PLATFORM_OWNER_SHOP_DENIED } from '../src/lib/platformOwnerApi';
import { gateCrossRole } from '../src/proxy';

const LEAKED = [
  '/api/analytics',
  '/api/analytics/employee-performance',
  '/api/analytics/export',
  '/api/analytics/sla',
  '/api/appointments',
  '/api/appointments/apt-1',
  '/api/customers',
  '/api/customers/vehicles/veh-1',
  '/api/inventory',
  '/api/inventory/reports',
  '/api/inventory/shared',
  '/api/messages/contacts',
  '/api/offline/bundle',
  '/api/shop',
  '/api/shop/stats',
  '/api/shop/team',
  '/api/shop/urgent-alerts',
  '/api/shop/workorder-stats',
  '/api/shops/labor-rates',
  '/api/shops/settings',
  '/api/techs',
  '/api/techs/tech-1',
  '/api/time-tracking',
  '/api/timeclock',
  '/api/timeclock/status',
  '/api/vehicles/veh-1/history-pdf',
  '/api/waiting-room',
  '/api/workorders',
  '/api/workorders/wo-1',
  '/api/workorders/wo-1/invoice',
  '/api/workorders/wo-1/time-tracking',
  '/api/payroll/employees',
  '/api/payment-links',
];

const PLATFORM = [
  '/api/admin/shops',
  '/api/admin/users',
  '/api/admin/fee-year-end',
  '/api/health',
  '/api/monitoring',
  '/api/shops/pending',
  '/api/shops/accepted',
  '/api/shops/register',
  '/api/auth/profile',
  '/api/messages',
  '/api/notifications',
];

describe('platform owner shop API gate', () => {
  it('classifies shop operations and leaves platform routes alone', () => {
    for (const path of LEAKED) expect(isShopOperationalApi(path)).toBe(true);
    for (const path of PLATFORM) expect(isShopOperationalApi(path)).toBe(false);
  });

  it('returns 403 for a platform owner and leaves a shop token alone', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'platform-owner-api-test-secret';
    const owner = generateAccessToken({ id: 'owner-1', username: 'supadm1006', role: 'superadmin' });
    const storedAdmin = generateAccessToken({ id: 'owner-2', username: 'supadm1006', role: 'admin' });
    const shop = generateAccessToken({ id: 'shop-1', role: 'shop' });

    for (const token of [owner, storedAdmin]) {
      for (const path of LEAKED) {
        const gate = await gateCrossRole(new NextRequest(`http://localhost${path}`, {
          headers: { cookie: `sos_auth=${token}` },
        }));
        expect(gate?.status).toBe(403);
        await expect(gate?.json()).resolves.toEqual(PLATFORM_OWNER_SHOP_DENIED);
      }
    }

    for (const path of PLATFORM) {
      const gate = await gateCrossRole(new NextRequest(`http://localhost${path}`, {
        headers: { cookie: `sos_auth=${owner}` },
      }));
      expect(gate).toBeNull();
    }

    const shopGate = await gateCrossRole(new NextRequest('http://localhost/api/workorders', {
      headers: { cookie: `sos_auth=${shop}` },
    }));
    expect(shopGate).toBeNull();

    const anonymous = await gateCrossRole(new NextRequest('http://localhost/api/workorders'));
    expect(anonymous).toBeNull();
  });
});
