import { ACTIVE_WORK_ORDER_STATUSES } from './workOrderMetrics';

/** Dashboard "active jobs" plus en-route, which tracking already treated as live. */
export const TRACKABLE_WORK_ORDER_STATUSES = [...ACTIVE_WORK_ORDER_STATUSES, 'en-route'] as const;

export function customerTrackingWhere(customerId: string, workOrderId?: string | null) {
  const where: { customerId: string; status: { in: string[] }; id?: string } = {
    customerId,
    status: { in: [...TRACKABLE_WORK_ORDER_STATUSES] },
  };
  if (workOrderId) where.id = workOrderId;
  return where;
}
