import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const shop = await prisma.shop.findUnique({
      where: { id },
      select: {
        id: true,
        shopName: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        ownerName: true,
        description: true,
        status: true,
        workOrders: {
          select: {
            id: true,
            status: true,
            amountPaid: true,
            paymentStatus: true,
            createdAt: true,
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

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    // Date calculations
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Calculate stats
    const totalJobs = shop.workOrders.length;
    const completedJobs = shop.workOrders.filter(wo => wo.status === 'closed' || wo.status === 'completed').length;
    const totalRevenue = shop.workOrders
      .filter(wo => wo.paymentStatus === 'paid')
      .reduce((sum, wo) => sum + (wo.amountPaid || 0), 0);
    
    const revenueThisMonth = shop.workOrders
      .filter(wo => wo.paymentStatus === 'paid' && new Date(wo.createdAt) >= startOfMonth)
      .reduce((sum, wo) => sum + (wo.amountPaid || 0), 0);
    
    const revenueLastMonth = totalRevenue - revenueThisMonth;
    const completionRate = totalJobs > 0 ? completedJobs / totalJobs : 0;
    
    const activeTechs = shop.techs.filter(t => t.available === true).length;
    const avgRating = shop.reviews.length > 0
      ? shop.reviews.reduce((sum, r) => sum + r.rating, 0) / shop.reviews.length
      : 0;

    const formattedShop = {
      id: shop.id,
      name: shop.shopName,
      email: shop.email,
      phone: shop.phone,
      location: shop.city && shop.state ? `${shop.city}, ${shop.state}` : shop.address || 'N/A',
      status: shop.status || 'approved',
      activityStatus: 'active' as const,
      totalJobs,
      completedJobs,
      completionRate,
      totalRevenue,
      revenueThisMonth,
      revenueLastMonth,
      rating: avgRating,
      techCount: shop.techs.length,
      activeTechs,
      address: shop.address,
      city: shop.city,
      state: shop.state,
      zipCode: shop.zipCode,
      ownerName: shop.ownerName,
      description: shop.description,
    };

    return NextResponse.json({ shop: formattedShop }, { status: 200 });
  } catch (error) {
    console.error('Error fetching shop details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shop details' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

    // Validate shop exists
    const existingShop = await prisma.shop.findUnique({ where: { id } });
    if (!existingShop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: Record<string, any> = {};
    if (body.status !== undefined) updateData.status = body.status;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.name !== undefined) updateData.shopName = body.name;
    if (body.location !== undefined) updateData.address = body.location;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.city !== undefined) updateData.city = body.city;
    if (body.state !== undefined) updateData.state = body.state;
    if (body.zipCode !== undefined) updateData.zipCode = body.zipCode;
    if (body.description !== undefined) updateData.description = body.description;

    // Update shop
    const updatedShop = await prisma.shop.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        shopName: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        ownerName: true,
        description: true,
        status: true,
        workOrders: {
          select: {
            id: true,
            status: true,
            amountPaid: true,
            paymentStatus: true,
            createdAt: true,
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

    // Recalculate metrics
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalJobs = updatedShop.workOrders.length;
    const completedJobs = updatedShop.workOrders.filter(wo => wo.status === 'closed' || wo.status === 'completed').length;
    const totalRevenue = updatedShop.workOrders
      .filter(wo => wo.paymentStatus === 'paid')
      .reduce((sum, wo) => sum + (wo.amountPaid || 0), 0);
    
    const revenueThisMonth = updatedShop.workOrders
      .filter(wo => wo.paymentStatus === 'paid' && new Date(wo.createdAt) >= startOfMonth)
      .reduce((sum, wo) => sum + (wo.amountPaid || 0), 0);
    
    const revenueLastMonth = totalRevenue - revenueThisMonth;
    const completionRate = totalJobs > 0 ? completedJobs / totalJobs : 0;
    
    const activeTechs = updatedShop.techs.filter(t => t.available === true).length;
    const avgRating = updatedShop.reviews.length > 0
      ? updatedShop.reviews.reduce((sum, r) => sum + r.rating, 0) / updatedShop.reviews.length
      : 0;

    const formattedShop = {
      id: updatedShop.id,
      name: updatedShop.shopName,
      email: updatedShop.email,
      phone: updatedShop.phone,
      location: updatedShop.city && updatedShop.state ? `${updatedShop.city}, ${updatedShop.state}` : updatedShop.address || 'N/A',
      status: updatedShop.status || 'approved',
      activityStatus: 'active' as const,
      totalJobs,
      completedJobs,
      completionRate,
      totalRevenue,
      revenueThisMonth,
      revenueLastMonth,
      rating: avgRating,
      techCount: updatedShop.techs.length,
      activeTechs,
      address: updatedShop.address,
      city: updatedShop.city,
      state: updatedShop.state,
      zipCode: updatedShop.zipCode,
      ownerName: updatedShop.ownerName,
      description: updatedShop.description,
    };

    return NextResponse.json({ shop: formattedShop }, { status: 200 });
  } catch (error) {
    console.error('Error updating shop:', error);
    return NextResponse.json(
      { error: 'Failed to update shop' },
      { status: 500 }
    );
  }
}
