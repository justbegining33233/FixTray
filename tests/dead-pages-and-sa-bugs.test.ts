import { describe, expect, it } from '@jest/globals';
import { PUBLIC_AND_ADMIN_REDIRECTS } from '../src/lib/publicRedirects';
import { actorMayAccessShop, resolveShopId } from '../src/lib/shopAccess';
import { ownerShopHeadline } from '../src/lib/shopCensus';
import { loyaltyPointsFromRewards } from '../src/lib/rewardPayload';
import { displayEmployeeLabel, displayPersonName, latestShopName, platformUserLabel } from '../src/lib/platformUserLabel';
import { describeUserUpdate, presentAuditDetails } from '../src/lib/auditDetails';
import { customerTrackingWhere, TRACKABLE_WORK_ORDER_STATUSES } from '../src/lib/customerTracking';
import { formatEstimateMoney } from '../src/lib/estimateMoney';
import { LEAFLET_ICON_URLS } from '../src/lib/leafletIcons';
import { platformFeeForPaidOrders } from '../src/lib/platformFees';
import { parseDeploymentDoc } from '../src/lib/deploymentHistory';
import { MAX_WORK_ORDER_LIST_LIMIT } from '../src/lib/workOrderList';
import { ACTIVE_WORK_ORDER_STATUSES } from '../src/lib/workOrderMetrics';

describe('dead marketing and admin aliases', () => {
  it('sends manage-users and marketing 404s to pages that already exist', () => {
    const bySource = Object.fromEntries(PUBLIC_AND_ADMIN_REDIRECTS.map((row) => [row.source, row.destination]));
    expect(bySource['/admin/manage-users']).toBe('/admin/user-management');
    expect(bySource['/capabilities']).toBe('/features');
    expect(bySource['/help']).toBe('/contact');
    expect(bySource['/help-center']).toBe('/contact');
    expect(bySource['/docs']).toBe('/features');
    expect(bySource['/blog']).toBe('/features');
    expect(bySource['/demo']).toBe('/contact');
    expect(bySource['/register/shop']).toBe('/auth/register/shop');
  });
});

describe('shop access for managers and techs', () => {
  const shopId = 'shop-1';

  it('allows a manager when the token shop matches and rejects a user-id comparison', () => {
    expect(actorMayAccessShop({ id: 'tech-9', role: 'manager', shopId }, shopId)).toBe(true);
    expect(actorMayAccessShop({ id: 'tech-9', role: 'manager', shopId: 'other' }, shopId)).toBe(false);
    expect(actorMayAccessShop({ id: shopId, role: 'shop' }, shopId)).toBe(true);
    expect(actorMayAccessShop({ id: 'admin-1', role: 'admin' }, shopId)).toBe(true);
  });

  it('recovers a missing stored shop id from the token', () => {
    expect(resolveShopId('', 'shop-1')).toBe('shop-1');
    expect(resolveShopId('stored', 'shop-1')).toBe('stored');
  });
});

describe('owner shop census', () => {
  it('keeps total, approved, and recent-activity counts distinct', () => {
    expect(ownerShopHeadline({ totalShops: 5, approvedShops: 3, activeShops: 0 })).toEqual({
      totalShops: 5,
      approvedShops: 3,
      activeUsage: 0,
    });
  });
});

describe('loyalty points', () => {
  it('prefers loyaltyPoints over a 50-per-job fallback', () => {
    expect(loyaltyPointsFromRewards({ loyaltyPoints: 1 }, 50)).toBe(1);
    expect(loyaltyPointsFromRewards(null, 50)).toBe(50);
  });
});

describe('clocked-in employee names', () => {
  it('uses a placeholder when the name is blank or undefined', () => {
    expect(displayPersonName(undefined, undefined, 'ada@shop.test')).toBe('ada@shop.test');
    expect(displayPersonName('', '', '')).toBe('Team member');
    expect(displayEmployeeLabel('undefined undefined')).toBe('Team member');
    expect(displayEmployeeLabel('Ada Lovelace')).toBe('Ada Lovelace');
  });
});

describe('platform user labels', () => {
  it('builds a name and shop when the API only has first and last name', () => {
    expect(platformUserLabel({ firstName: 'Ada', lastName: 'Lovelace', shop: { shopName: 'North' } })).toEqual({
      name: 'Ada Lovelace',
      shopName: 'North',
    });
    expect(latestShopName([
      { createdAt: '2026-01-01', shop: { shopName: 'Old' } },
      { createdAt: '2026-06-01', shop: { shopName: 'New' } },
    ])).toBe('New');
  });
});

describe('audit details', () => {
  it('omits blank role and status and hides stored undefined placeholders', () => {
    expect(describeUserUpdate({ userType: 'tech' })).toBe('Type: tech');
    expect(presentAuditDetails('Type: tech, Role: undefined, Status: undefined')).toBe('Type: tech');
  });
});

describe('customer tracking query', () => {
  it('includes the same active statuses the dashboard uses', () => {
    for (const status of ACTIVE_WORK_ORDER_STATUSES) {
      expect(TRACKABLE_WORK_ORDER_STATUSES).toContain(status);
    }
    expect(customerTrackingWhere('cust-1').status.in).toContain('pending');
    expect(customerTrackingWhere('cust-1', 'wo-1').id).toBe('wo-1');
  });
});

describe('estimate money and map icons', () => {
  it('renders missing totals as $0.00', () => {
    expect(formatEstimateMoney(undefined)).toBe('$0.00');
    expect(formatEstimateMoney(12.5)).toBe('$12.50');
  });

  it('points leaflet markers at absolute CDN urls', () => {
    expect(LEAFLET_ICON_URLS.iconUrl.startsWith('https://')).toBe(true);
    expect(LEAFLET_ICON_URLS.shadowUrl.startsWith('https://')).toBe(true);
  });
});

describe('platform fees and deployment history', () => {
  it('charges the configured service fee per paid order', () => {
    expect(platformFeeForPaidOrders(2, 500)).toBe(10);
    expect(platformFeeForPaidOrders(0, 500)).toBe(0);
  });

  it('reads the version and completion date from the doc instead of the filename', () => {
    const parsed = parseDeploymentDoc(
      '**Version:** 1.0.0\n**Completion Date:** February 28, 2026\n',
      'VERSION_0.0.5.md',
      new Date('2018-01-01T00:00:00.000Z'),
    );
    expect(parsed?.version).toBe('v1.0.0');
    expect(parsed?.timestamp.startsWith('2018')).toBe(false);
  });

  it('allows the shop calendar to request 200 work orders', () => {
    expect(MAX_WORK_ORDER_LIST_LIMIT).toBe(200);
  });
});
