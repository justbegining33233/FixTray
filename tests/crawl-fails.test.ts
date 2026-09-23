import { describe, expect, it } from '@jest/globals';
import { shortWorkOrderLabel } from '../src/lib/notificationCopy';
import {
  workOrderIdMatches,
  workOrderIdSearchToken,
  workOrderSearchScope,
  workOrderTextMatch,
} from '../src/lib/workOrderSearch';
import {
  loginProbeOrder,
  roleMayStartStripeConnect,
  roleUsesShopAdminApis,
  welcomeDisplayName,
} from '../src/lib/customerSession';

const ASSIGNED_ID = 'cmu3ay6u0000aou8hyt5nu73k';

describe('tech global search matches the work-order labels shown in the UI', () => {
  it('finds WO-YT5NU73K by suffix, prefix, full id, and either case', () => {
    expect(shortWorkOrderLabel(ASSIGNED_ID)).toBe('WO-YT5NU73K');
    expect(workOrderIdSearchToken('WO-YT5NU73K')).toBe('YT5NU73K');
    expect(workOrderIdSearchToken('wo-yt5nu73k')).toBe('yt5nu73k');
    expect(workOrderIdMatches(ASSIGNED_ID, 'YT5NU73K')).toBe(true);
    expect(workOrderIdMatches(ASSIGNED_ID, 'yt5nu73k')).toBe(true);
    expect(workOrderIdMatches(ASSIGNED_ID, 'WO-YT5NU73K')).toBe(true);
    expect(workOrderIdMatches(ASSIGNED_ID, 'wo-yt5nu73k')).toBe(true);
    expect(workOrderIdMatches(ASSIGNED_ID, ASSIGNED_ID)).toBe(true);
    expect(workOrderIdMatches(ASSIGNED_ID, `WO-${ASSIGNED_ID.slice(0, 8)}`)).toBe(true);
    expect(workOrderIdMatches(ASSIGNED_ID, 'ZZZZZZZZ')).toBe(false);
  });

  it('searches the id with a case-insensitive contains, not a case-sensitive prefix', () => {
    const match = workOrderTextMatch('YT5NU73K');
    expect(match.OR).toEqual(expect.arrayContaining([
      { id: { contains: 'YT5NU73K', mode: 'insensitive' } },
    ]));
    expect(JSON.stringify(match)).not.toContain('startsWith');
  });

  it('keeps a technician assigned jobs in scope even without a shop id', () => {
    expect(workOrderSearchScope({ role: 'tech', id: 'tech-1', shopId: 'shop-1' })).toEqual({
      OR: [{ shopId: 'shop-1' }, { assignedTechId: 'tech-1' }],
    });
    expect(workOrderSearchScope({ role: 'tech', id: 'tech-1', shopId: null })).toEqual({
      assignedTechId: 'tech-1',
    });
    expect(workOrderSearchScope({ role: 'manager', id: 'mgr-1', shopId: 'shop-1' })).toBeNull();
  });
});

describe('customer overview hydration', () => {
  it('does not read a stored name until after mount', () => {
    expect(welcomeDisplayName({
      mounted: false,
      accountName: '',
      storedName: 'FixTray Audit',
    })).toBe('');
    expect(welcomeDisplayName({
      mounted: true,
      accountName: '',
      storedName: 'FixTray Audit',
    })).toBe('FixTray Audit');
    expect(welcomeDisplayName({
      mounted: true,
      accountName: 'FixTray Audit',
      storedName: 'Someone Else',
    })).toBe('FixTray Audit');
  });
});

describe('customer surfaces do not call shop admin or Connect', () => {
  it('limits shop admin reads and Connect start to shop roles', () => {
    expect(roleUsesShopAdminApis('customer')).toBe(false);
    expect(roleUsesShopAdminApis('')).toBe(false);
    expect(roleUsesShopAdminApis('shop')).toBe(true);
    expect(roleUsesShopAdminApis('tech')).toBe(true);
    expect(roleMayStartStripeConnect('customer')).toBe(false);
    expect(roleMayStartStripeConnect('tech')).toBe(false);
    expect(roleMayStartStripeConnect('shop')).toBe(true);
  });

  it('tries a customer email before admin, tech, and shop', () => {
    expect(loginProbeOrder('audit@fixtray.test')).toEqual(['customer', 'admin', 'tech', 'shop']);
    expect(loginProbeOrder('AuditTech')).toEqual(['admin', 'tech', 'shop', 'customer']);
  });
});
