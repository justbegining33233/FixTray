export function unwrapWorkOrders(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object' && Array.isArray((payload as { workOrders?: unknown }).workOrders)) {
    return (payload as { workOrders: any[] }).workOrders;
  }
  return [];
}

export function unwrapTechs(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object' && Array.isArray((payload as { techs?: unknown }).techs)) {
    return (payload as { techs: any[] }).techs;
  }
  return [];
}

export function workOrderDetailPath(id: string): string {
  return `/workorders/${id}`;
}

export const OPEN_WORK_ORDER_STATUSES = [
  'pending',
  'assigned',
  'in-progress',
  'waiting-estimate',
] as const;

export function isAwaitingClockIn(wo: { assignedTechId?: string | null; assignedTo?: unknown }): boolean {
  return !wo.assignedTechId && !wo.assignedTo;
}
