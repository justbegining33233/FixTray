/** Shop calendar asks for 200 rows. Anything above this is still rejected. */
export const MAX_WORK_ORDER_LIST_LIMIT = 200;

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

export function unwrapTeam(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const record = payload as { team?: unknown; technicians?: unknown; techs?: unknown };
    if (Array.isArray(record.team)) return record.team;
    if (Array.isArray(record.technicians)) return record.technicians;
    if (Array.isArray(record.techs)) return record.techs;
  }
  return [];
}

export function unwrapVehicles(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object' && Array.isArray((payload as { vehicles?: unknown }).vehicles)) {
    return (payload as { vehicles: any[] }).vehicles;
  }
  return [];
}
