import { NextRequest, NextResponse } from 'next/server';
import { getAuditLogs } from '@/lib/auditLog';
import { requireRole } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const logs = await getAuditLogs();
    return NextResponse.json(logs);
  } catch (error) {
    logger.error('Failed to fetch audit logs', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}
