import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { isOwnerAdmin } from '@/lib/owner-access';

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
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
    const platformConfig = await prisma.platformConfig.findUnique({ where: { id: 'global' } });
    const feePerWorkOrder = (platformConfig?.serviceFee || 500) / 100;

    const [
      clockedInEmployees,
      workOrdersByStatus,
      todayWorkOrders,
      overdueWorkOrders,
      todayPayments,
      weekRevenue,
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
              shop: { select: { shopName: true } },
            },
          },
        },
      }),
      prisma.workOrder.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.workOrder.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.workOrder.count({ where: { dueDate: { lt: now }, status: { notIn: ['completed', 'cancelled', 'closed'] } } }),
      prisma.workOrder.aggregate({ where: { paymentStatus: 'paid', updatedAt: { gte: todayStart } }, _sum: { amountPaid: true } }),
      prisma.workOrder.aggregate({ where: { paymentStatus: 'paid', updatedAt: { gte: weekAgo } }, _sum: { amountPaid: true } }),
      prisma.workOrder.aggregate({ where: { paymentStatus: 'pending', status: 'completed' }, _sum: { estimatedCost: true }, _count: { id: true } }),
      prisma.shop.findMany({ where: { status: 'pending' }, take: 10, orderBy: { createdAt: 'desc' } }),
      prisma.shop.count({ where: { status: 'pending' } }),
      prisma.shop.count({ where: { status: 'approved' } }),
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
        status: 'approved',
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

    const paidTodayCount = paidWorkOrders.filter((wo) => wo.createdAt >= todayStart).length;
    const paidWeekCount = paidWorkOrders.filter((wo) => wo.createdAt >= weekAgo).length;
    const paidMonthCount = paidWorkOrders.filter((wo) => wo.createdAt >= monthStart).length;
    const paidLastMonthCount = paidWorkOrders.filter((wo) => wo.createdAt >= lastMonthStart && wo.createdAt < lastMonthEnd).length;

    const feesByShopMap: Record<string, { shopName: string; count: number; fees: number }> = {};
    for (const wo of paidWorkOrders) {
      const shopId = wo.shop?.id || 'unknown';
      const shopName = wo.shop?.shopName || 'Unknown Shop';
      if (!feesByShopMap[shopId]) {
        feesByShopMap[shopId] = { shopName, count: 0, fees: 0 };
      }
      feesByShopMap[shopId].count += 1;
      feesByShopMap[shopId].fees += feePerWorkOrder;
    }

    const feesByShop = Object.values(feesByShopMap).sort((a, b) => b.fees - a.fees);
    const feesThisMonth = paidMonthCount * feePerWorkOrder;
    const feesLastMonth = paidLastMonthCount * feePerWorkOrder;
    const feeMoMGrowth = feesLastMonth > 0 ? Number((((feesThisMonth - feesLastMonth) / feesLastMonth) * 100).toFixed(1)) : 0;

    const recentFeeTransactions = paidWorkOrders.slice(0, 10).map((wo) => ({
      id: wo.id,
      shopName: wo.shop?.shopName || 'Unknown Shop',
      customerName: wo.customer ? `${wo.customer.firstName} ${wo.customer.lastName}` : 'Unknown',
      description: wo.issueDescription || 'Service',
      amountPaid: wo.amountPaid || 0,
      fee: feePerWorkOrder,
      date: wo.createdAt,
    }));

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      realTimeOps: {
        clockedInNow: clockedInEmployees.length,
        clockedInDetails: clockedInEmployees.map((e) => ({
          name: `${e.tech?.firstName} ${e.tech?.lastName}`,
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
        todayRevenue: todayPayments._sum.amountPaid || 0,
        weekRevenue: weekRevenue._sum.amountPaid || 0,
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
        feePerWorkOrder: canViewPlatformFinancials ? feePerWorkOrder : 0,
        totalFees: canViewPlatformFinancials ? paidWorkOrders.length * feePerWorkOrder : 0,
        feesToday: canViewPlatformFinancials ? paidTodayCount * feePerWorkOrder : 0,
        feesThisWeek: canViewPlatformFinancials ? paidWeekCount * feePerWorkOrder : 0,
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
        mrr: canViewPlatformFinancials ? feesThisMonth : 0,
        arr: canViewPlatformFinancials ? feesThisMonth * 12 : 0,
        totalShopsCreated,
        shopsByStatus: shopsByStatus.reduce((acc, s) => {
          acc[s.status] = s._count.id;
          return acc;
        }, {} as Record<string, number>),
      },
    });
  } catch (error) {
    console.error('Command Center API error:', error);
    const details = process.env.NODE_ENV === 'development' ? String(error) : undefined;
    return NextResponse.json({ error: 'Failed to fetch command center data', ...(details && { details }) }, { status: 500 });
  }
}
