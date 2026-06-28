import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

async function getOrCreateConfig() {
  let config = await prisma.platformConfig.findUnique({ where: { id: 'global' } });
  if (!config) {
    config = await prisma.platformConfig.create({
      data: { id: 'global' },
    });
  }
  return config;
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;
  try {
    const config = await getOrCreateConfig();
    return NextResponse.json({ settings: config });
  } catch {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json();
    const updateData: Record<string, unknown> = {};
    if (typeof body.serviceFee === 'number') updateData.serviceFee = Math.round(body.serviceFee * 100);
    if (typeof body.serviceFeeRaw === 'number') updateData.serviceFee = body.serviceFeeRaw;
    if (typeof body.platformName === 'string') updateData.platformName = body.platformName;
    if (typeof body.supportEmail === 'string') updateData.supportEmail = body.supportEmail;
    if (typeof body.maintenanceMode === 'boolean') updateData.maintenanceMode = body.maintenanceMode;
    if (typeof body.enableShopRegistration === 'boolean') updateData.enableShopRegistration = body.enableShopRegistration;
    if (typeof body.enableCustomerPortal === 'boolean') updateData.enableCustomerPortal = body.enableCustomerPortal;
    if (typeof body.enableEmailNotifications === 'boolean') updateData.enableEmailNotifications = body.enableEmailNotifications;
    const settings = await prisma.platformConfig.upsert({
      where: { id: 'global' },
      create: { id: 'global', ...updateData },
      update: updateData,
    });
    return NextResponse.json({ settings, message: 'Settings saved successfully' });
  } catch {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;
  try {
    const settings = await prisma.platformConfig.upsert({
      where: { id: 'global' },
      create: { id: 'global' },
      update: { serviceFee: 500, platformName: 'FixTray', maintenanceMode: false },
    });
    return NextResponse.json({ settings, message: 'Settings reset to defaults' });
  } catch {
    return NextResponse.json({ error: 'Failed to reset settings' }, { status: 500 });
  }
}
