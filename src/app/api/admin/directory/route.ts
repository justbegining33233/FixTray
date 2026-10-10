import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { directoryBadge, splitDirectory, type DirectoryKind } from '@/lib/tenantDirectory';

const STAFF_ROLES = ['manager', 'tech', 'accountant'] as const;

function monthsSince(createdAt: Date, now: Date): number {
  return Math.max(1, Math.round((now.getTime() - createdAt.getTime()) / (30 * 24 * 60 * 60 * 1000)));
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [shops, techs, customers] = await Promise.all([
      prisma.shop.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          workOrders: {
            select: { id: true, status: true, amountPaid: true, paymentStatus: true, createdAt: true },
          },
          techs: { select: { id: true, available: true } },
          reviews: { select: { rating: true } },
        },
      }),
      prisma.tech.findMany({
        where: {
          OR: STAFF_ROLES.map((role) => ({ role: { equals: role, mode: 'insensitive' as const } })),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          shopId: true,
          shop: { select: { id: true, shopName: true } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      prisma.customer.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          company: true,
          createdAt: true,
          workOrders: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              shopId: true,
              shop: { select: { id: true, shopName: true } },
            },
          },
        },
      }),
    ]);

    const shopRows = shops.map((shop) => {
      const totalJobs = shop.workOrders.length;
      const completedJobs = shop.workOrders.filter((order) => order.status === 'closed' || order.status === 'completed').length;
      const paid = shop.workOrders.filter((order) => order.paymentStatus === 'paid');
      const totalRevenue = paid.reduce((sum, order) => sum + (order.amountPaid || 0), 0);
      const revenueThisMonth = paid
        .filter((order) => order.createdAt >= startOfMonth)
        .reduce((sum, order) => sum + (order.amountPaid || 0), 0);
      const revenueLastMonth = paid
        .filter((order) => order.createdAt >= startOfLastMonth && order.createdAt < startOfMonth)
        .reduce((sum, order) => sum + (order.amountPaid || 0), 0);
      const jobsThisMonth = shop.workOrders.filter((order) => order.createdAt >= startOfMonth).length;
      const jobsLastMonth = shop.workOrders.filter((order) => order.createdAt >= startOfLastMonth && order.createdAt < startOfMonth).length;
      const rating = shop.reviews.length
        ? Math.round((shop.reviews.reduce((sum, review) => sum + review.rating, 0) / shop.reviews.length) * 10) / 10
        : 0;
      const location = [shop.city, shop.state].filter(Boolean).join(', ') || shop.address || '';
      return {
        kind: 'shop' as DirectoryKind,
        id: shop.id,
        name: shop.shopName,
        ownerName: shop.ownerName?.trim() || '',
        email: shop.email,
        phone: shop.phone,
        location,
        shopType: shop.shopType || '',
        profileComplete: shop.profileComplete,
        createdAt: shop.createdAt.toISOString(),
        totalJobs,
        completedJobs,
        completionRate: totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0,
        totalRevenue,
        revenueThisMonth,
        revenueLastMonth,
        jobsThisMonth,
        jobsLastMonth,
        rating,
        reviewCount: shop.reviews.length,
        teamMembers: shop.techs.length,
        activeTeamMembers: shop.techs.filter((tech) => tech.available).length,
        healthScore: null as number | null,
        lifetimeMonths: monthsSince(shop.createdAt, now),
        badge: directoryBadge('shop'),
        shopId: shop.id,
        shopName: shop.shopName,
      };
    });

    const employeeRows = techs.map((tech) => ({
      kind: 'employee' as DirectoryKind,
      id: tech.id,
      name: `${tech.firstName} ${tech.lastName}`.trim(),
      email: tech.email,
      phone: tech.phone || '',
      role: tech.role,
      shopId: tech.shopId,
      shopName: tech.shop?.shopName || '',
      badge: directoryBadge('employee', tech.role),
    }));

    const customerRows = customers.map((customer) => {
      const latest = customer.workOrders[0];
      return {
        kind: 'customer' as DirectoryKind,
        id: customer.id,
        name: `${customer.firstName} ${customer.lastName}`.trim() || customer.company || customer.email,
        email: customer.email,
        phone: customer.phone || '',
        role: 'customer',
        shopId: latest?.shop?.id || latest?.shopId || null,
        shopName: latest?.shop?.shopName || '',
        badge: directoryBadge('customer'),
      };
    });

    return NextResponse.json(splitDirectory([...shopRows, ...employeeRows, ...customerRows]));
  } catch (error) {
    console.error('admin directory error:', error);
    return NextResponse.json({ error: 'Failed to load directory' }, { status: 500 });
  }
}
