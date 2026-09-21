import { describe, it, expect } from '@jest/globals';
import { summarizeAppointments } from '../src/lib/appointmentValidation';
import { formatSlaCompliance, slaComplianceRate } from '../src/lib/slaMetrics';
import { unwrapVehicles } from '../src/lib/workOrderList';
import {
  activeWorkOrderWhere,
  pendingQueueWhere,
  resolveShopId,
  summarizeWorkOrders,
  unassignedWorkOrderWhere,
  workOrderScope,
} from '../src/lib/workOrderMetrics';

const now = new Date('2026-09-21T18:00:00');

describe('shared work order counters', () => {
  const orders = [
    { status: 'pending', assignedTechId: null },
    { status: 'Pending', assignedTechId: null },
    { status: 'assigned', assignedTechId: 'tech-1', assignedTo: { id: 'tech-1' } },
    { status: 'in-progress', assignedTechId: 'tech-1' },
    { status: 'waiting-estimate' },
    { status: 'estimate-submitted' },
    { status: 'waiting-for-payment' },
    { status: 'completed', updatedAt: '2026-09-21T12:00:00' },
    { status: 'closed', updatedAt: '2026-08-01T12:00:00' },
    { status: 'cancelled' },
    { status: 'denied-estimate' },
  ];

  it('uses one active definition for overview and dashboard', () => {
    const summary = summarizeWorkOrders(orders, now);
    expect(summary.active).toBe(7);
    expect(summary.openJobs).toBe(summary.active);
    expect(summary.pendingQueue).toBe(2);
    expect(summary.pendingApprovals).toBe(2);
    expect(summary.unassigned).toBe(2);
    expect(summary.completed).toBe(2);
    expect(summary.completedToday).toBe(1);
    expect(summary.completedThisMonth).toBe(1);
  });

  it('does not count an empty list as open work', () => {
    expect(summarizeWorkOrders([], now)).toMatchObject({
      active: 0,
      pendingQueue: 0,
      pendingApprovals: 0,
      unassigned: 0,
      completed: 0,
    });
    expect(summarizeWorkOrders(null, now).active).toBe(0);
  });

  it('builds the same status filters the counters use', () => {
    expect(activeWorkOrderWhere({ shopId: 'shop-1' }).status.in).toEqual(
      expect.arrayContaining(['pending', 'assigned', 'in-progress', 'waiting-estimate', 'estimate-submitted', 'waiting-for-payment', 'awaiting-confirmation']),
    );
    expect(pendingQueueWhere({ customerId: 'c1' })).toEqual({
      customerId: 'c1',
      status: { in: ['pending'] },
    });
    expect(unassignedWorkOrderWhere({ shopId: 'shop-1' }).assignedTechId).toBeNull();
  });

  it('resolves shop scope without substituting a manager user id', () => {
    expect(resolveShopId({ id: 'shop-1', role: 'shop', shopId: 'shop-1' }, 'shop-1')).toEqual({
      ok: true,
      shopId: 'shop-1',
    });
    expect(resolveShopId({ id: 'shop-1', role: 'shop' }, '')).toEqual({ ok: true, shopId: 'shop-1' });
    expect(resolveShopId({ id: 'manager-1', role: 'manager', shopId: 'shop-1' }, null)).toEqual({
      ok: true,
      shopId: 'shop-1',
    });
    expect(resolveShopId({ id: 'manager-1', role: 'manager' }, null)).toEqual({ ok: false, error: 'missing' });
    expect(resolveShopId({ id: 'shop-1', role: 'shop' }, 'other-shop')).toEqual({ ok: false, error: 'forbidden' });
    expect(workOrderScope({ id: 'cust-1', role: 'customer' })).toEqual({ scope: { customerId: 'cust-1' } });
    expect(workOrderScope({ id: 'manager-1', role: 'manager', shopId: 'shop-1' }, 'stale-shop')).toEqual({
      scope: { shopId: 'shop-1' },
    });
  });
});

describe('appointment totals', () => {
  it('counts upcoming separately from saved vehicles and from all appointments', () => {
    const summary = summarizeAppointments([
      { status: 'scheduled', scheduledDate: '2026-09-22T15:00:00' },
      { status: 'scheduled', scheduledDate: '2026-09-15T15:00:00' },
      { status: 'completed', scheduledDate: '2026-09-25T15:00:00' },
      { status: 'confirmed', scheduledDate: '2026-09-21T18:30:00' },
    ], now);
    expect(summary.total).toBe(4);
    expect(summary.upcoming).toBe(2);
    expect(summary.upcomingAppointments).toHaveLength(summary.upcoming);
    expect(unwrapVehicles({ vehicles: [{ id: 'v1' }, { id: 'v2' }] })).toHaveLength(2);
    expect(unwrapVehicles([{ id: 'v1' }])).toHaveLength(1);
  });
});

describe('SLA empty math', () => {
  it('never reports 100% when there are no completed jobs with a due date', () => {
    expect(slaComplianceRate(0, 0)).toBeNull();
    expect(formatSlaCompliance(slaComplianceRate(0, 0))).toBe('N/A');
    expect(slaComplianceRate(0, -1)).toBeNull();
    expect(formatSlaCompliance(null)).toBe('N/A');
    expect(slaComplianceRate(3, 4)).toBe(75);
    expect(formatSlaCompliance(75)).toBe('75%');
  });
});
