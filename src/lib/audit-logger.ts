/**
 * Security Audit Logger
 * 
 * Tracks security events for monitoring and compliance
 */

import prisma from '@/lib/prisma';

export interface SecurityEvent {
  eventType: 'login_success' | 'login_failed' | 'login_lockout' | 'password_change' | 'session_invalidated' | 'unauthorized_access' | 'account_lockout' | 'account_unlock';
  userId?: string;
  email?: string;
  role?: string;
  ip: string;
  userAgent: string;
  details?: Record<string, unknown>;
  severity: 'info' | 'warn' | 'error' | 'critical';
}

/**
 * Log a security event
 */
export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        action: `SECURITY: ${event.eventType}`,
        email: event.email || 'unknown',
        type: 'security',
        severity: event.severity,
        details: event.eventType,
        user: event.email || 'system',
        metadata: JSON.stringify({
          eventType: event.eventType,
          userId: event.userId,
          email: event.email,
          role: event.role,
          ip: event.ip,
          userAgent: event.userAgent,
          ...event.details,
        }),
      },
    });

    // Also log to console for real-time monitoring
    const logLevel = {
      'info': 'info',
      'warn': 'warn',
      'error': 'error',
      'critical': 'error',
    }[event.severity];

    console.log(`[SECURITY] ${event.eventType} - ${event.email || event.userId || 'unknown'} from ${event.ip}`);
  } catch (error) {
    console.error('[AUDIT] Failed to log security event:', error);
  }
}

/**
 * Get security events for monitoring/dashboard
 */
export async function getSecurityEvents(options?: {
  hours?: number;
  eventType?: string;
  severity?: string;
  limit?: number;
}) {
  try {
    const hoursBack = options?.hours || 24;
    const sinceTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const events = await prisma.activityLog.findMany({
      where: {
        type: 'security',
        createdAt: { gte: sinceTime },
        ...(options?.eventType && { action: { contains: options.eventType } }),
        ...(options?.severity && { severity: options.severity }),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 100,
    });

    return events;
  } catch (error) {
    console.error('[AUDIT] Failed to retrieve security events:', error);
    return [];
  }
}

/**
 * Get security dashboard stats
 */
export async function getSecurityStats(options?: { hours?: number }) {
  try {
    const hoursBack = options?.hours || 24;
    const sinceTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const events = await prisma.activityLog.findMany({
      where: {
        type: 'security',
        createdAt: { gte: sinceTime },
      },
    });

    const stats = {
      totalSecurityEvents: events.length,
      successfulLogins: events.filter(e => e.action.includes('login_success')).length,
      failedLogins: events.filter(e => e.action.includes('login_failed')).length,
      accountLockouts: events.filter(e => e.action.includes('lockout')).length,
      unauthorizedAccess: events.filter(e => e.action.includes('unauthorized')).length,
      passwordChanges: events.filter(e => e.action.includes('password_change')).length,
      criticalEvents: events.filter(e => e.severity === 'critical').length,
    };

    return stats;
  } catch (error) {
    console.error('[AUDIT] Failed to get security stats:', error);
    return {
      totalSecurityEvents: 0,
      successfulLogins: 0,
      failedLogins: 0,
      accountLockouts: 0,
      unauthorizedAccess: 0,
      passwordChanges: 0,
      criticalEvents: 0,
    };
  }
}

/**
 * Alert on critical security events
 */
export async function alertOnCriticalEvent(event: SecurityEvent): Promise<void> {
  if (event.severity !== 'critical') return;

  try {
    // Send alert (integrate with monitoring service: PagerDuty, Slack, etc.)
    console.error(
      `[SECURITY ALERT] CRITICAL EVENT: ${event.eventType} for ${event.email || event.userId} from ${event.ip}`
    );

    // Example: Send to webhook
    if (process.env.SECURITY_WEBHOOK_URL) {
      try {
        await fetch(process.env.SECURITY_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'security_alert',
            severity: event.severity,
            event: event.eventType,
            email: event.email,
            timestamp: new Date(),
          }),
        });
      } catch (error) {
        console.error('[ALERT] Failed to send webhook:', error);
      }
    }
  } catch (error) {
    console.error('[AUDIT] Failed to send alert:', error);
  }
}
