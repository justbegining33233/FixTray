import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

// Legacy compatibility endpoint. New code should use /api/shops/settings.
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const shopId = auth.role === 'shop' ? auth.id : auth.shopId;
    if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 });

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        shopName: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
      },
    });

    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

    return NextResponse.json({
      id: shop.id,
      shopName: shop.shopName,
      name: shop.shopName,
      email: shop.email,
      phone: shop.phone,
      address: shop.address,
      city: shop.city,
      state: shop.state,
      zipCode: shop.zipCode,
      zip: shop.zipCode,
    });
  } catch (error) {
    console.error('Legacy shop profile GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch shop profile' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const shopId = auth.role === 'shop' ? auth.id : (body.shopId || auth.shopId);
    if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 });

    if (auth.role !== 'superadmin' && auth.id !== shopId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const updated = await prisma.shop.update({
      where: { id: shopId },
      data: {
        shopName: body.shopName || body.name,
        email: body.email,
        phone: body.phone,
        address: body.address,
        city: body.city,
        state: body.state,
        zipCode: body.zipCode || body.zip,
      },
      select: {
        id: true,
        shopName: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
      },
    });

    return NextResponse.json({
      id: updated.id,
      shopName: updated.shopName,
      name: updated.shopName,
      email: updated.email,
      phone: updated.phone,
      address: updated.address,
      city: updated.city,
      state: updated.state,
      zipCode: updated.zipCode,
      zip: updated.zipCode,
    });
  } catch (error) {
    console.error('Legacy shop profile PUT error:', error);
    return NextResponse.json({ error: 'Failed to update shop profile' }, { status: 500 });
  }
}
