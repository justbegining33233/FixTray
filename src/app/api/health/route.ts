import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

// HIGH FIX #7: Require admin authentication for health endpoint
export async function GET(request: NextRequest) {
  // Check authentication
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const timestamp = Date.now();

  try {
    const [lastIssue] = await Promise.all([
      prisma.activityLog.findFirst({
        where: { severity: { in: ['error', 'critical'] } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, action: true },
      }),
      prisma.$queryRaw`SELECT 1`,
    ]);

    const memory = process.memoryUsage();
    const runtime = {
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        rssMb: memory.rss / (1024 * 1024),
        heapUsedMb: memory.heapUsed / (1024 * 1024),
      },
    };
    const lastIssueAt = lastIssue?.createdAt ? lastIssue.createdAt.getTime() : null;
    const lastIssueAgeSeconds = lastIssueAt
      ? Math.max(0, Math.floor((timestamp - lastIssueAt) / 1000))
      : null;
    const healthyForSeconds = lastIssueAt
      ? Math.max(0, Math.floor((timestamp - lastIssueAt) / 1000))
      : null;

    return NextResponse.json({
      status: 'ok',
      timestamp,
      ...runtime,
      db: {
        connected: true,
        checkedAt: timestamp,
        lastIssueAt,
        lastIssueAgeSeconds,
        healthyForSeconds,
        statusMessage: lastIssueAt
          ? `Last issue ${lastIssueAgeSeconds}s ago`
          : 'No recent critical issues',
        lastIssueType: lastIssue?.action || null,
      },
    });
  } catch {
    const memory = process.memoryUsage();
    return NextResponse.json({
      status: 'degraded',
      timestamp,
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        rssMb: memory.rss / (1024 * 1024),
        heapUsedMb: memory.heapUsed / (1024 * 1024),
      },
      db: {
        connected: false,
        checkedAt: timestamp,
        lastIssueAt: null,
        lastIssueAgeSeconds: null,
        healthyForSeconds: null,
        statusMessage: 'Database connection failed',
        lastIssueType: 'db_connectivity',
      },
    }, { status: 503 });
  }
}
