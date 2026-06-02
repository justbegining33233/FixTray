import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

const VALID_COMMANDS = ['lock', 'wipe', 'update_policy', 'check_compliance'] as const;
type MDMCommandType = typeof VALID_COMMANDS[number];

// POST /api/mdm/commands â€” Send a command to a device
export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'shop']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { deviceId, command, parameters } = body as {
      deviceId: string;
      command: MDMCommandType;
      parameters?: Record<string, unknown>;
    };

    if (!deviceId || !command) {
      return NextResponse.json({ error: 'Device ID and command are required' }, { status: 400 });
    }

    if (!VALID_COMMANDS.includes(command as MDMCommandType)) {
      return NextResponse.json({ error: 'Invalid command type' }, { status: 400 });
    }

    const device = await prisma.mdmDevice.findFirst({
      where: { deviceId, status: 'active' },
    });

    if (!device) {
      return NextResponse.json({ error: 'Device not found in MDM' }, { status: 404 });
    }

    const mdmCommand = await prisma.mdmCommand.create({
      data: {
        deviceId:   device.id,
        command,
        parameters: parameters as Prisma.InputJsonValue | undefined,
        createdBy:  auth.id,
        status:     command === 'check_compliance' ? 'executed' : 'pending',
        executedAt: command === 'check_compliance' ? new Date() : undefined,
      },
    });

    const severity = command === 'wipe' ? 'critical' : 'high';
    await prisma.auditLog.create({
      data: {
        adminId:    auth.id,
        action:     'security:mdm_command_sent',
        targetType: severity,
        details:    JSON.stringify({ deviceId, command, commandId: mdmCommand.id }),
      },
    }).catch(() => {});

    return NextResponse.json({
      success:   true,
      commandId: mdmCommand.id,
      deviceId,
      command,
      status:    mdmCommand.status,
      createdAt: mdmCommand.createdAt,
      message:   `MDM command '${command}' queued for device`,
    });
  } catch (error) {
    console.error('MDM command error:', error);
    return NextResponse.json({ error: 'Failed to send MDM command' }, { status: 500 });
  }
}

// GET /api/mdm/commands?deviceId=xxx â€” Get pending commands for a device
export async function GET(request: NextRequest) {
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
      return NextResponse.json({ error: 'Device not found or not active in MDM' }, { status: 404 });
    }

    const commands = await prisma.mdmCommand.findMany({
      where: { deviceId: device.id, status: 'pending' },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      deviceId,
      commands: commands.map(c => ({
        id:         c.id,
        command:    c.command,
        parameters: c.parameters,
        createdAt:  c.createdAt,
        createdBy:  c.createdBy,
      })),
      count: commands.length,
    });
  } catch (error) {
    console.error('MDM commands fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch MDM commands' }, { status: 500 });
  }
}
