import { describe, expect, it } from '@jest/globals';
import { filterTechJobs } from '../src/lib/techJobs';
import {
  assignedTechFilter,
  orderWaitingJobs,
  waitingJobsQuery,
  waitingListSort,
} from '../src/lib/waitingJobQueue';

function job(id: string, createdAt: string, assignedTechId: string | null, status = 'assigned') {
  return { id, createdAt, assignedTechId, assignedTo: assignedTechId ? { id: assignedTechId } : null, status };
}

describe('waiting jobs are first come, first served', () => {
  it('puts the oldest waiting job first', () => {
    const ordered = orderWaitingJobs([
      job('new', '2026-03-03T00:00:00.000Z', 'tech-1'),
      job('old', '2026-01-01T00:00:00.000Z', 'tech-1'),
      job('mid', '2026-02-02T00:00:00.000Z', 'tech-1'),
    ]);
    expect(ordered.map((row) => row.id)).toEqual(['old', 'mid', 'new']);
  });

  it('defaults a waiting-status list to oldest first and leaves other lists newest first', () => {
    expect(waitingListSort({
      statuses: ['assigned', 'in-progress'],
      sortBy: 'createdAt',
      sortOrder: null,
    })).toEqual({ sortBy: 'createdAt', sortOrder: 'asc' });
    expect(waitingListSort({
      statuses: [],
      sortBy: 'createdAt',
      sortOrder: null,
    })).toEqual({ sortBy: 'createdAt', sortOrder: 'desc' });
    expect(waitingListSort({
      statuses: ['assigned'],
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }).sortOrder).toBe('desc');
  });

  it('keeps an older assigned job when the newest 20 shop orders would hide it', () => {
    const newest = Array.from({ length: 20 }, (_, index) => job(
      `new-${index}`,
      `2026-09-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
      null,
      'pending',
    ));
    const olderAssigned = job('wo-old', '2026-01-15T00:00:00.000Z', 'tech-1', 'assigned');
    const shopNewestFirst = [olderAssigned, ...newest]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 20);
    expect(filterTechJobs(shopNewestFirst, 'tech-1', 'active')).toEqual([]);

    const assignedFirst = [olderAssigned, ...newest].filter((row) => row.assignedTechId === 'tech-1');
    const visible = orderWaitingJobs(assignedFirst).slice(0, 20);
    expect(visible.map((row) => row.id)).toEqual(['wo-old']);
    expect(filterTechJobs(visible, 'tech-1', 'active').map((row) => row.id)).toEqual(['wo-old']);
  });

  it('lists a tech\'s active jobs oldest first even when the payload is newest first', () => {
    const rows = [
      job('new', '2026-03-03T00:00:00.000Z', 'tech-1'),
      job('old', '2026-01-01T00:00:00.000Z', 'tech-1'),
    ];
    expect(filterTechJobs(rows, 'tech-1', 'active').map((row) => row.id)).toEqual(['old', 'new']);
  });

  it('requests the waiting queue at the list maximum, oldest first, for that tech', () => {
    const params = new URLSearchParams(waitingJobsQuery({
      assignedTo: 'tech-1',
      statuses: ['assigned', 'in-progress'],
    }));
    expect(params.get('limit')).toBe('200');
    expect(params.get('sortBy')).toBe('createdAt');
    expect(params.get('sortOrder')).toBe('asc');
    expect(params.get('assignedTo')).toBe('tech-1');
    expect(params.get('status')).toBe('assigned,in-progress');
  });

  it('reads assignedTo as that tech, and a tech cannot list someone else', () => {
    expect(assignedTechFilter({ role: 'tech', actorId: 'tech-1', assignedTo: 'tech-1' })).toBe('tech-1');
    expect(assignedTechFilter({ role: 'tech', actorId: 'tech-1', assignedTo: 'tech-2' })).toBe('tech-1');
    expect(assignedTechFilter({ role: 'shop', actorId: 'shop-1', assignedTo: 'tech-1' })).toBe('tech-1');
    expect(assignedTechFilter({ role: 'tech', actorId: 'tech-1', assignedTo: null })).toBeNull();
  });
});
