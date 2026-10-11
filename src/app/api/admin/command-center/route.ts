import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { isOwnerAdmin } from '@/lib/owner-access';
import { centsToDollars, loadFeeMovements, reportZone } from '@/lib/books/storedFeeReport';
import { addDays, dayKey, mondayKey, zonedDayStart } from '@/lib/books/periods';
import { platformFeeYear, shopJobReceiptCents } from '@/lib/books/money';
import logger from '@/lib/logger';
import { displayPersonName } from '@/lib/platformUserLabel';
import { operatingShopWhere } from '@/lib/shopAccountStatus';

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;
  const canViewPlatformFinancials = Boolean(auth.isOwner);

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [
      clockedInEmployees,
      workOrdersByStatus,
      todayWorkOrders,
      overdueWorkOrders,
      pendingPayments,
      pendingShops,
      pendingShopsCount,
      totalApprovedShops,
      totalCustomers,
      newCustomersToday,
      newCustomersWeek,
      totalTechs,
      todayAppointments,
      noShowsThisWeek,
      reviewStats,
      recentBadReviews,
      unreadAdminMessages,
      messagesToday,
      paidWorkOrders,
    ] = await Promise.all([
      prisma.timeEntry.findMany({
        where: { clockOut: null },
        include: {
          tech: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              shop: { select: { shopName: true } },
            },
          },
        },
      }),
      prisma.workOrder.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.workOrder.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.workOrder.count({ where: { dueDate: { lt: now }, status: { notIn: ['completed', 'cancelled', 'closed'] } } }),
      prisma.workOrder.aggregate({ where: { paymentStatus: 'pending', status: 'completed' }, _sum: { estimatedCost: true }, _count: { id: true } }),
      prisma.shop.findMany({ where: { status: 'pending' }, take: 10, orderBy: { createdAt: 'desc' } }),
      prisma.shop.count({ where: { status: 'pending' } }),
      prisma.shop.count({ where: operatingShopWhere() }),
      prisma.customer.count(),
      prisma.customer.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.customer.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.tech.count(),
      prisma.appointment.count({ where: { scheduledDate: { gte: todayStart, lt: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000) } } }),
      prisma.appointment.count({ where: { status: 'no-show', scheduledDate: { gte: weekAgo } } }),
      prisma.review.aggregate({ _avg: { rating: true }, _count: { id: true } }),
      prisma.review.findMany({
        where: { rating: { lte: 2 }, createdAt: { gte: weekAgo } },
        include: { shop: { select: { shopName: true } }, customer: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.directMessage.count({ where: { receiverRole: 'admin', isRead: false } }),
      prisma.directMessage.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.workOrder.findMany({
        where: { paymentStatus: 'paid' },
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          amountPaid: true,
          estimatedCost: true,
          paymentStatus: true,
          issueDescription: true,
          shop: { select: { id: true, shopName: true } },
          customer: { select: { firstName: true, lastName: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const [fixtrayAdmins, adminLoginEvents, shopLoginEvents, activeAdminSessions, activeShopSessions] = await Promise.all([
      prisma.admin.findMany({
        select: {
          id: true,
          username: true,
          email: true,
          isSuperAdmin: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.activityLog.findMany({
        where: {
          action: 'login',
          type: 'user',
          createdAt: { gte: monthAgo },
          email: { not: null },
        },
        select: {
          email: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.activityLog.findMany({
        where: {
          action: 'login',
          type: 'user',
          createdAt: { gte: monthAgo },
          shopId: { not: null },
        },
        select: {
          shopId: true,
          email: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.refreshToken.findMany({
        where: {
          adminId: { not: null },
          revoked: false,
          expiresAt: { gt: now },
        },
        select: {
          adminId: true,
        },
      }),
      prisma.refreshToken.findMany({
        where: {
          revoked: false,
          expiresAt: { gt: now },
        },
        select: {
          metadata: true,
        },
      }),
    ]);

    const latestAdminLoginByEmail = new Map<string, Date>();
    for (const event of adminLoginEvents) {
      if (!event.email) continue;
      const key = event.email.trim().toLowerCase();
      if (!latestAdminLoginByEmail.has(key)) {
        latestAdminLoginByEmail.set(key, event.createdAt);
      }
    }
    const latestShopLoginByShopId = new Map<string, Date>();
    const latestShopLoginByEmail = new Map<string, Date>();
    for (const event of shopLoginEvents) {
      if (event.shopId && !latestShopLoginByShopId.has(event.shopId)) {
        latestShopLoginByShopId.set(event.shopId, event.createdAt);
      }
      if (event.email) {
        const key = event.email.trim().toLowerCase();
        if (!latestShopLoginByEmail.has(key)) {
          latestShopLoginByEmail.set(key, event.createdAt);
        }
      }
    }
    const activeAdminIds = new Set(
      activeAdminSessions
        .map((session) => session.adminId)
        .filter((id): id is string => Boolean(id))
    );
    const activeShopIds = new Set<string>();
    for (const session of activeShopSessions) {
      const meta = session.metadata ? (() => { try { return JSON.parse(session.metadata) as { shopId?: string }; } catch { return {}; } })() : {};
      if (meta.shopId) activeShopIds.add(meta.shopId);
    }

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const staffMembers = fixtrayAdmins.map((admin) => {
      const lastLogin = latestAdminLoginByEmail.get(admin.email.trim().toLowerCase()) || null;
      const hasActiveSession = activeAdminIds.has(admin.id);
      const isActive = hasActiveSession || (lastLogin ? (now.getTime() - lastLogin.getTime()) <= sevenDaysMs : false);
      return {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        isSuperAdmin: admin.isSuperAdmin,
        isOwner: isOwnerAdmin({ id: admin.id, username: admin.username }),
        createdAt: admin.createdAt,
        lastLogin,
        hasActiveSession,
        activityStatus: isActive ? 'active' : 'inactive',
      };
    });

    const approvedShops = await prisma.shop.findMany({
      where: {
        ...operatingShopWhere(),
      },
      select: { id: true, shopName: true, email: true, updatedAt: true },
    });

    const shopActivityWindow = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const activeApprovedShops = approvedShops.filter((shop) => {
      const emailKey = (shop.email || '').trim().toLowerCase();
      const lastLogin = latestShopLoginByShopId.get(shop.id) || latestShopLoginByEmail.get(emailKey) || null;
      return activeShopIds.has(shop.id) || (lastLogin ? lastLogin >= shopActivityWindow : false);
    });
    const inactiveShops = approvedShops
      .filter((shop) => !activeApprovedShops.some((active) => active.id === shop.id))
      .slice(0, 10);
    const inactiveShopsCount = approvedShops.length - activeApprovedShops.length;

    const todayTimeEntries = await prisma.timeEntry.findMany({ where: { clockIn: { gte: todayStart } } });
    let totalHoursToday = 0;
    todayTimeEntries.forEach((entry) => {
      if (entry.clockIn && entry.clockOut) {
        totalHoursToday += (entry.clockOut.getTime() - entry.clockIn.getTime()) / (1000 * 60 * 60);
      } else if (entry.clockIn && !entry.clockOut) {
        totalHoursToday += (now.getTime() - entry.clockIn.getTime()) / (1000 * 60 * 60);
      }
    });

    const activeTechsToday = await prisma.timeEntry.groupBy({ by: ['techId'], where: { clockIn: { gte: todayStart } } });
    const serviceLocationBreakdown = await prisma.workOrder.groupBy({ by: ['serviceLocation'], _count: { id: true } });

    const totalShopsCreated = await prisma.shop.count();
    const shopsByStatus = await prisma.shop.groupBy({ by: ['status'], _count: { id: true } });

    const zone = await reportZone();
    const todayKey = dayKey(now, zone);
    const reportMonthKey = todayKey.slice(0, 7);
    const reportLastMonthKey = addDays(`${reportMonthKey}-01`, -1).slice(0, 7);
    const reportWeekStart = mondayKey(todayKey);
    const reportWeekEnd = addDays(reportWeekStart, 7);
    const todayStartNy = zonedDayStart(todayKey, zone);
    const weekStartNy = zonedDayStart(reportWeekStart, zone);
    const jobReceipt = (order: { amountPaid?: number | null; estimatedCost?: number | null; paymentStatus?: string | null }) =>
      shopJobReceiptCents(order) / 100;
    const todayRevenue = paidWorkOrders
      .filter((order) => order.updatedAt >= todayStartNy)
      .reduce((sum, order) => sum + jobReceipt(order), 0);
    const weekJobRevenue = paidWorkOrders
      .filter((order) => order.updatedAt >= weekStartNy)
      .reduce((sum, order) => sum + jobReceipt(order), 0);

    const paidTodayCount = paidWorkOrders.filter((wo) => wo.createdAt >= todayStart).length;
    const paidWeekCount = paidWorkOrders.filter((wo) => wo.createdAt >= weekAgo).length;
    const paidMonthCount = paidWorkOrders.filter((wo) => wo.createdAt >= monthStart).length;

    const movements = canViewPlatformFinancials ? await loadFeeMovements() : [];
    const allFees = platformFeeYear(movements);
    const collectedOf = (rows: typeof movements) => centsToDollars(platformFeeYear(rows).collectedCents);
    const monthRows = movements.filter((row) => dayKey(new Date(row.at), zone).startsWith(reportMonthKey));
    const lastMonthRows = movements.filter((row) => dayKey(new Date(row.at), zone).startsWith(reportLastMonthKey));
    const feesThisMonth = collectedOf(monthRows);
    const feesLastMonth = collectedOf(lastMonthRows);
    const feeMoMGrowth = feesLastMonth > 0 ? Number((((feesThisMonth - feesLastMonth) / feesLastMonth) * 100).toFixed(1)) : 0;
    const shopNames = new Map(paidWorkOrders.map((order) => [order.shop?.id || '', order.shop?.shopName || 'Shop']));
    const feesByShopMap: Record<string, { shopName: string; count: number; fees: number }> = {};
    for (const row of movements) {
      if (row.kind !== 'collected' && row.kind !== 'settled') continue;
      const shopId = row.shopId || 'unknown';
      if (!feesByShopMap[shopId]) {
        feesByShopMap[shopId] = { shopName: shopNames.get(shopId) || 'Shop', count: 0, fees: 0 };
      }
      feesByShopMap[shopId].count += 1;
      feesByShopMap[shopId].fees += centsToDollars(row.feeCents);
    }
    const feesByShop = Object.values(feesByShopMap).sort((a, b) => b.fees - a.fees);
    const recentFeeTransactions = movements
      .slice()
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 10)
      .map((row) => ({
        id: row.id,
        shopName: shopNames.get(row.shopId) || 'Shop',
        customerName: row.kind,
        description: row.workOrderId,
        amountPaid: 0,
        fee: centsToDollars(row.kind === 'refund' || row.kind === 'chargeback' ? -row.feeCents : row.feeCents),
        date: row.at,
      }));

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      realTimeOps: {
        clockedInNow: clockedInEmployees.length,
        clockedInDetails: clockedInEmployees.map((e) => ({
          name: displayPersonName(e.tech?.firstName, e.tech?.lastName, e.tech?.email || 'Team member'),
          shop: e.tech?.shop?.shopName || 'Unknown Shop',
          since: e.clockIn,
          onBreak: e.breakStart && !e.breakEnd,
        })),
        activeWorkOrders: workOrdersByStatus.reduce((acc, s) => (s.status && !['completed', 'cancelled', 'closed'].includes(s.status) ? acc + s._count.id : acc), 0),
        workOrdersByStatus: workOrdersByStatus.reduce((acc, s) => {
          acc[s.status || 'unknown'] = s._count.id;
          return acc;
        }, {} as Record<string, number>),
        todayWorkOrders,
        overdueWorkOrders,
        todayAppointments,
        noShowsThisWeek,
      },
      financials: {
        todayRevenue,
        weekRevenue: weekJobRevenue,
        pendingPayments: {
          count: pendingPayments._count.id,
          amount: pendingPayments._sum.estimatedCost || 0,
        },
      },
      shopHealth: {
        pendingApproval: pendingShopsCount,
        pendingShops,
        totalApproved: totalApprovedShops,
        activeThisWeek: activeApprovedShops.length,
        inactiveShops: inactiveShopsCount,
        inactiveList: inactiveShops,
      },
      customers: {
        total: totalCustomers,
        newToday: newCustomersToday,
        newThisWeek: newCustomersWeek,
      },
      reviews: {
        averageRating: Math.round((reviewStats._avg.rating || 0) * 10) / 10,
        totalReviews: reviewStats._count.id,
        recentBadReviews: recentBadReviews.map((r) => ({
          shop: r.shop?.shopName,
          customer: `${r.customer?.firstName} ${r.customer?.lastName}`,
          rating: r.rating,
          comment: r.comment,
          date: r.createdAt,
        })),
      },
      communication: {
        unreadAdminMessages,
        messagesToday,
      },
      inventory: {
        lowStockAlerts: 0,
        lowStockItems: [],
      },
      workforce: {
        totalTechs,
        activeTechsToday: activeTechsToday.length,
        totalHoursToday: Math.round(totalHoursToday * 10) / 10,
      },
      staffTeam: {
        totalStaff: staffMembers.length,
        activeStaff: staffMembers.filter((staff) => staff.activityStatus === 'active').length,
        inactiveStaff: staffMembers.filter((staff) => staff.activityStatus === 'inactive').length,
        staffWithLiveSession: staffMembers.filter((staff) => staff.hasActiveSession).length,
        newThisMonth: staffMembers.filter((staff) => staff.createdAt >= monthStart).length,
        members: staffMembers,
      },
      serviceBreakdown: serviceLocationBreakdown.reduce((acc, s) => {
        acc[s.serviceLocation || 'unknown'] = s._count.id;
        return acc;
      }, {} as Record<string, number>),
      workOrderFees: {
        feesOwed: canViewPlatformFinancials ? centsToDollars(allFees.owedCents) : 0,
        totalFees: canViewPlatformFinancials ? centsToDollars(allFees.collectedCents) : 0,
        feesToday: canViewPlatformFinancials ? collectedOf(movements.filter((row) => dayKey(new Date(row.at), zone) === todayKey)) : 0,
        feesThisWeek: canViewPlatformFinancials ? collectedOf(movements.filter((row) => {
          const key = dayKey(new Date(row.at), zone);
          return key >= reportWeekStart && key < reportWeekEnd;
        })) : 0,
        feesThisMonth: canViewPlatformFinancials ? feesThisMonth : 0,
        feesLastMonth: canViewPlatformFinancials ? feesLastMonth : 0,
        momGrowth: canViewPlatformFinancials ? feeMoMGrowth : 0,
        totalPaidWorkOrders: canViewPlatformFinancials ? paidWorkOrders.length : 0,
        paidWorkOrdersToday: canViewPlatformFinancials ? paidTodayCount : 0,
        paidWorkOrdersThisWeek: canViewPlatformFinancials ? paidWeekCount : 0,
        paidWorkOrdersThisMonth: canViewPlatformFinancials ? paidMonthCount : 0,
        feesByShop: canViewPlatformFinancials ? feesByShop : [],
        recentTransactions: canViewPlatformFinancials ? recentFeeTransactions : [],
      },
      businessMetrics: {
        totalShopsCreated,
        shopsByStatus: shopsByStatus.reduce((acc, s) => {
          acc[s.status] = s._count.id;
          return acc;
        }, {} as Record<string, number>),
      },
    });
  } catch (error) {
    logger.error('Command Center API error', { error: error instanceof Error ? error.message : String(error) });
    const details = process.env.NODE_ENV === 'development' ? String(error) : undefined;
    return NextResponse.json({ error: 'Failed to fetch command center data', ...(details && { details }) }, { status: 500 });
  }
}
