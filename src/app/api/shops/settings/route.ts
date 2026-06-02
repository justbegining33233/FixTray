import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { validateCsrf } from '@/lib/csrf';

// GET shop settings
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    // Scope shopId: admins choose; shop owners use their id; managers/techs use their shopId
    const shopId = (auth.role === 'superadmin')
      ? searchParams.get('shopId')
      : (auth.role === 'shop' ? auth.id : auth.shopId);

    if (!shopId) {
      return NextResponse.json({ error: 'Shop ID is required' }, { status: 400 });
    }

    // Get shop details
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      include: {
        services: true, // Include related services
      },
    });

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    const shopSettings = await prisma.shopSettings.upsert({
      where: { shopId },
      update: {},
      create: { shopId },
    });

    return NextResponse.json({
      shop: {
        id: shop.id,
        shopName: shop.shopName,
        email: shop.email,
        phone: shop.phone,
        address: shop.address,
        city: shop.city,
        state: shop.state,
        zipCode: shop.zipCode,
        businessLicense: shop.businessLicense,
        insurancePolicy: shop.insurancePolicy,
        shopType: shop.shopType,
        services: shop.services.map(s => ({
          id: s.id,
          serviceName: s.serviceName,
          category: s.category,
          price: s.price,
        })),
        stripeConnected: !!shop.stripeAccountId,
      },
      settings: {
        notificationsEnabled: shopSettings.notificationsEnabled,
        notificationSoundEnabled: shopSettings.notificationSoundEnabled,
        notificationPreferences: shopSettings.notificationPreferences || {},
        fixtrayAgreement:
          (shopSettings.notificationPreferences &&
          typeof shopSettings.notificationPreferences === 'object' &&
          !Array.isArray(shopSettings.notificationPreferences)
            ? (shopSettings.notificationPreferences as Record<string, unknown>).fixtrayAgreement
            : null) || null,
      },
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching shop settings:', error);
    return NextResponse.json({ error: 'Failed to fetch shop settings' }, { status: 500 });
  }
}

// PUT update shop settings
export async function PUT(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    // Require CSRF when using cookie-based auth
    if (!request.headers.get('authorization')) {
      const ok = await validateCsrf(request);
      if (!ok) return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
    }

    const body = await request.json();
    const { shopId, shopName, email, phone, address, city, state, zipCode, notificationSettings, fixtrayAgreement } = body;

    if (!shopId) {
      return NextResponse.json({ error: 'Shop ID is required' }, { status: 400 });
    }

    // Only allow shop owner or admin to update
    if (auth.role !== 'superadmin' && auth.id !== shopId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Update shop details
    const updatedShop = await prisma.shop.update({
      where: { id: shopId },
      data: {
        shopName,
        email,
        phone,
        address,
        city,
        state,
        zipCode,
        updatedAt: new Date(),
      },
    });

    if (notificationSettings || fixtrayAgreement) {
      const existingSettings = await prisma.shopSettings.findUnique({
        where: { shopId },
        select: { notificationPreferences: true },
      });

      const existingPrefs =
        existingSettings?.notificationPreferences &&
        typeof existingSettings.notificationPreferences === 'object' &&
        !Array.isArray(existingSettings.notificationPreferences)
          ? (existingSettings.notificationPreferences as Record<string, unknown>)
          : {};

      const incomingPrefs =
        notificationSettings?.notificationPreferences &&
        typeof notificationSettings.notificationPreferences === 'object' &&
        !Array.isArray(notificationSettings.notificationPreferences)
          ? (notificationSettings.notificationPreferences as Record<string, unknown>)
          : {};

      const mergedPrefs: Record<string, unknown> = {
        ...existingPrefs,
        ...incomingPrefs,
      };

      if (fixtrayAgreement) {
        mergedPrefs.fixtrayAgreement = fixtrayAgreement;
      }

      const settingsUpdateData: Prisma.ShopSettingsUpdateInput = {
        notificationPreferences: mergedPrefs as Prisma.InputJsonValue,
      };

      if (notificationSettings?.notificationsEnabled !== undefined) {
        settingsUpdateData.notificationsEnabled = notificationSettings.notificationsEnabled;
      }

      if (notificationSettings?.notificationSoundEnabled !== undefined) {
        settingsUpdateData.notificationSoundEnabled = notificationSettings.notificationSoundEnabled;
      }

      await prisma.shopSettings.upsert({
        where: { shopId },
        update: settingsUpdateData,
        create: {
          shopId,
          notificationsEnabled: notificationSettings?.notificationsEnabled ?? true,
          notificationSoundEnabled: notificationSettings?.notificationSoundEnabled ?? true,
          notificationPreferences: mergedPrefs as Prisma.InputJsonValue,
        },
      });
    }

    return NextResponse.json({
      message: 'Shop settings updated successfully',
      shop: updatedShop,
    }, { status: 200 });
  } catch (error) {
    console.error('Error updating shop settings:', error);
    return NextResponse.json({ error: 'Failed to update shop settings' }, { status: 500 });
  }
}
