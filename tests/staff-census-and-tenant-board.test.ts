import { describe, expect, it } from '@jest/globals';
import { platformFeeForPaidOrders } from '../src/lib/platformFees';
import { platformFeeHeadline } from '../src/lib/platformRevenue';
import {
  accountRoleLabel,
  isPlatformStaffAccount,
  managedRoleCounts,
  roleCountsMatchList,
} from '../src/lib/platformUserCensus';
import { listedMoney, listedTotalChange, tenantBoardStats, tenantHealthScore, tenantOwnerLine, tenantOwnerText } from '../src/lib/tenantBoard';

const now = new Date('2026-10-02T16:00:00.000Z');

describe('customer fees and financial reports', () => {
  const septemberOrders = [
    { amountPaid: 11.09, createdAt: '2026-09-18T15:00:00.000Z' },
    { amountPaid: 0, createdAt: '2026-09-18T15:00:00.000Z' },
    { amountPaid: 0, createdAt: '2026-09-19T15:00:00.000Z' },
    { amountPaid: 0, createdAt: '2026-09-20T15:00:00.000Z' },
  ];

  it('does not put a -100% tag on fees that were already collected', () => {
    const startOfOctober = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfSeptember = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const fee = 5;
    const thisMonth = septemberOrders.filter((order) => new Date(order.createdAt) >= startOfOctober).length * fee;
    const lastMonth = septemberOrders.filter((order) => {
      const created = new Date(order.createdAt);
      return created >= startOfSeptember && created < startOfOctober;
    }).length * fee;
    const oldGrowth = ((thisMonth - lastMonth) / lastMonth) * 100;
    expect(thisMonth).toBe(0);
    expect(lastMonth).toBe(20);
    expect(oldGrowth).toBeCloseTo(-100);

    const collected = platformFeeForPaidOrders(septemberOrders.length, 500);
    const headline = platformFeeHeadline(septemberOrders.map((order) => ({ feeCents: 500, at: order.createdAt })), now);
    const revenue = septemberOrders.reduce((sum, order) => sum + order.amountPaid, 0);
    expect(collected).toBe(20);
    expect(headline.collected).toBe(20);
    expect(headline.periodFees).toBe(20);
    expect(headline.periodLabel).toBe('Sep 2026');
    expect(headline.changeLabel).toBe('Sep 2026');
    expect(headline.changeLabel).not.toContain('100');
    expect(revenue).toBeCloseTo(11.09);
  });

  it('shows a real percent when the prior month of the same fees was higher', () => {
    const orders = [
      { amountPaid: 10, createdAt: '2026-09-15T15:00:00.000Z' },
      { amountPaid: 10, createdAt: '2026-09-16T15:00:00.000Z' },
      { amountPaid: 10, createdAt: '2026-10-01T15:00:00.000Z' },
    ];
    const headline = platformFeeHeadline(orders.map((order) => ({ feeCents: 500, at: order.createdAt })), now);
    expect(headline.collected).toBe(15);
    expect(headline.periodFees).toBe(5);
    expect(headline.changeLabel).toBe('-50.0%');
  });
});

describe('user management role counts', () => {
  function repeat(count: number, row: { role: string; userType?: string; isSuperAdmin?: boolean }) {
    return Array.from({ length: count }, () => ({ ...row }));
  }

  it('counts platform staff that the admin, shop, technician, and customer cards skip', () => {
    const users = [
      ...repeat(8, { role: 'admin', userType: 'admin' }),
      ...repeat(3, { role: 'superadmin', userType: 'admin', isSuperAdmin: true }),
      ...repeat(5, { role: 'shop', userType: 'shop' }),
      ...repeat(4, { role: 'tech', userType: 'tech' }),
      ...repeat(10, { role: 'customer', userType: 'customer' }),
    ];
    const today = ['admin', 'shop', 'tech', 'customer'].reduce(
      (sum, role) => sum + users.filter((user) => user.role === role).length,
      0,
    );
    expect(users).toHaveLength(30);
    expect(today).toBe(27);

    const counts = managedRoleCounts(users);
    expect(counts.admin).toBe(8);
    expect(counts.staff).toBe(3);
    expect(counts.shop).toBe(5);
    expect(counts.technician).toBe(4);
    expect(counts.customer).toBe(10);
    expect(roleCountsMatchList(counts)).toBe(true);
    expect(accountRoleLabel(users[8])).toBe('Super Admin');
    expect(isPlatformStaffAccount(users[8])).toBe(true);
  });

  it('keeps Super Admin staff in the staff bucket when their stored role is admin', () => {
    const users = [
      ...repeat(5, { role: 'admin', userType: 'admin', isSuperAdmin: false }),
      ...repeat(3, { role: 'admin', userType: 'admin', isSuperAdmin: true }),
      ...repeat(3, { role: 'manager', userType: 'manager' }),
      ...repeat(5, { role: 'shop', userType: 'shop' }),
      ...repeat(4, { role: 'tech', userType: 'tech' }),
      ...repeat(10, { role: 'customer', userType: 'customer' }),
    ];
    const today = ['admin', 'shop', 'tech', 'customer'].reduce(
      (sum, role) => sum + users.filter((user) => user.role === role).length,
      0,
    );
    expect(users).toHaveLength(30);
    expect(today).toBe(27);

    const counts = managedRoleCounts(users);
    expect(counts.staff).toBe(3);
    expect(counts.admin).toBe(5);
    expect(counts.manager).toBe(3);
    expect(roleCountsMatchList(counts)).toBe(true);
    expect(accountRoleLabel(users[5])).toBe('Super Admin');
    expect(accountRoleLabel({ role: 'manager', isSuperAdmin: false })).toBe('MANAGER');
  });
});

describe('manage tenants board', () => {
  it('names a missing owner and keeps a real health of zero', () => {
    expect(tenantOwnerText('')).toBe('No owner');
    expect(tenantOwnerText('   ')).toBe('No owner');
    expect(tenantOwnerText('N/A')).toBe('No owner');
    expect(tenantOwnerText('Ada Lovelace')).toBe('Ada Lovelace');
    expect(tenantOwnerLine('N/A', '')).toBe('No owner');
    expect(tenantOwnerLine('N/A', 'N/A')).toBe('No owner');
    expect(tenantOwnerLine('N/A', null)).not.toContain('N/A');
    expect(tenantOwnerLine('N/A', 'Ada Lovelace')).toBe('Ada Lovelace');
    expect(tenantOwnerLine('Austin, TX', 'Ada Lovelace')).toBe('Austin, TX - Owner: Ada Lovelace');
    expect(tenantHealthScore(0)).toBe(0);
    expect(tenantHealthScore(undefined)).toBeNull();
    expect(tenantHealthScore(null)).toBeNull();
    expect(tenantHealthScore(Number.NaN)).toBeNull();
  });

  it('matches the tenants, revenue, and jobs on the page', () => {
    const rows = [
      {
        createdAt: '2026-09-12T15:00:00.000Z',
        ownerName: '',
        healthScore: 0,
        totalRevenue: 11.09,
        totalJobs: 11,
        jobsThisMonth: 1,
        jobsLastMonth: 7,
        revenueThisMonth: 0,
        revenueLastMonth: 11.09,
      },
      ...Array.from({ length: 9 }, () => ({
        createdAt: '2026-09-02T15:00:00.000Z',
        totalRevenue: 0,
        totalJobs: 0,
        jobsThisMonth: 0,
        jobsLastMonth: 0,
      })),
    ];
    const oldSignupGrowth = Math.round(((0 - 10) / 10) * 100);
    const oldJobsGrowth = Math.round(((1 - 7) / 7) * 100);
    const roundedRevenue = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(11.09);
    expect(oldSignupGrowth).toBe(-100);
    expect(oldJobsGrowth).toBe(-86);
    expect(roundedRevenue).toBe('$11');

    const board = tenantBoardStats(rows, now);
    expect(board.count).toBe(rows.length);
    expect(board.revenue).toBeCloseTo(11.09);
    expect(listedMoney(board.revenue)).toBe('$11.09');
    expect(board.jobs).toBe(11);
    expect(board.countLabel).toBe('Sep 2026');
    expect(board.countLabel).not.toContain('100');
    expect(board.jobsLabel).not.toContain('86');
    expect(listedTotalChange(11, 1, 7, now)).toBe('');
  });
});
