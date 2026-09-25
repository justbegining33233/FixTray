import { describe, it, expect } from '@jest/globals';
import { defaultTaxRuleDraft, shopStateCode } from '../src/lib/taxDefaults';
import { purchaseOrderAmount, totalSpentFromOrders } from '../src/lib/purchaseOrderTotals';
import { managerAlertHref } from '../src/lib/managerAlerts';
import { LEGACY_SHOP_REDIRECTS } from '../src/lib/legacyShopRoutes';
import { activePayrollEmployees, normalizePayrollEmployees } from '../src/lib/payrollTeam';
import { filterTechJobs, techJobsHref } from '../src/lib/techJobs';
import { buildCustomerRewards, emptyRewardsPayload } from '../src/lib/rewardPayload';

describe('VIS-025 tax defaults', () => {
  it('uses the shop state and does not invent New York', () => {
    expect(shopStateCode('California')).toBe('CA');
    expect(shopStateCode('ca')).toBe('CA');
    const draft = defaultTaxRuleDraft({ state: 'California', city: 'Testville' });
    expect(draft.state).toBe('CA');
    expect(draft.name).toBe('CA Sales Tax');
    expect(draft.county).toBe('');
    expect(draft.rate).toBe('');
    expect(defaultTaxRuleDraft({ state: '' }).state).not.toBe('NY');
    expect(defaultTaxRuleDraft(null).state).toBe('');
  });
});

describe('VIS-028 payroll team', () => {
  it('reads managers and techs from either payload shape and hides terminated staff', () => {
    const team = normalizePayrollEmployees({
      techs: [
        { id: 'm1', firstName: 'Pat', lastName: 'Manager', role: 'manager' },
        { id: 't1', firstName: 'Ty', lastName: 'Tech', role: 'tech', terminatedAt: '2026-01-01' },
      ],
    });
    expect(team).toHaveLength(2);
    expect(activePayrollEmployees(team).map((person) => person.id)).toEqual(['m1']);
    expect(normalizePayrollEmployees([{ id: 't2', firstName: 'Sam', lastName: 'Tech', role: 'tech' }])[0].role).toBe('tech');
  });
});

describe('VIS-031 manager alerts', () => {
  it('sends every urgent tile to a real list', () => {
    expect(managerAlertHref('overdue-jobs')).toBe('/manager/dashboard');
    expect(managerAlertHref('unassigned-jobs')).toBe('/manager/assignments');
    expect(managerAlertHref('low-inventory')).toBe('/manager/inventory');
    expect(managerAlertHref('pending-requests')).toBe('/manager/inventory');
  });
});

describe('VIS-034 tech job lists', () => {
  const orders = [
    { id: 'open', assignedTechId: 'tech-1', status: 'in-progress' },
    { id: 'done', assignedTechId: 'tech-1', status: 'completed' },
    { id: 'other', assignedTechId: 'tech-2', status: 'pending' },
  ];

  it('splits assigned work into active and history', () => {
    expect(filterTechJobs(orders, 'tech-1', 'active').map((order) => order.id)).toEqual(['open']);
    expect(filterTechJobs(orders, 'tech-1', 'history').map((order) => order.id)).toEqual(['done']);
    expect(techJobsHref('active')).toBe('/tech/jobs?view=active');
    expect(techJobsHref('history')).toBe('/tech/jobs?view=history');
    expect(techJobsHref('active')).not.toBe('/tech/home');
  });
});

describe('VIS-003 legacy shop routes', () => {
  it('redirects dead board and appointments paths', () => {
    expect(LEGACY_SHOP_REDIRECTS).toEqual(expect.arrayContaining([
      { source: '/shop/board', destination: '/shop/home', permanent: false },
      { source: '/shop/appointments', destination: '/shop/calendar', permanent: false },
      { source: '/shop/subscribe', destination: '/shop/home', permanent: false },
    ]));
  });
});

describe('VIS-108 purchase order spend', () => {
  it('sums nonzero lines even when the stored total is zero and the order is not received', () => {
    const order = {
      status: 'ordered',
      totalCost: 0,
      items: [{ quantity: 2, unitCost: 12.5 }],
    };
    expect(purchaseOrderAmount(order)).toBe(25);
    expect(totalSpentFromOrders([order, { status: 'cancelled', items: [{ qty: 1, unitCost: 99 }] }])).toBe(25);
  });
});

describe('VIS-068 rewards payload', () => {
  it('returns tiers when claims are missing instead of failing the page', () => {
    const payload = emptyRewardsPayload();
    expect(payload.loyaltyPoints).toBe(0);
    expect(payload.rewards).toHaveLength(4);
    expect(payload.rewards[0].claimed).toBe(false);

    const earned = buildCustomerRewards({
      loyaltyPoints: 200,
      claims: [],
      completed: [{ amountPaid: 40, estimatedCost: 0, completedAt: '2026-09-01T00:00:00.000Z', status: 'completed' }],
    });
    expect(earned.rewards[0].earned).toBe(true);
    expect(earned.history[0].points).toBe(40);
  });
});
