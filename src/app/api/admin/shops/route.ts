'use server';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

function parseSessionMetadata(raw: string | null): { shopId?: string } {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as { shopId?: string };
  } catch {
    return {};
  }
}

function getShopActivityStatus(hasActiveSession: boolean, lastLogin: Date | null, activeWindowStart: Date): 'active' | 'inactive' {
  return hasActiveSession || (lastLogin ? lastLogin >= activeWindowStart : false) ? 'active' : 'inactive';
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    // Get date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Fetch all shops with related data
    const shops: any[] = await prisma.shop.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        workOrders: {
          select: {
            id: true,
            status: true,
            amountPaid: true,
            paymentStatus: true,
            createdAt: true,
            completedAt: true,
          }
        },
        techs: {
          select: { id: true, available: true }
        },
        reviews: {
          select: { rating: true }
        }
      }
    });

    const [loginEvents, activeRefreshSessions] = await Promise.all([
      prisma.activityLog.findMany({
        where: {
          action: 'login',
          type: 'user',
          createdAt: { gte: ninetyDaysAgo },
        },
        select: {
          createdAt: true,
          shopId: true,
          email: true,
        },
        orderBy: { createdAt: 'desc' },
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

    const latestLoginByShopId = new Map<string, Date>();
    const latestLoginByEmail = new Map<string, Date>();
    for (const event of loginEvents) {
      if (event.shopId && !latestLoginByShopId.has(event.shopId)) {
        latestLoginByShopId.set(event.shopId, event.createdAt);
      }
      if (event.email) {
        const key = event.email.trim().toLowerCase();
        if (!latestLoginByEmail.has(key)) {
          latestLoginByEmail.set(key, event.createdAt);
        }
      }
    }

    const activeShopIds = new Set<string>();
    for (const session of activeRefreshSessions) {
      const meta = parseSessionMetadata(session.metadata ?? null);
      if (meta.shopId) activeShopIds.add(meta.shopId);
    }

    // Process shop data with live metrics
    const formattedShops = shops.map((shop: any) => {
      const completedJobs = shop.workOrders.filter((wo: any) => wo.status === 'closed' || wo.status === 'completed').length;
      const totalJobs = shop.workOrders.length;
      const totalRevenue = shop.workOrders
        .filter((wo: any) => wo.paymentStatus === 'paid')
        .reduce((sum: number, wo: any) => sum + (wo.amountPaid || 0), 0);
      
      // Monthly revenue
      const revenueThisMonth = shop.workOrders
        .filter((wo: any) => wo.paymentStatus === 'paid' && new Date(wo.createdAt) >= startOfMonth)
        .reduce((sum: number, wo: any) => sum + (wo.amountPaid || 0), 0);
      
      const revenueLastMonth = shop.workOrders
        .filter((wo: any) => wo.paymentStatus === 'paid' && new Date(wo.createdAt) >= startOfLastMonth && new Date(wo.createdAt) <= endOfLastMonth)
        .reduce((sum: number, wo: any) => sum + (wo.amountPaid || 0), 0);

      // Jobs this month
      const jobsThisMonth = shop.workOrders.filter((wo: any) => new Date(wo.createdAt) >= startOfMonth).length;
      const jobsLastMonth = shop.workOrders.filter((wo: any) => 
        new Date(wo.createdAt) >= startOfLastMonth && new Date(wo.createdAt) <= endOfLastMonth
      ).length;

      // Average rating
      const avgRating = shop.reviews.length > 0 
        ? shop.reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / shop.reviews.length 
        : 0;

      // Completion rate
      const completionRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;

      // Active techs (using available field)
      const activeTechs = shop.techs.filter((t: any) => t.available === true).length;

      const emailKey = (shop.email || '').toLowerCase();
      const lastLogin = latestLoginByShopId.get(shop.id) || latestLoginByEmail.get(emailKey) || null;
      const hasActiveSession = activeShopIds.has(shop.id);
      const activityStatus = getShopActivityStatus(hasActiveSession, lastLogin, twentyFourHoursAgo);

      return {
        id: shop.id,
        name: shop.shopName,
        ownerName: shop.ownerName || 'N/A',
        email: shop.email,
        phone: shop.phone,
        location: shop.city && shop.state ? `${shop.city}, ${shop.state}` : shop.address || 'N/A',
        address: shop.address,
        city: shop.city,
        state: shop.state,
        zipCode: shop.zipCode,
        shopType: shop.shopType || 'general',
        status: shop.status,
        accountStatus: shop.status,
        activityStatus,
        hasActiveSession,
        lastLogin,
        profileComplete: shop.profileComplete,
        createdAt: shop.createdAt,
        approvedAt: shop.approvedAt,
        // Live metrics
        totalJobs,
        completedJobs,
        completionRate,
        totalRevenue,
        revenueThisMonth,
        revenueLastMonth,
        jobsThisMonth,
        jobsLastMonth,
        rating: Math.round(avgRating * 10) / 10,
        reviewCount: shop.reviews.length,
        techCount: shop.techs.length,
        activeTechs
      };
    });

    // Calculate aggregate stats
    const totalShops = shops.length;
    const activeShops = formattedShops.filter(s => s.activityStatus === 'active').length;
    const inactiveShops = formattedShops.filter(s => s.activityStatus === 'inactive').length;
    const approvedShops = shops.filter(s => s.status === 'approved').length;
    const pendingShops = shops.filter(s => s.status === 'pending').length;
    const suspendedShops = shops.filter(s => s.status === 'suspended').length;
    
    // Shops by status trend
    const newShopsThisMonth = shops.filter(s => new Date(s.createdAt) >= startOfMonth).length;
    const newShopsLastMonth = shops.filter(s => 
      new Date(s.createdAt) >= startOfLastMonth && new Date(s.createdAt) <= endOfLastMonth
    ).length;
    const shopGrowth = newShopsLastMonth > 0 
      ? Math.round(((newShopsThisMonth - newShopsLastMonth) / newShopsLastMonth) * 100)
      : newShopsThisMonth > 0 ? 100 : 0;

    // Approval rate (last 30 days)
    const recentShops = shops.filter(s => new Date(s.createdAt) >= thirtyDaysAgo);
    const recentApproved = recentShops.filter(s => s.status === 'approved').length;
    const approvalRate = recentShops.length > 0 
      ? Math.round((recentApproved / recentShops.length) * 100) 
      : 0;

    // Revenue metrics
    const totalPlatformRevenue = formattedShops.reduce((sum, s) => sum + s.totalRevenue, 0);
    const revenueThisMonth = formattedShops.reduce((sum, s) => sum + s.revenueThisMonth, 0);
    const revenueLastMonth = formattedShops.reduce((sum, s) => sum + s.revenueLastMonth, 0);
    const revenueGrowth = revenueLastMonth > 0 
      ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100)
      : revenueThisMonth > 0 ? 100 : 0;

    // Jobs metrics
    const totalJobs = formattedShops.reduce((sum, s) => sum + s.totalJobs, 0);
    const totalJobsThisMonth = formattedShops.reduce((sum, s) => sum + s.jobsThisMonth, 0);
    const totalJobsLastMonth = formattedShops.reduce((sum, s) => sum + s.jobsLastMonth, 0);
    const jobsGrowth = totalJobsLastMonth > 0
      ? Math.round(((totalJobsThisMonth - totalJobsLastMonth) / totalJobsLastMonth) * 100)
      : totalJobsThisMonth > 0 ? 100 : 0;

    const accountBreakdown = {
      active: 0,
      trialing: 0,
      cancelled: 0,
      none: shops.length,
    };

    // Top performing shops (by revenue)
    const topShops = [...formattedShops]
      .filter(s => s.status === 'approved')
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5);

    // Recent activity (last 7 days)
    const recentActivity = shops
      .filter(s => new Date(s.createdAt) >= sevenDaysAgo)
      .map(s => ({
        id: s.id,
        name: s.shopName,
        action: 'registered',
        date: s.createdAt,
        status: s.status
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 7-day trend data for chart
    const shopTrend: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const count = shops.filter(s => {
        const created = new Date(s.createdAt);
        return created >= date && created < nextDate;
      }).length;
      shopTrend.push(count);
    }

    return NextResponse.json({
      success: true,
      shops: formattedShops,
      liveMetrics: {
        totalShops,
        activeShops,
        inactiveShops,
        approvedShops,
        pendingShops,
        suspendedShops,
        newShopsThisMonth,
        newShopsLastMonth,
        shopGrowth: `${shopGrowth >= 0 ? '+' : ''}${shopGrowth}%`,
        approvalRate: `${approvalRate}%`,
        totalPlatformRevenue,
        revenueThisMonth,
        revenueLastMonth,
        revenueGrowth: `${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth}%`,
        totalJobs,
        totalJobsThisMonth,
        totalJobsLastMonth,
        jobsGrowth: `${jobsGrowth >= 0 ? '+' : ''}${jobsGrowth}%`,
        accountBreakdown,
        topShops,
        recentActivity,
        shopTrend,
      }
    });
  } catch (error) {
    console.error('Error fetching admin shops:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch shops data' },
      { status: 500 }
    );
  }
}
