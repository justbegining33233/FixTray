import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

// GET /api/shop/switch — list all shops the logged-in shop owner or multi-shop manager can access
export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    if (auth.role === 'superadmin') {
      // Admin can see all shops
      const shops = await prisma.shop.findMany({
        where: { status: 'approved' },
        select: { id: true, shopName: true, email: true, city: true, state: true },
        orderBy: { shopName: 'asc' },
      });
      return NextResponse.json({ shops });
    }

    // For shop owners, find shops with the same email (multi-shop ownership)
    const currentShop = await prisma.shop.findUnique({
      where: { id: auth.id },
      select: { email: true },
    });

    if (!currentShop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    const shops = await prisma.shop.findMany({
      where: { email: currentShop.email, status: 'approved' },
      select: { id: true, shopName: true, email: true, city: true, state: true },
      orderBy: { shopName: 'asc' },
    });

    return NextResponse.json({ shops, currentShopId: auth.id });
  } catch (error) {
    console.error('Error fetching shops for switch:', error);
    return NextResponse.json({ error: 'Failed to fetch shops' }, { status: 500 });
  }
}

// POST /api/shop/switch — switch to a different shop, issue new tokens
export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { shopId } = await request.json();
    if (!shopId) {
      return NextResponse.json({ error: 'shopId required' }, { status: 400 });
    }

    const targetShop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, username: true, shopName: true, email: true, phone: true, profileComplete: true, status: true },
    });

    if (!targetShop || targetShop.status !== 'approved') {
      return NextResponse.json({ error: 'Shop not found or not approved' }, { status: 404 });
    }

    // Verify the user owns this shop (same email) unless admin
    if (auth.role === 'shop') {
      const currentShop = await prisma.shop.findUnique({
        where: { id: auth.id },
        select: { email: true },
      });
      if (!currentShop || currentShop.email !== targetShop.email) {
        return NextResponse.json({ error: 'Unauthorized — you do not own this shop' }, { status: 403 });
      }
    }

    // Issue new access token for the target shop
    const { generateAccessToken } = await import('@/lib/auth');
    const accessToken = generateAccessToken({ id: targetShop.id, shopId: targetShop.id, username: targetShop.username, role: 'shop' });

    const response = NextResponse.json({
      id: targetShop.id,
      username: targetShop.username,
      shopName: targetShop.shopName,
      email: targetShop.email,
      phone: targetShop.phone,
      profileComplete: targetShop.profileComplete,
      status: targetShop.status,
      accessToken,
    });

    response.cookies.set('sos_auth', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 15,
    });

    return response;
  } catch (error) {
    console.error('Error switching shop:', error);
    return NextResponse.json({ error: 'Failed to switch shop' }, { status: 500 });
  }
}
