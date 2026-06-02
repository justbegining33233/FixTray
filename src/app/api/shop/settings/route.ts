import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

// GET - Get operational shop settings (GPS, labor rates, budgets, clock rules).
// For shop profile + notification settings use /api/shops/settings.
export async function GET(request: NextRequest) {
  const decoded = requireAuth(request);
  if (decoded instanceof NextResponse) return decoded;

  if (!['shop', 'manager', 'admin', 'tech'].includes(decoded.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    // Scope shopId: admins can pass any; shop owners use their own id; managers/techs use their shopId
    const shopId = (decoded.role === 'superadmin')
      ? searchParams.get('shopId')
      : (decoded.role === 'shop' ? decoded.id : decoded.shopId);

    if (!shopId) {
      return NextResponse.json({ error: 'Shop ID required' }, { status: 400 });
    }

    let settings = await prisma.shopSettings.findUnique({
      where: { shopId },
    });

    // Create default settings if they don't exist
    if (!settings) {
      settings = await prisma.shopSettings.create({
        data: {
          shopId,
          defaultLaborRate: 85.0,
          inventoryMarkup: 0.30, // 30% markup on parts
          taxRate: 0.08,
          allowTimeTracking: true,
          requireClockInOut: false,
        },
      });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error fetching shop settings:', error);
    return NextResponse.json({ error: 'Failed to fetch shop settings' }, { status: 500 });
  }
}

// PUT - Update operational shop settings
export async function PUT(request: NextRequest) {
  const decoded = requireAuth(request);
  if (decoded instanceof NextResponse) return decoded;

  if (decoded.role !== 'shop' && (decoded.role !== 'superadmin')) {
    return NextResponse.json({ error: 'Unauthorized - Shop admin only' }, { status: 403 });
  }

  try {

    const body = await request.json();
    const { shopId, ...settingsData } = body;

    if (!shopId) {
      return NextResponse.json({ error: 'Shop ID required' }, { status: 400 });
    }

    // Verify the shop belongs to the user
    if (decoded.id !== shopId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Update or create settings
    const settings = await prisma.shopSettings.upsert({
      where: { shopId },
      update: settingsData,
      create: {
        shopId,
        ...settingsData,
      },
    });

    return NextResponse.json({ settings, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating shop settings:', error);
    return NextResponse.json({ error: 'Failed to update shop settings' }, { status: 500 });
  }
}
