'use server';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { getSettings } from '@/lib/platform-settings';

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = startOfMonth;
    const feePerWorkOrder = (getSettings().serviceFee || 500) / 100;

    const customers: any[] = await prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        workOrders: {
          select: {
            id: true,
            status: true,
            amountPaid: true,
            paymentStatus: true,
            createdAt: true,
          },
        },
        reviews: { select: { rating: true } },
        vehicles: { select: { id: true } },
        favoriteShops: { select: { id: true } },
      },
    });

    const formattedCustomers = customers.map((customer: any) => {
      const totalJobs = customer.workOrders.length;
      const completedJobs = customer.workOrders.filter((wo: any) => wo.status === 'closed' || wo.status === 'completed').length;
      const completionRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;

      const paidWorkOrders = customer.workOrders.filter((wo: any) => wo.paymentStatus === 'paid');
      const totalRevenue = paidWorkOrders.reduce((sum: number, wo: any) => sum + (wo.amountPaid || 0), 0);

      const paidWorkOrdersThisMonth = paidWorkOrders.filter((wo: any) => new Date(wo.createdAt) >= startOfMonth);
      const paidWorkOrdersLastMonth = paidWorkOrders.filter((wo: any) => {
        const createdAt = new Date(wo.createdAt);
        return createdAt >= startOfLastMonth && createdAt < endOfLastMonth;
      });

      const revenueThisMonth = paidWorkOrdersThisMonth.reduce((sum: number, wo: any) => sum + (wo.amountPaid || 0), 0);
      const revenueLastMonth = paidWorkOrdersLastMonth.reduce((sum: number, wo: any) => sum + (wo.amountPaid || 0), 0);

      const jobsThisMonth = customer.workOrders.filter((wo: any) => new Date(wo.createdAt) >= startOfMonth).length;
      const jobsLastMonth = customer.workOrders.filter((wo: any) => {
        const createdAt = new Date(wo.createdAt);
        return createdAt >= startOfLastMonth && createdAt < endOfLastMonth;
      }).length;

      const totalFixtrayFees = paidWorkOrders.length * feePerWorkOrder;
      const feesThisMonth = paidWorkOrdersThisMonth.length * feePerWorkOrder;
      const feesLastMonth = paidWorkOrdersLastMonth.length * feePerWorkOrder;

      const avgRating = customer.reviews.length > 0
        ? customer.reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / customer.reviews.length
        : 0;

      const lifetimeMonths = Math.max(
        1,
        Math.round((now.getTime() - new Date(customer.createdAt).getTime()) / (30 * 24 * 60 * 60 * 1000))
      );

      const vehiclesCount = customer.vehicles.length;
      const favoriteShopsCount = customer.favoriteShops.length;

      const activityScore = Math.min(100, jobsThisMonth * 10);
      const engagementScore = Math.min(100, (vehiclesCount + favoriteShopsCount) * 12);
      const revenueScore = Math.min(100, paidWorkOrdersThisMonth.length * 8);
      const healthScore = Math.round((activityScore + engagementScore + revenueScore) / 3);

      return {
        id: customer.id,
        name: `${customer.firstName} ${customer.lastName}`.trim(),
        email: customer.email,
        phone: customer.phone || 'N/A',
        company: customer.company || 'N/A',
        location: customer.company || 'N/A',
        profileComplete: Boolean(customer.phone),
        createdAt: customer.createdAt,
        totalJobs,
        completedJobs,
        completionRate,
        totalRevenue,
        revenueThisMonth,
        revenueLastMonth,
        totalFixtrayFees,
        feesThisMonth,
        feesLastMonth,
        paidWorkOrders: paidWorkOrders.length,
        paidWorkOrdersThisMonth: paidWorkOrdersThisMonth.length,
        paidWorkOrdersLastMonth: paidWorkOrdersLastMonth.length,
        jobsThisMonth,
        jobsLastMonth,
        rating: Math.round(avgRating * 10) / 10,
        reviewCount: customer.reviews.length,
        healthScore,
        lifetimeMonths,
        vehiclesCount,
        favoriteShopsCount,
        emailVerified: customer.emailVerified,
      };
    });

    const totalCustomers = customers.length;
    const newCustomersThisMonth = customers.filter((c: any) => new Date(c.createdAt) >= startOfMonth).length;
    const newCustomersLastMonth = customers.filter((c: any) => {
      const createdAt = new Date(c.createdAt);
      return createdAt >= startOfLastMonth && createdAt < endOfLastMonth;
    }).length;
    const customerGrowth = newCustomersLastMonth > 0
      ? Math.round(((newCustomersThisMonth - newCustomersLastMonth) / newCustomersLastMonth) * 100)
      : newCustomersThisMonth > 0 ? 100 : 0;

    const totalWorkOrderRevenue = formattedCustomers.reduce((sum: number, c: any) => sum + c.totalRevenue, 0);
    const workOrderRevenueThisMonth = formattedCustomers.reduce((sum: number, c: any) => sum + c.revenueThisMonth, 0);
    const workOrderRevenueLastMonth = formattedCustomers.reduce((sum: number, c: any) => sum + c.revenueLastMonth, 0);

    const totalFixtrayFees = formattedCustomers.reduce((sum: number, c: any) => sum + c.totalFixtrayFees, 0);
    const fixtrayFeesThisMonth = formattedCustomers.reduce((sum: number, c: any) => sum + c.feesThisMonth, 0);
    const fixtrayFeesLastMonth = formattedCustomers.reduce((sum: number, c: any) => sum + c.feesLastMonth, 0);
    const totalPaidWorkOrders = formattedCustomers.reduce((sum: number, c: any) => sum + c.paidWorkOrders, 0);
    const paidWorkOrdersThisMonth = formattedCustomers.reduce((sum: number, c: any) => sum + c.paidWorkOrdersThisMonth, 0);

    const feeGrowth = fixtrayFeesLastMonth > 0
      ? Math.round(((fixtrayFeesThisMonth - fixtrayFeesLastMonth) / fixtrayFeesLastMonth) * 100)
      : fixtrayFeesThisMonth > 0 ? 100 : 0;

    const totalJobs = formattedCustomers.reduce((sum: number, c: any) => sum + c.totalJobs, 0);
    const totalJobsThisMonth = formattedCustomers.reduce((sum: number, c: any) => sum + c.jobsThisMonth, 0);
    const totalJobsLastMonth = formattedCustomers.reduce((sum: number, c: any) => sum + c.jobsLastMonth, 0);
    const jobsGrowth = totalJobsLastMonth > 0
      ? Math.round(((totalJobsThisMonth - totalJobsLastMonth) / totalJobsLastMonth) * 100)
      : totalJobsThisMonth > 0 ? 100 : 0;

    const avgLifetimeMonths = formattedCustomers.length > 0
      ? formattedCustomers.reduce((sum: number, c: any) => sum + c.lifetimeMonths, 0) / formattedCustomers.length
      : 0;

    const healthDistribution = {
      excellent: formattedCustomers.filter((c: any) => c.healthScore >= 80).length,
      good: formattedCustomers.filter((c: any) => c.healthScore >= 60 && c.healthScore < 80).length,
      fair: formattedCustomers.filter((c: any) => c.healthScore >= 40 && c.healthScore < 60).length,
      poor: formattedCustomers.filter((c: any) => c.healthScore < 40).length,
    };

    const topCustomers = [...formattedCustomers]
      .sort((a: any, b: any) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5);

    const atRiskCustomers = formattedCustomers
      .filter((c: any) => c.healthScore < 40)
      .slice(0, 5);

    const customerTrend: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const count = customers.filter((c: any) => {
        const createdAt = new Date(c.createdAt);
        return createdAt >= dayStart && createdAt < dayEnd;
      }).length;

      customerTrend.push(count);
    }

    const revenueTrend: number[] = [];
    const feeTrend: number[] = [];

    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      let dayRevenue = 0;
      let dayPaidWorkOrders = 0;

      customers.forEach((c: any) => {
        c.workOrders.forEach((wo: any) => {
          if (wo.paymentStatus !== 'paid') return;
          const woDate = new Date(wo.createdAt);
          if (woDate >= dayStart && woDate < dayEnd) {
            dayRevenue += wo.amountPaid || 0;
            dayPaidWorkOrders += 1;
          }
        });
      });

      revenueTrend.push(dayRevenue);
      feeTrend.push(dayPaidWorkOrders * feePerWorkOrder);
    }

    return NextResponse.json({
      success: true,
      customers: formattedCustomers,
      liveMetrics: {
        totalCustomers,
        newCustomersThisMonth,
        newCustomersLastMonth,
        customerGrowth: `${customerGrowth >= 0 ? '+' : ''}${customerGrowth}%`,
        feePerWorkOrder,
        totalFixtrayFees,
        fixtrayFeesThisMonth,
        fixtrayFeesLastMonth,
        feeGrowth: `${feeGrowth >= 0 ? '+' : ''}${feeGrowth}%`,
        totalPaidWorkOrders,
        paidWorkOrdersThisMonth,
        avgLifetimeMonths: Math.round(avgLifetimeMonths),
        totalWorkOrderRevenue,
        workOrderRevenueThisMonth,
        workOrderRevenueLastMonth,
        totalJobs,
        totalJobsThisMonth,
        totalJobsLastMonth,
        jobsGrowth: `${jobsGrowth >= 0 ? '+' : ''}${jobsGrowth}%`,
        healthDistribution,
        topCustomers,
        atRiskCustomers,
        customerTrend,
        revenueTrend,
        feeTrend,
      },
    });
  } catch (error) {
    console.error('Error fetching admin customers:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch customers data' },
      { status: 500 }
    );
  }
}
