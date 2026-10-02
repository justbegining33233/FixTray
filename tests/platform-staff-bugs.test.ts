import { describe, expect, it } from '@jest/globals';
import { isUnreadForViewer, participantOrClauses } from '../src/lib/directMessageAccess';
import { environmentWarnings, RUNTIME_BULLET, runtimeStatusText } from '../src/lib/platformHealthDisplay';
import { canViewPlatformRevenue, headlinePaidMonth, paidMonths, revenueLoginRedirect } from '../src/lib/platformRevenue';
import { managedUserTotal } from '../src/lib/platformUserCensus';
import { alertKind, isStaffMessage, partitionStaffInbox } from '../src/lib/staffInbox';

describe('platform revenue access', () => {
  it('lets signed-in staff open revenue without sending a 403 to login', () => {
    const staff = { role: 'admin', isOwner: false, isSuperAdmin: true };
    const owner = { role: 'admin', isOwner: true, isSuperAdmin: true };
    expect(canViewPlatformRevenue(staff)).toBe(true);
    expect(canViewPlatformRevenue(owner)).toBe(true);
    expect(canViewPlatformRevenue({ role: 'manager' })).toBe(false);
    expect(revenueLoginRedirect(401)).toBe('/auth/login');
    expect(revenueLoginRedirect(403)).toBeNull();
  });
});

describe('staff home monthly revenue', () => {
  const now = new Date('2026-10-02T16:00:00.000Z');
  const september = [{ amountPaid: 11.09, createdAt: '2026-09-18T15:00:00.000Z' }];

  it('uses the same September figure Financial Reports shows instead of an empty month at -100%', () => {
    const startOfOctober = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonth = september
      .filter((order) => new Date(order.createdAt) >= startOfOctober)
      .reduce((sum, order) => sum + order.amountPaid, 0);
    const lastMonth = september.reduce((sum, order) => sum + order.amountPaid, 0);
    const oldGrowth = ((currentMonth - lastMonth) / lastMonth) * 100;
    expect(currentMonth).toBe(0);
    expect(oldGrowth).toBeCloseTo(-100);

    const headline = headlinePaidMonth(september, now);
    const reported = paidMonths(september, now).find((month) => month.label === 'Sep 2026');
    expect(reported?.revenue).toBeCloseTo(11.09);
    expect(headline.revenue).toBeCloseTo(11.09);
    expect(headline.label).toBe('Sep 2026');
    expect(headline.changeLabel).toBe('Sep 2026');
    expect(headline.changeLabel).not.toContain('100');
  });
});

describe('infrastructure warnings', () => {
  it('renders a bullet and names the warning', () => {
    expect(runtimeStatusText('OK', '3d 1h 0m')).toBe('Runtime: OK • Uptime: 3d 1h 0m');
    expect(RUNTIME_BULLET).toBe('•');
    expect(runtimeStatusText('OK', '1d')).not.toContain('bull');
    const checks = [
      ...Array.from({ length: 15 }, (_, index) => ({ name: `OK_${index}`, status: 'ok' })),
      { name: 'CSRF_SECRET', status: 'warning', hint: 'CSRF protection secret' },
    ];
    expect(environmentWarnings(checks)).toEqual([
      { name: 'CSRF_SECRET', status: 'warning', hint: 'CSRF protection secret' },
    ]);
  });
});

describe('system status user count', () => {
  it('counts the same people User Management lists, including staff', () => {
    const listed = { customers: 12, shopMembers: 10, shops: 5, staff: 3 };
    expect(managedUserTotal(listed)).toBe(30);
    expect(listed.staff).toBe(3);
    const statsWithoutUsers = { activeUsers: 2 } as { totalUsers?: number; activeUsers: number };
    expect(statsWithoutUsers.totalUsers || 0).toBe(0);
    expect(managedUserTotal(listed)).toBe(30);
  });
});

describe('staff messaging inbox', () => {
  const staffViewer = { id: 'staff-2', role: 'admin', shopId: null };

  it('does not treat shop, inventory, or work-order alerts as messages to staff', () => {
    const inventory = {
      id: 'alert-1',
      senderId: 'low-stock:pad',
      senderName: 'Inventory',
      senderRole: 'shop',
      receiverId: 'shop-1',
      receiverName: 'Main Shop',
      receiverRole: 'shop',
      subject: 'low-stock-open:pad',
      body: 'Pads are low',
      threadId: 'low-stock:pad',
      isRead: false,
      createdAt: '2026-10-01T12:00:00.000Z',
    };
    const workOrder = {
      ...inventory,
      id: 'alert-2',
      senderId: 'cust-1',
      senderName: 'Ada',
      senderRole: 'customer',
      subject: 'WO-ABCD1234',
      threadId: null,
      body: 'The truck will not start',
      createdAt: '2026-10-01T13:00:00.000Z',
    };
    expect(alertKind(inventory)).toBe('inventory');
    expect(alertKind(workOrder)).toBe('work-order');
    expect(isStaffMessage(inventory)).toBe(false);
    expect(isStaffMessage(workOrder)).toBe(false);
    const partitioned = partitionStaffInbox([inventory, workOrder]);
    expect(partitioned.conversations).toHaveLength(0);
    expect(partitioned.alerts.map((alert) => alert.kind)).toEqual(['work-order', 'inventory']);
    expect(partitioned.alerts.every((alert) => alert.canReply === false)).toBe(true);
  });

  it('opens a member message to staff with the thread and a reply target', () => {
    const incoming = {
      id: 'msg-1',
      senderId: 'cust-1',
      senderName: 'Ada Customer',
      senderRole: 'customer',
      receiverId: 'staff-2',
      receiverName: 'FTStaff',
      receiverRole: 'superadmin',
      subject: null,
      body: 'Can someone call me?',
      isRead: false,
      createdAt: '2026-10-01T15:00:00.000Z',
    };
    expect(isStaffMessage(incoming)).toBe(true);
    expect(isUnreadForViewer(incoming, staffViewer)).toBe(true);
    expect(participantOrClauses(staffViewer)).toEqual(expect.arrayContaining([
      { receiverId: 'staff-2', receiverRole: 'superadmin' },
      { receiverId: 'staff-2', receiverRole: 'admin' },
    ]));
    const { conversations, alerts } = partitionStaffInbox([incoming]);
    expect(alerts).toHaveLength(0);
    expect(conversations).toHaveLength(1);
    expect(conversations[0].canReply).toBe(true);
    expect(conversations[0].member).toEqual({
      id: 'cust-1',
      role: 'customer',
      name: 'Ada Customer',
    });
    expect(conversations[0].messages.map((message) => message.body)).toEqual(['Can someone call me?']);
    expect(conversations[0].unreadCount).toBe(1);
  });
});
