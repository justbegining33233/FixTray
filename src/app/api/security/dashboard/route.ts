/**
 * Security Dashboard API Route
 * GET /api/security/dashboard
 * 
 * Returns comprehensive security metrics for admin monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { getSecurityMetrics, getSecurityAlerts, getSecurityTrends } from '@/lib/security-monitoring';

export async function GET(request: NextRequest) {
  // Require admin authentication
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    // Get comprehensive security data
    const metrics = await getSecurityMetrics();
    const alerts = await getSecurityAlerts({ limit: 20, hours: 24 });
    const trends = await getSecurityTrends({ days: 7 });

    return NextResponse.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        metrics,
        alerts,
        trends,
        summary: {
          securityScore: 100 - metrics.riskScore,
          riskLevel: metrics.riskLevel,
          systemHealthy: metrics.apiHealthy && metrics.databaseHealthy,
          criticalAlerts: alerts.filter((a) => a.severity === 'critical').length,
          recentThreats: {
            failedLogins: metrics.failedLogins24h,
            accountLockouts: metrics.accountLockouts24h,
            unauthorizedAttempts: metrics.unauthorizedAttempts24h,
            suspiciousIPsCount: metrics.suspiciousIPs.length,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[SECURITY] Dashboard error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve security metrics' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
