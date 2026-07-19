/**
 * Security Monitoring Dashboard
 * 
 * Provides metrics and insights for security posture
 */

import prisma from '@/lib/prisma';
import { getSecurityStats, getSecurityEvents } from '@/lib/audit-logger';

export interface SecurityMetrics {
  // Authentication
  successfulLogins24h: number;
  failedLogins24h: number;
  accountLockouts24h: number;
  
  // Threats
  unauthorizedAttempts24h: number;
  suspiciousIPs: string[];
  
  // 2FA
  twoFAEnabled: number;
  twoFADisabled: number;
  
  // System
  apiHealthy: boolean;
  databaseHealthy: boolean;
  
  // Risk Score (0-100)
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Get comprehensive security metrics
 */
export async function getSecurityMetrics(): Promise<SecurityMetrics> {
  try {
    // Get stats from last 24 hours
    const stats = await getSecurityStats({ hours: 24 });
    
    // Get suspicious activity
    const suspiciousEvents = await getSecurityEvents({
      hours: 24,
      severity: 'error',
      limit: 100,
    });

    // Extract suspicious IPs
    const suspiciousIPs = Array.from(
      new Set(
        suspiciousEvents
          .map((e) => {
            try {
              const metadata = JSON.parse(e.metadata || '{}');
              return metadata.ip;
            } catch {
              return null;
            }
          })
          .filter(Boolean)
      )
    ) as string[];

    // Calculate risk score
    const riskScore = calculateRiskScore({
      failedLogins: stats.failedLogins,
      accountLockouts: stats.accountLockouts,
      unauthorizedAccess: stats.unauthorizedAccess,
      successfulLogins: stats.successfulLogins,
    });

    // Check system health
    const apiHealthy = true; // Assume API is healthy if query succeeds
    const databaseHealthy = true; // If we got here, DB is working

    // Get 2FA usage
    const twoFAStats = await get2FAStats();

    return {
      successfulLogins24h: stats.successfulLogins,
      failedLogins24h: stats.failedLogins,
      accountLockouts24h: stats.accountLockouts,
      unauthorizedAttempts24h: stats.unauthorizedAccess,
      suspiciousIPs,
      twoFAEnabled: twoFAStats.enabled,
      twoFADisabled: twoFAStats.disabled,
      apiHealthy,
      databaseHealthy,
      riskScore,
      riskLevel: getRiskLevel(riskScore),
    };
  } catch (error) {
    console.error('[SECURITY] Failed to get metrics:', error);
    return getDefaultMetrics();
  }
}

/**
 * Calculate overall risk score (0-100)
 */
function calculateRiskScore(data: {
  failedLogins: number;
  accountLockouts: number;
  unauthorizedAccess: number;
  successfulLogins: number;
}): number {
  let score = 0;

  // Failed logins: 1 point per failed attempt (max 20)
  score += Math.min(data.failedLogins, 20);

  // Account lockouts: 10 points each (max 30)
  score += Math.min(data.accountLockouts * 10, 30);

  // Unauthorized access: 15 points each (max 30)
  score += Math.min(data.unauthorizedAccess * 15, 30);

  // Successful logins reduce risk slightly (max -10)
  score -= Math.min(data.successfulLogins * 0.1, 10);

  return Math.max(0, Math.min(100, score));
}

/**
 * Convert risk score to risk level
 */
function getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score < 20) return 'low';
  if (score < 40) return 'medium';
  if (score < 70) return 'high';
  return 'critical';
}

/**
 * Get 2FA adoption statistics
 */
async function get2FAStats(): Promise<{ enabled: number; disabled: number }> {
  try {
    // This is a placeholder - adjust based on your user model
    // For now, return dummy data
    return {
      enabled: 0,
      disabled: 0,
    };
  } catch (error) {
    console.error('[SECURITY] Failed to get 2FA stats:', error);
    return { enabled: 0, disabled: 0 };
  }
}

/**
 * Get default metrics (when data unavailable)
 */
function getDefaultMetrics(): SecurityMetrics {
  return {
    successfulLogins24h: 0,
    failedLogins24h: 0,
    accountLockouts24h: 0,
    unauthorizedAttempts24h: 0,
    suspiciousIPs: [],
    twoFAEnabled: 0,
    twoFADisabled: 0,
    apiHealthy: false,
    databaseHealthy: false,
    riskScore: 50,
    riskLevel: 'medium',
  };
}

/**
 * Get real-time security alerts
 */
export async function getSecurityAlerts(options?: { limit?: number; hours?: number }) {
  try {
    const events = await getSecurityEvents({
      hours: options?.hours || 24,
      severity: 'error',
      limit: options?.limit || 50,
    });

    return events.map((event) => ({
      id: event.id,
      type: event.action,
      timestamp: event.createdAt,
      severity: event.severity,
      details: event.metadata,
    }));
  } catch (error) {
    console.error('[SECURITY] Failed to get alerts:', error);
    return [];
  }
}

/**
 * Get trending security events
 */
export async function getSecurityTrends(options?: { days?: number }) {
  try {
    const trends: Record<string, number> = {};
    const days = options?.days || 7;

    // Get events for last N days
    const events = await getSecurityEvents({
      hours: days * 24,
      limit: 1000,
    });

    // Group by event type and date
    for (const event of events) {
      const date = new Date(event.createdAt).toISOString().split('T')[0];
      const key = `${event.action}_${date}`;
      trends[key] = (trends[key] || 0) + 1;
    }

    return trends;
  } catch (error) {
    console.error('[SECURITY] Failed to get trends:', error);
    return {};
  }
}
