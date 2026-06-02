import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
type Severity = typeof VALID_SEVERITIES[number];

// Security events are stored as AuditLog rows with:
//   action     = "security:<eventType>"
//   targetType = severity level  (repurposed for filtering)
//   adminId    = userId (or "system" for anonymous events)
//   details    = JSON string of the caller-supplied details object

function securityAction(eventType: string) {
  return `security:${eventType}`;
}

// POST /api/security/events â€” Log a security event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, eventType, details, severity, shopId } = body;

    if (!eventType || !severity) {
      return NextResponse.json({ error: 'Event type and severity are required' }, { status: 400 });
    }
    if (!VALID_SEVERITIES.includes(severity as Severity)) {
      return NextResponse.json({ error: 'Invalid severity level' }, { status: 400 });
    }

    const ipAddress =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const log = await prisma.auditLog.create({
      data: {
        adminId:    userId || 'system',
        action:     securityAction(eventType),
        targetType: severity,           // severity stored here for fast filtering
        details:    details ? JSON.stringify(details) : null,
        ipAddress,
        userAgent,
        shopId:     shopId || null,
      },
    });

    // Detect suspicious patterns for high/critical events (fire-and-forget)
    if (severity === 'high' || severity === 'critical') {
      checkForSecurityThreats(userId, eventType, details, ipAddress).catch(() => {});
    }

    return NextResponse.json({
      success:   true,
      eventId:   log.id,
      createdAt: log.createdAt,
      message:   'Security event logged successfully',
    });
  } catch (error) {
    console.error('Security event logging error:', error);
    return NextResponse.json({ error: 'Failed to log security event' }, { status: 500 });
  }
}

// GET /api/security/events â€” Query security events
// Query params: userId, eventType, severity, shopId, limit, offset
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId    = searchParams.get('userId')    || undefined;
    const eventType = searchParams.get('eventType') || undefined;
    const severity  = searchParams.get('severity')  || undefined;
    const shopId    = searchParams.get('shopId')    || undefined;
    const limit     = Math.min(parseInt(searchParams.get('limit')  || '50'),  200);
    const offset    = Math.max(parseInt(searchParams.get('offset') || '0'), 0);

    const where = {
      action:     eventType ? securityAction(eventType) : { startsWith: 'security:' },
      ...(userId    && { adminId:    userId }),
      ...(severity  && { targetType: severity }),
      ...(shopId    && { shopId }),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take:    limit,
        skip:    offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const events = logs.map(log => ({
      id:        log.id,
      userId:    log.adminId === 'system' ? null : log.adminId,
      eventType: log.action.replace(/^security:/, ''),
      severity:  log.targetType,
      details:   log.details ? JSON.parse(log.details) : null,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      shopId:    log.shopId,
      createdAt: log.createdAt,
    }));

    return NextResponse.json({ events, total, limit, offset });
  } catch (error) {
    console.error('Security events fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch security events' }, { status: 500 });
  }
}

// DELETE /api/security/events?daysOld=90 â€” Prune old low/medium events
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const daysOld = parseInt(searchParams.get('daysOld') || '90');

    if (daysOld < 30) {
      return NextResponse.json({ error: 'Cannot delete events less than 30 days old' }, { status: 400 });
    }

    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const { count } = await prisma.auditLog.deleteMany({
      where: {
        action:     { startsWith: 'security:' },
        NOT: { action: { in: ['security:device_wiped', 'security:account_locked', 'security:admin_action'] } },
        targetType: { in: ['low', 'medium'] },
        createdAt:  { lt: cutoff },
      },
    });

    return NextResponse.json({
      success:      true,
      deletedCount: count,
      message:      `Deleted ${count} old security events`,
    });
  } catch (error) {
    console.error('Security events cleanup error:', error);
    return NextResponse.json({ error: 'Failed to cleanup security events' }, { status: 500 });
  }
}

// â”€â”€â”€ Internal threat-detection helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function checkForSecurityThreats(
  userId: string | undefined,
  eventType: string,
  details: unknown,
  ipAddress: string,
) {
  const since15m = new Date(Date.now() - 15 * 60 * 1000);
  const since1h  = new Date(Date.now() - 60 * 60 * 1000);
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Brute-force detection: â‰¥5 failed logins in 15 minutes
  if (eventType === 'login_failed' && userId) {
    const failures = await prisma.auditLog.count({
      where: { adminId: userId, action: securityAction('login_failed'), createdAt: { gt: since15m } },
    });
    if (failures >= 5) {
      await prisma.auditLog.create({
        data: {
          adminId:    userId,
          action:     securityAction('potential_brute_force'),
          targetType: 'critical',
          details:    JSON.stringify({ failureCount: failures }),
          ipAddress,
        },
      });
    }
  }

  // New-location detection: login from an IP not seen in the last 30 days
  if (eventType === 'login_success' && userId) {
    const recentLogs = await prisma.auditLog.findMany({
      where: { adminId: userId, action: securityAction('login_success'), createdAt: { gt: since30d } },
      select: { ipAddress: true },
      distinct: ['ipAddress'],
    });
    const knownIPs = recentLogs.map(l => l.ipAddress).filter(Boolean);
    if (knownIPs.length > 0 && !knownIPs.includes(ipAddress)) {
      await prisma.auditLog.create({
        data: {
          adminId:    userId,
          action:     securityAction('suspicious_login_location'),
          targetType: 'high',
          details:    JSON.stringify({ newIP: ipAddress, knownIPs }),
          ipAddress,
        },
      });
    }
  }

  // Rapid password changes: â‰¥3 in 1 hour
  if (eventType === 'password_changed' && userId) {
    const changes = await prisma.auditLog.count({
      where: { adminId: userId, action: securityAction('password_changed'), createdAt: { gt: since1h } },
    });
    if (changes >= 3) {
      await prisma.auditLog.create({
        data: {
          adminId:    userId,
          action:     securityAction('rapid_password_changes'),
          targetType: 'high',
          details:    JSON.stringify({ changeCount: changes }),
          ipAddress,
        },
      });
    }
  }
}
