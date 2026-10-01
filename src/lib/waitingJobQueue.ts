/**
 * Jobs waiting for work are first come, first served.
 * The oldest created job is first. A newest-first page must not be the
 * window a tech's assigned job has to fall inside.
 */

import { ACTIVE_WORK_ORDER_STATUSES } from './workOrderMetrics';
import { MAX_WORK_ORDER_LIST_LIMIT } from './workOrderList';

export const WAITING_FOR_WORK_STATUSES = ACTIVE_WORK_ORDER_STATUSES;

const WAITING = new Set<string>(WAITING_FOR_WORK_STATUSES);

export function parseStatusList(status: string | null | undefined): string[] {
  if (!status) return [];
  return status.split(',').map((part) => part.trim().toLowerCase()).filter(Boolean);
}

export function isWaitingForWorkStatus(status: string): boolean {
  return WAITING.has(status.trim().toLowerCase());
}

/** Every requested status is work still waiting. An empty filter is not this queue. */
export function isWaitingWorkList(statuses: string[]): boolean {
  return statuses.length > 0 && statuses.every(isWaitingForWorkStatus);
}

/**
 * Waiting queues default to oldest first. An explicit sortOrder is kept.
 * Lists that are not a waiting queue stay newest first.
 */
export function waitingListSort(input: {
  statuses: string[];
  sortBy: string;
  sortOrder: string | null;
}): { sortBy: string; sortOrder: 'asc' | 'desc' } {
  if (input.sortOrder === 'asc' || input.sortOrder === 'desc') {
    return { sortBy: input.sortBy, sortOrder: input.sortOrder };
  }
  if (isWaitingWorkList(input.statuses)) {
    return { sortBy: 'createdAt', sortOrder: 'asc' };
  }
  return { sortBy: input.sortBy, sortOrder: 'desc' };
}

/**
 * `assignedTo` limits the query to that tech before take/skip.
 * A tech only ever sees their own id, even if the query names someone else.
 */
export function assignedTechFilter(input: {
  role: string;
  actorId: string;
  assignedTo: string | null;
}): string | null {
  const requested = String(input.assignedTo || '').trim();
  if (!requested) return null;
  if (input.role === 'tech') return input.actorId;
  if (input.role === 'shop' || input.role === 'manager' || input.role === 'admin' || input.role === 'superadmin') {
    return requested;
  }
  return null;
}

export function orderWaitingJobs<T extends { createdAt?: unknown }>(jobs: T[]): T[] {
  return [...jobs].sort((a, b) => {
    const aTime = createdTime(a.createdAt);
    const bTime = createdTime(b.createdAt);
    if (aTime == null && bTime == null) return 0;
    if (aTime == null) return 1;
    if (bTime == null) return -1;
    return aTime - bTime;
  });
}

function createdTime(value: unknown): number | null {
  if (value == null || value === '') return null;
  const time = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(time) ? time : null;
}

const CLOSED_JOB_STATUSES = ['closed', 'completed', 'cancelled', 'canceled', 'paid'] as const;

/** Completed work stays newest first and is not mixed into the waiting queue. */
export function historyJobsQuery(options: { assignedTo?: string; limit?: number } = {}): string {
  const params = new URLSearchParams();
  params.set('limit', String(options.limit ?? MAX_WORK_ORDER_LIST_LIMIT));
  params.set('sortBy', 'createdAt');
  params.set('sortOrder', 'desc');
  params.set('status', CLOSED_JOB_STATUSES.join(','));
  if (options.assignedTo) params.set('assignedTo', options.assignedTo);
  return params.toString();
}

/** Query string for a waiting queue. Limit is the list maximum so older rows are not cut off at 20. */
export function waitingJobsQuery(options: {
  assignedTo?: string;
  statuses?: readonly string[];
  limit?: number;
}): string {
  const params = new URLSearchParams();
  params.set('limit', String(options.limit ?? MAX_WORK_ORDER_LIST_LIMIT));
  params.set('sortBy', 'createdAt');
  params.set('sortOrder', 'asc');
  if (options.assignedTo) params.set('assignedTo', options.assignedTo);
  if (options.statuses && options.statuses.length > 0) params.set('status', options.statuses.join(','));
  return params.toString();
}
