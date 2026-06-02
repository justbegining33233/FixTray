/**
 * Activity Logger — writes structured audit events to the ActivityLog table.
 * Import and call logActivity() from any API route to record significant actions.
 *
 * Uses a fire-and-forget pattern by default (non-blocking), so it never slows
 * down the route that calls it. Set await=true only when you need the guarantee.
 */
import prisma from '@/lib/prisma';

export type ActivityAction =
  | 'login'
  | 'logout'
  | 'shop_approved'
  | 'shop_suspended'
  | 'shop_pending'
  | 'shop_registered'
  | 'workorder_created'
  | 'workorder_completed'
  | 'workorder_assigned'
  | 'user_created'
  | 'user_deleted'
  | 'password_changed'
  | 'settings_updated'
  | string;

export type ActivityType = 'shop' | 'revenue' | 'user' | 'alert';
export type ActivitySeverity = 'info' | 'success' | 'warning' | 'error';

interface LogActivityOptions {
  type?: ActivityType;
  severity?: ActivitySeverity;
  shopId?: string;
  location?: string;
  email?: string;
  amount?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Write a single activity log entry.
 * Errors are swallowed so a logging failure never breaks the calling route.
 */
export async function logActivity(
  action: ActivityAction,
  user: string,
  details: string,
  options: LogActivityOptions = {}
): Promise<void> {
  try {
    const type: ActivityType = options.type ?? inferType(action);
    const severity: ActivitySeverity = options.severity ?? inferSeverity(action);

    await prisma.activityLog.create({
      data: {
        action,
        user,
        details,
        type,
        severity,
        shopId: options.shopId ?? null,
        location: options.location ?? null,
        email: options.email ?? null,
        amount: options.amount ?? null,
        metadata: options.metadata ? JSON.stringify(options.metadata) : null,
      },
    });
  } catch (err) {
    // Never throw — logging must never break the primary request
    console.error('[activityLogger] Failed to write activity log:', err);
  }
}

function inferType(action: string): ActivityType {
  if (action.startsWith('shop_') || action === 'workorder_created' || action === 'workorder_completed') return 'shop';
  if (action.includes('revenue') || action.includes('payment')) return 'revenue';
  if (action.startsWith('user_') || action === 'login' || action === 'logout' || action === 'password_changed') return 'user';
  return 'alert';
}

function inferSeverity(action: string): ActivitySeverity {
  if (action === 'shop_approved' || action === 'workorder_completed') return 'success';
  if (action === 'shop_suspended' || action === 'user_deleted') return 'warning';
  if (action === 'login' || action === 'shop_registered' || action === 'workorder_created') return 'info';
  return 'info';
}
