import { describe, expect, it } from '@jest/globals';
import { usableShopId } from '../src/lib/shopAccess';
import { historySpend, loyaltyPointsFromOrders } from '../src/lib/rewardPayload';
import { unwrapTeam } from '../src/lib/workOrderList';
import { isCompletedWorkOrder, workOrderTitle } from '../src/lib/workOrderMetrics';
import { isCustomerVisibleNotification } from '../src/lib/customerNotifications';
import { dviApprovalStatus, readNextInspectionDue, writeInspectionNotes } from '../src/lib/dviApproval';
import { resolveShiftReader, shiftListWhere } from '../src/lib/shiftQuery';
import { shopRestrictedDestination } from '../src/lib/shopRestrictedRoutes';

describe('FW-MGR-001 estimate issue text', () => {
  it('renders symptoms instead of the pictures object', () => {
    expect(workOrderTitle({
      issueDescription: { symptoms: 'No start', pictures: [] },
    })).toBe('No start');
  });
});

describe('FW-TECH-001 shift access', () => {
  it('lets a tech read their own shifts without a shop query', () => {
    expect(resolveShiftReader({ id: 'tech-1', role: 'tech', shopId: 'shop-1' }, null, 'someone-else')).toEqual({
      shopId: 'shop-1',
      techId: 'tech-1',
    });
    expect(shiftListWhere({ techId: 'tech-1', status: 'upcoming', now: new Date('2026-09-22T15:00:00') })).toMatchObject({
      techId: 'tech-1',
      status: { notIn: ['completed', 'cancelled'] },
    });
  });
});

describe('FW-OWN-002 null shop id', () => {
  it('treats the string null as a missing shop', () => {
    expect(usableShopId('null')).toBeNull();
    expect(usableShopId('current')).toBeNull();
    expect(usableShopId('shop-1')).toBe('shop-1');
  });
});

describe('FW-CUST customer history and loyalty', () => {
  it('counts completed jobs and dollars, not a 50-point fallback', () => {
    expect(isCompletedWorkOrder({ status: 'completed' })).toBe(true);
    expect(isCompletedWorkOrder({ status: 'closed' })).toBe(true);
    expect(historySpend({ amountPaid: 1.08, estimatedCost: 40 })).toBe(1.08);
    expect(loyaltyPointsFromOrders([{ amountPaid: 1.08, estimatedCost: 40 }])).toBe(1);
  });
});

describe('FW-CUST-P01 customer notifications', () => {
  it('hides shop low-stock alerts', () => {
    expect(isCustomerVisibleNotification({ type: 'low_stock_alert', title: 'Low Stock Alert' })).toBe(false);
    expect(isCustomerVisibleNotification({ type: 'loyalty_points', title: 'Points Earned!' })).toBe(true);
  });
});

describe('FW-OWN-001 dvi approval mapping', () => {
  it('maps inspection rows onto the approval queue', () => {
    expect(dviApprovalStatus({ status: 'in-progress', customerApproved: false })).toBe('pending');
    expect(dviApprovalStatus({ status: 'approved', customerApproved: true })).toBe('approved');
    const notes = writeInspectionNotes({ existing: 'Brakes', nextInspectionDue: '2027-09-22T00:00:00.000Z' });
    expect(readNextInspectionDue(notes)).toBe('2027-09-22T00:00:00.000Z');
  });
});

describe('FW-MGR schedule team payload', () => {
  it('reads the team array the team API actually returns', () => {
    expect(unwrapTeam({ team: [{ id: 't1' }] })).toEqual([{ id: 't1' }]);
    expect(unwrapTeam({ technicians: [{ id: 't2' }] })).toEqual([{ id: 't2' }]);
  });
});

describe('FW-SHOP forbidden cluster', () => {
  it('sends dead shop admin links to a working page', () => {
    expect(shopRestrictedDestination('/shop/settings/two-factor')).toBe('/shop/settings?tab=security');
    expect(shopRestrictedDestination('/shop/settings/sessions')).toBe('/shop/settings?tab=security');
    expect(shopRestrictedDestination('/shop/settings/api-keys')).toBe('/shop/integrations');
    expect(shopRestrictedDestination('/shop/settings/webhooks')).toBe('/shop/integrations');
    expect(shopRestrictedDestination('/shop/admin/logs')).toBe('/shop/admin');
    expect(shopRestrictedDestination('/shop/admin/health')).toBe('/shop/home');
  });
});
