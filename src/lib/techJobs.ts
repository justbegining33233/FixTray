const CLOSED = new Set(['closed', 'completed', 'cancelled', 'canceled', 'paid']);

export function isClosedJobStatus(status: unknown): boolean {
  return CLOSED.has(String(status || '').toLowerCase());
}

export function techOwnsJob(order: { assignedTechId?: string | null; assignedTo?: { id?: string | null } | null }, techId: string): boolean {
  if (!techId) return false;
  if (order?.assignedTechId === techId) return true;
  return order?.assignedTo?.id === techId;
}

export function filterTechJobs<T extends { assignedTechId?: string | null; assignedTo?: { id?: string | null } | null; status?: unknown }>(
  orders: T[],
  techId: string,
  view: 'active' | 'history',
): T[] {
  return orders.filter((order) => {
    if (!techOwnsJob(order, techId)) return false;
    const closed = isClosedJobStatus(order.status);
    return view === 'history' ? closed : !closed;
  });
}

export function techJobsHref(view: 'active' | 'history'): string {
  return view === 'history' ? '/tech/jobs?view=history' : '/tech/jobs?view=active';
}
