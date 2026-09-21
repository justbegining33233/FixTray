import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Verify customer token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'customer') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const zipCode = searchParams.get('zipCode');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build where clause
    const where: Record<string, unknown> = {
      status: { in: ['approved', 'pending'] }
    };

    if (zipCode) {
      where.zipCode = {
        startsWith: zipCode
      };
    }

    if (search) {
      // Check if search looks like a zip code (all digits)
      const isZipSearch = /^\d+$/.test(search);
      
      if (isZipSearch) {
        // Search by zip code
        where.zipCode = {
          startsWith: search
        };
      } else {
        // Search by name or address
        where.OR = [
          { shopName: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } }
        ];
      }
    }

    // Fetch approved shops
    const shops = await prisma.shop.findMany({
      where,
      take: limit,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        services: {
          where: { isActive: true },
          select: {
            serviceName: true,
            category: true
          }
        },
        workOrders: {
          where: {
            status: 'closed'
          },
          select: {
            id: true
          }
        },
        reviews: {
          select: {
            rating: true
          }
        }
      }
    });

    // Format response
    const formattedShops = shops.map(shop => {
      // Calculate average rating
      const avgRating = shop.reviews.length > 0
        ? shop.reviews.reduce((sum, r) => sum + r.rating, 0) / shop.reviews.length
        : 0;

      // Get unique service names
      const services = [...new Set(shop.services.map(s => s.serviceName))];

      return {
        id: shop.id,
        name: shop.shopName,
        address: shop.address,
        zipCode: shop.zipCode,
        phone: shop.phone,
        rating: Math.round(avgRating * 10) / 10,
        completedJobs: shop.workOrders.length,
        services,
        distance: null // Would need geolocation to calculate
      };
    });

    return NextResponse.json({ shops: formattedShops });
  } catch (error) {
    console.error('Error fetching shops:', error);
    return NextResponse.json({ error: 'Failed to fetch shops' }, { status: 500 });
  }
}
