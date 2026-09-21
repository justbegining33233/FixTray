/**
 * One definition per work-order metric.
 *
 * Active / Open jobs (customer Active Orders & Active Jobs, shop Open Jobs,
 * shop admin Open Work Orders, manager Active Jobs):
 *   pending, assigned, in-progress, waiting-estimate, estimate-submitted,
 *   waiting-for-payment, awaiting-confirmation.
 * Terminal statuses are not active: completed, closed, cancelled, canceled,
 * denied-estimate.
 *
 * Pending queue (shop Home Pending Queue and the Home Pending Approvals tile):
 *   status pending. The tile and the queue list both use this set.
 *
 * Unassigned / Awaiting clock-in (manager badges):
 *   status pending and no assignedTechId / assignedTo.
 *
 * Pending approvals (shop admin Pending Actions work-order half):
 *   waiting-estimate, estimate-submitted.
 *   This is intentionally not the pending queue. Admin labels it separately.
 *
 * Completed today / this month:
 *   status completed or closed, updatedAt in the period.
 *
 * Overdue:
 *   active status and dueDate before now.
 */

export const ACTIVE_WORK_ORDER_STATUSES = [
  'pending',
  'assigned',
  'in-progress',
  'waiting-estimate',
  'estimate-submitted',
  'waiting-for-payment',
  'awaiting-confirmation',
] as const;

export const PENDING_QUEUE_STATUSES = ['pending'] as const;

export const PENDING_APPROVAL_STATUSES = [
  'waiting-estimate',
  'estimate-submitted',
] as const;

export const COMPLETED_WORK_ORDER_STATUSES = ['completed', 'closed'] as const;

export const TERMINAL_WORK_ORDER_STATUSES = [
  'completed',
  'closed',
  'cancelled',
  'canceled',
  'denied-estimate',
] as const;

export type WorkOrderLike = {
  status?: unknown;
  assignedTechId?: string | null;
  assignedTo?: unknown;
  updatedAt?: string | Date | null;
  completedAt?: string | Date | null;
  dueDate?: string | Date | null;
};

export function normalizeWorkOrderStatus(status: unknown): string {
  return String(status ?? '').trim().toLowerCase();
}

export function isActiveWorkOrder(workOrder: { status?: unknown }): boolean {
  const status = normalizeWorkOrderStatus(workOrder.status);
  if (!status) return false;
  return (ACTIVE_WORK_ORDER_STATUSES as readonly string[]).includes(status);
}

export function isPendingQueueWorkOrder(workOrder: { status?: unknown }): boolean {
  return (PENDING_QUEUE_STATUSES as readonly string[]).includes(normalizeWorkOrderStatus(workOrder.status));
}

export function isPendingApprovalWorkOrder(workOrder: { status?: unknown }): boolean {
  return (PENDING_APPROVAL_STATUSES as readonly string[]).includes(normalizeWorkOrderStatus(workOrder.status));
}

export function isCompletedWorkOrder(workOrder: { status?: unknown }): boolean {
  return (COMPLETED_WORK_ORDER_STATUSES as readonly string[]).includes(normalizeWorkOrderStatus(workOrder.status));
}

/** Pending and nobody assigned yet. Clock-in is what assigns the technician. */
export function isUnassignedWorkOrder(workOrder: WorkOrderLike): boolean {
  if (!isPendingQueueWorkOrder(workOrder)) return false;
  return !workOrder.assignedTechId && !workOrder.assignedTo;
}

function inPeriod(value: string | Date | null | undefined, start: Date, end: Date): boolean {
  if (!value) return false;
  const when = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(when.getTime())) return false;
  return when.getTime() >= start.getTime() && when.getTime() < end.getTime();
}

export function startOfLocalDay(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function startOfLocalMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export type WorkOrderSummary = {
  active: number;
  openJobs: number;
  pendingQueue: number;
  pendingApprovals: number;
  unassigned: number;
  completed: number;
  completedToday: number;
  completedThisMonth: number;
  overdue: number;
};

/** Page-level counters. API routes use the matching where-builders below. */
export function summarizeWorkOrders(orders: WorkOrderLike[] | null | undefined, now = new Date()): WorkOrderSummary {
  const list = Array.isArray(orders) ? orders : [];
  const dayStart = startOfLocalDay(now);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const monthStart = startOfLocalMonth(now);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  let active = 0;
  let pendingQueue = 0;
  let pendingApprovals = 0;
  let unassigned = 0;
  let completed = 0;
  let completedToday = 0;
  let completedThisMonth = 0;
  let overdue = 0;

  for (const order of list) {
    if (isActiveWorkOrder(order)) {
      active += 1;
      if (order.dueDate) {
        const due = order.dueDate instanceof Date ? order.dueDate : new Date(order.dueDate);
        if (!Number.isNaN(due.getTime()) && due.getTime() < now.getTime()) overdue += 1;
      }
    }
    if (isPendingQueueWorkOrder(order)) pendingQueue += 1;
    if (isPendingApprovalWorkOrder(order)) pendingApprovals += 1;
    if (isUnassignedWorkOrder(order)) unassigned += 1;
    if (isCompletedWorkOrder(order)) {
      completed += 1;
      const stamp = order.updatedAt || order.completedAt;
      if (inPeriod(stamp, dayStart, dayEnd)) completedToday += 1;
      if (inPeriod(stamp, monthStart, monthEnd)) completedThisMonth += 1;
    }
  }

  return {
    active,
    openJobs: active,
    pendingQueue,
    pendingApprovals,
    unassigned,
    completed,
    completedToday,
    completedThisMonth,
    overdue,
  };
}

export function statusIn(statuses: readonly string[]) {
  return { in: [...statuses] };
}

export function activeWorkOrderWhere(scope: object) {
  return { ...scope, status: statusIn(ACTIVE_WORK_ORDER_STATUSES) };
}

export function pendingQueueWhere(scope: object) {
  return { ...scope, status: statusIn(PENDING_QUEUE_STATUSES) };
}

export function pendingApprovalWhere(scope: object) {
  return { ...scope, status: statusIn(PENDING_APPROVAL_STATUSES) };
}

export function unassignedWorkOrderWhere(scope: object) {
  return { ...scope, status: statusIn(PENDING_QUEUE_STATUSES), assignedTechId: null };
}

export function completedWorkOrderWhere(scope: object) {
  return { ...scope, status: statusIn(COMPLETED_WORK_ORDER_STATUSES) };
}

export function completedTodayWhere(scope: object, now = new Date()) {
  return {
    ...completedWorkOrderWhere(scope),
    updatedAt: { gte: startOfLocalDay(now) },
  };
}

export function completedThisMonthWhere(scope: object, now = new Date()) {
  return {
    ...completedWorkOrderWhere(scope),
    updatedAt: { gte: startOfLocalMonth(now) },
  };
}

export function overdueWorkOrderWhere(scope: object, now = new Date()) {
  return {
    ...activeWorkOrderWhere(scope),
    dueDate: { lt: now },
  };
}

export type ShopActor = {
  id: string;
  role: string;
  shopId?: string | null;
};

export type ShopScopeResult =
  | { ok: true; shopId: string }
  | { ok: false; error: 'missing' | 'forbidden' };

/**
 * Shop id for shop-scoped metrics.
 * Shop owners use token shopId or their own id.
 * Managers and techs use token shopId only — never their user id
 * (that query matches nothing and paints every total as zero).
 * A requested shopId that is not the actor's shop is forbidden.
 */
export function resolveShopId(actor: ShopActor, requestedShopId?: string | null): ShopScopeResult {
  const requested = String(requestedShopId || '').trim();
  if (actor.role === 'superadmin' || actor.role === 'admin') {
    if (!requested) return { ok: false, error: 'missing' };
    return { ok: true, shopId: requested };
  }
  const own = actor.role === 'shop' ? (actor.shopId || actor.id) : (actor.shopId || '');
  if (!own) return { ok: false, error: 'missing' };
  if (requested && requested !== own) return { ok: false, error: 'forbidden' };
  return { ok: true, shopId: own };
}

export type WorkOrderActor = {
  id: string;
  role: string;
  shopId?: string | null;
};

export function workOrderScope(
  actor: WorkOrderActor,
  requestedShopId?: string | null,
): { scope: Record<string, string> } | { error: string; status: number } {
  if (actor.role === 'customer') {
    const scope: Record<string, string> = { customerId: actor.id };
    if (requestedShopId) scope.shopId = requestedShopId;
    return { scope };
  }
  if (actor.role === 'shop' || actor.role === 'manager' || actor.role === 'tech') {
    // Ignore a caller-supplied shopId. A stale query value must not empty the
    // queue while token-scoped counts still see the shop's jobs.
    const resolved = resolveShopId(actor, null);
    if (!resolved.ok) {
      return {
        error: resolved.error === 'forbidden' ? 'Forbidden' : 'Shop ID required',
        status: resolved.error === 'forbidden' ? 403 : 400,
      };
    }
    return { scope: { shopId: resolved.shopId } };
  }
  if (actor.role === 'superadmin' || actor.role === 'admin') {
    return { scope: requestedShopId ? { shopId: requestedShopId } : {} };
  }
  return { error: 'Forbidden', status: 403 };
}

export function workOrderTitle(workOrder: { issueDescription?: unknown; serviceType?: unknown }): string {
  if (typeof workOrder.serviceType === 'string' && workOrder.serviceType.trim()) {
    return workOrder.serviceType.trim().split('\n')[0];
  }
  const issue = workOrder.issueDescription;
  if (typeof issue === 'string' && issue.trim()) return issue.trim().split('\n')[0];
  if (issue && typeof issue === 'object' && 'symptoms' in issue) {
    const symptoms = (issue as { symptoms?: unknown }).symptoms;
    if (typeof symptoms === 'string' && symptoms.trim()) return symptoms.trim().split('\n')[0];
  }
  return 'Service';
}
