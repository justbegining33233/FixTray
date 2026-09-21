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

export { ACTIVE_WORK_ORDER_STATUSES as OPEN_WORK_ORDER_STATUSES } from './workOrderMetrics';

export function isAwaitingClockIn(wo: { assignedTechId?: string | null; assignedTo?: unknown }): boolean {
  return !wo.assignedTechId && !wo.assignedTo;
}

export function unwrapVehicles(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object' && Array.isArray((payload as { vehicles?: unknown }).vehicles)) {
    return (payload as { vehicles: any[] }).vehicles;
  }
  return [];
}
