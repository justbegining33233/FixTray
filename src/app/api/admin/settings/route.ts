import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { ensureProductionColumns } from '@/lib/ensureProductionColumns';
import { invalidatePlatformConfigCache } from '@/lib/platformConfig';
import { platformSettingsUpdate } from '@/lib/platformSettingsPatch';

async function getOrCreateConfig() {
  await ensureProductionColumns();
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
    const parsed = platformSettingsUpdate(body && typeof body === 'object' ? body : {});
    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    await ensureProductionColumns();
    const settings = await prisma.platformConfig.upsert({
      where: { id: 'global' },
      create: { id: 'global', ...parsed.data },
      update: parsed.data,
    });
    invalidatePlatformConfigCache();
    return NextResponse.json({ settings, message: 'Settings saved successfully' });
  } catch {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureProductionColumns();
    const settings = await prisma.platformConfig.upsert({
      where: { id: 'global' },
      create: { id: 'global' },
      update: { serviceFee: 500, platformName: 'FixTray', maintenanceMode: false, defaultLanguage: 'en' },
    });
    invalidatePlatformConfigCache();
    return NextResponse.json({ settings, message: 'Settings reset to defaults' });
  } catch {
    return NextResponse.json({ error: 'Failed to reset settings' }, { status: 500 });
  }
}
