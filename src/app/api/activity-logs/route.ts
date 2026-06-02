import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const severity = searchParams.get('severity');
    const limit = searchParams.get('limit');

    const where: any = {};
    if (type && type !== 'all') where.type = type;
    if (severity && severity !== 'all') where.severity = severity;

    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit) : 100,
    });

    // Map createdAt ΓåÆ time for backwards compatibility with frontend
    const mapped = logs.map(log => ({ ...log, time: log.createdAt }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('Failed to fetch activity logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity logs' },
      { status: 500 }
    );
  }
}
