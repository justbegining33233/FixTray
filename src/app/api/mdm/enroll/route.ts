import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

// POST /api/mdm/enroll â€” Enroll a device in MDM
export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'shop']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { deviceId, deviceInfo } = body as {
      deviceId: string;
      deviceInfo: {
        platform: string;
        model: string;
        operatingSystem: string;
        osVersion: string;
        manufacturer: string;
        isVirtual?: boolean;
      };
    };

    if (!deviceId || !deviceInfo) {
      return NextResponse.json({ error: 'Device ID and device info are required' }, { status: 400 });
    }

    const existing = await prisma.mdmDevice.findUnique({ where: { deviceId } });
    if (existing) {
      return NextResponse.json({ error: 'Device is already enrolled in MDM' }, { status: 409 });
    }

    const policies = await prisma.mdmPolicy.findMany({ where: { enabled: true } });

    const device = await prisma.mdmDevice.create({
      data: {
        deviceId,
        platform:        deviceInfo.platform,
        model:           deviceInfo.model,
        operatingSystem: deviceInfo.operatingSystem,
        osVersion:       deviceInfo.osVersion,
        manufacturer:    deviceInfo.manufacturer,
        isVirtual:       deviceInfo.isVirtual ?? false,
        userId:          auth.id,
        policies: {
          create: policies.map(p => ({ policyId: p.id })),
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId:    auth.id,
        action:     'security:device_enrolled',
        targetType: 'low',
        details:    JSON.stringify({ deviceId, platform: deviceInfo.platform }),
      },
    }).catch(() => {});

    return NextResponse.json({
      success:    true,
      deviceId:   device.id,
      enrolledAt: device.enrolledAt,
      policies:   policies.map(p => ({ id: p.id, name: p.name })),
      message:    'Device successfully enrolled in MDM',
    });
  } catch (error) {
    console.error('MDM enrollment error:', error);
    return NextResponse.json({ error: 'Failed to enroll device' }, { status: 500 });
  }
}

// DELETE /api/mdm/enroll?deviceId=xxx â€” Unenroll a device
export async function DELETE(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'shop']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID is required' }, { status: 400 });
    }

    const device = await prisma.mdmDevice.findFirst({
      where: { deviceId, status: 'active' },
    });

    if (!device) {
      return NextResponse.json({ error: 'Device not found or not enrolled' }, { status: 404 });
    }

    await prisma.mdmDevice.update({
      where: { id: device.id },
      data: { status: 'unenrolled', unenrolledAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        adminId:    auth.id,
        action:     'security:device_unenrolled',
        targetType: 'medium',
        details:    JSON.stringify({ deviceId }),
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, message: 'Device successfully unenrolled from MDM' });
  } catch (error) {
    console.error('MDM unenrollment error:', error);
    return NextResponse.json({ error: 'Failed to unenroll device' }, { status: 500 });
  }
}
