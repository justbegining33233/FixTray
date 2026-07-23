/**
 * Authorization Validator
 * 
 * Centralized authorization checks for scope validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { logSecurityEvent } from '@/lib/audit-logger';
import { getClientIP } from '@/lib/rateLimit';
import logger from '@/lib/logger';

export interface AuthorizationScope {
  resource: string;
  action: string;
  ownerId?: string; // For resource ownership check
}

/**
 * Verify user has authorization for resource
 * Prevents unauthorized access across role boundaries
 */
export async function verifyResourceAuthorization(options: {
  request: NextRequest;
  userId: string;
  userRole: string;
  userEmail: string;
  scope: AuthorizationScope;
  ownerId?: string; // Resource owner ID for ownership check
}): Promise<{ authorized: boolean; error?: string }> {
  const { request, userId, userRole, userEmail, scope, ownerId } = options;

  try {
    // Check resource ownership if applicable
    if (scope.ownerId && ownerId && ownerId !== userId && userRole !== 'admin' && userRole !== 'superadmin') {
      const clientIP = getClientIP(request);
      const userAgent = request.headers.get('user-agent') || '';

      await logSecurityEvent({
        eventType: 'unauthorized_access',
        userId,
        email: userEmail,
        role: userRole,
        ip: clientIP,
        userAgent,
        details: {
          resource: scope.resource,
          action: scope.action,
          ownerId,
          reason: 'ownership_mismatch',
        },
        severity: 'error',
      });

      return {
        authorized: false,
        error: `Unauthorized: Cannot access ${scope.resource}`,
      };
    }

    // Role-based action restrictions
    const restrictedActions: Record<string, string[]> = {
      'delete': ['admin', 'superadmin'], // Only admins can delete
      'export': ['admin', 'superadmin', 'manager'], // Limited to upper roles
      'escalate': ['tech', 'manager', 'admin', 'superadmin'], // Tech or above
    };

    if (restrictedActions[scope.action]) {
      const allowedRoles = restrictedActions[scope.action];
      if (!allowedRoles.includes(userRole)) {
        const clientIP = getClientIP(request);
        const userAgent = request.headers.get('user-agent') || '';

        await logSecurityEvent({
          eventType: 'unauthorized_access',
          userId,
          email: userEmail,
          role: userRole,
          ip: clientIP,
          userAgent,
          details: {
            resource: scope.resource,
            action: scope.action,
            requiredRoles: allowedRoles,
            reason: 'role_insufficient',
          },
          severity: 'error',
        });

        return {
          authorized: false,
          error: `Unauthorized: ${scope.action} requires ${allowedRoles.join(' or ')}`,
        };
      }
    }

    return { authorized: true };
  } catch (error) {
    logger.error('[SECURITY] Authorization check error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      authorized: false,
      error: 'Authorization check failed',
    };
  }
}

/**
 * Scope validation middleware for API endpoints
 */
export function validateScope(requiredRoles: string[]) {
  return async (request: NextRequest, userId: string, userRole: string, userEmail: string) => {
    if (!requiredRoles.includes(userRole)) {
      const clientIP = getClientIP(request);
      const userAgent = request.headers.get('user-agent') || '';

      await logSecurityEvent({
        eventType: 'unauthorized_access',
        userId,
        email: userEmail,
        role: userRole,
        ip: clientIP,
        userAgent,
        details: { requiredRoles },
        severity: 'error',
      });

      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    return null;
  };
}
