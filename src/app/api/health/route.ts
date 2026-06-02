import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
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
    return NextResponse.json({
      status: 'degraded',
      timestamp,
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
