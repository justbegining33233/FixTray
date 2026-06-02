import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import type { AuthUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  // Require authentication — shop discovery is only for logged-in users
  const auth = requireRole(request, ['customer', 'shop', 'manager', 'tech', 'admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;

  try {
    // Return all approved shops from the database
    const approvedShops = await prisma.shop.findMany({
      where: {
        status: 'approved'
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        workOrders: {
          select: {
            id: true,
            amountPaid: true,
            paymentStatus: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          }
        },
        reviews: {
          select: {
            rating: true,
          }
        },
        services: {
          select: {
            id: true,
            serviceName: true,
            category: true,
            price: true,
            duration: true,
            description: true
          }
        }
      }
    });

    // Format response — only expose public-facing fields (NO password, no credentials)
    const formattedShops = approvedShops.map((shop) => {
      const completedJobs = shop.workOrders.filter(wo => wo.status === 'closed').length;
      const totalRevenue = shop.workOrders
        .filter(wo => wo.paymentStatus === 'paid')
        .reduce((sum, wo) => sum + (wo.amountPaid || 0), 0);

      // Real rating from reviews (average, rounded to 1 decimal)
      const reviewRatings = (shop as any).reviews?.map((r: any) => r.rating).filter(Boolean) ?? [];
      const rating = reviewRatings.length > 0
        ? Math.round((reviewRatings.reduce((s: number, r: number) => s + r, 0) / reviewRatings.length) * 10) / 10
        : 0;

      const totalJobs = shop.workOrders.length;
      const completionRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;

      // Real average response time: mean of (updatedAt - createdAt) for closed work orders
      const closedOrders = shop.workOrders.filter(wo => wo.status === 'closed');
      let averageResponseTime = 'N/A';
      if (closedOrders.length > 0) {
        const avgMs = closedOrders.reduce((sum, wo) => {
          return sum + (new Date(wo.updatedAt).getTime() - new Date(wo.createdAt).getTime());
        }, 0) / closedOrders.length;
        const avgHours = avgMs / (1000 * 60 * 60);
        if (avgHours < 1) {
          averageResponseTime = `${Math.round(avgHours * 60)} min`;
        } else if (avgHours < 24) {
          averageResponseTime = `${Math.round(avgHours * 10) / 10} hrs`;
        } else {
          averageResponseTime = `${Math.round(avgHours / 24 * 10) / 10} days`;
        }
      }

      const dieselServices = shop.services.filter(s => s.category === 'diesel');
      const gasServices = shop.services.filter(s => s.category === 'gas');

      return {
        id: shop.id,
        name: shop.shopName,
        shopName: shop.shopName,
        location: `${shop.city || ''}, ${shop.state || ''}`.trim(),
        address: shop.address,
        phone: shop.phone,
        shopType: shop.shopType,
        services: shop.services.length,
        rating,
        reviewCount: reviewRatings.length,
        jobs: completedJobs,
        revenue: `$${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
        completionRate,
        averageResponseTime,
        profileComplete: shop.profileComplete,
        zipCode: shop.zipCode,
        joinedDate: shop.createdAt,
        createdAt: shop.createdAt,
        dieselServices,
        gasServices,
        // NOTE: email and credentials intentionally omitted
      };
    });

    return NextResponse.json(formattedShops);
  } catch (error) {
    console.error('Error fetching approved shops:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accepted shops' },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json({ message: 'Use /api/shops/pending to create shops' }, { status: 400 });
}

export async function PATCH(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'manager', 'admin']);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const { shopId, profileComplete, businessLicense, insurancePolicy, shopType } = body;

    if (!shopId) return NextResponse.json({ error: 'shopId required' }, { status: 400 });

    // Shop-role users may only update their own profile
    if (user.role === 'shop' && user.shopId !== shopId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updatedShop = await prisma.shop.update({
      where: { id: shopId },
      data: {
        ...(profileComplete !== undefined && { profileComplete }),
        ...(businessLicense !== undefined && { businessLicense }),
        ...(insurancePolicy !== undefined && { insurancePolicy }),
        ...(shopType !== undefined && { shopType }),
      }
    });

    return NextResponse.json({ message: 'Shop profile updated', shop: updatedShop }, { status: 200 });
  } catch (error) {
    console.error('Error updating shop:', error);
    return NextResponse.json({ error: 'Failed to update shop' }, { status: 500 });
  }
}
