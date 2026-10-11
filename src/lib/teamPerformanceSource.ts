/**
 * Shop team performance and employee analytics read the same roster.
 * The source is /api/analytics/employee-performance (`techPerformance`).
 * The older /api/shop/team-performance payload (`performance`) is a live
 * clock snapshot and is not this roster.
 */

export type TeamPerformanceRow = {
  id: string;
  name: string;
  jobsCompleted: number;
  hoursWorked: number;
  avgTimePerJob: number;
  efficiency: number;
  earnings: number;
};

export function performanceRangeDays(range: 'week' | 'month' | 'quarter'): number {
  if (range === 'week') return 7;
  if (range === 'quarter') return 90;
  return 30;
}

export function teamRowsFromEmployeePerformance(payload: unknown): TeamPerformanceRow[] {
  if (!payload || typeof payload !== 'object') return [];
  const rows = (payload as { techPerformance?: unknown }).techPerformance;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const tech = row as Record<string, unknown>;
    const id = String(tech.techId || tech.id || '');
    const name = String(tech.name || '').trim();
    if (!id && !name) return [];
    const completed = Number(tech.completedJobs) || 0;
    const hours = Number(tech.hoursWorked) || 0;
    return [{
      id: id || name,
      name: name || 'Technician',
      jobsCompleted: completed,
      hoursWorked: hours,
      avgTimePerJob: completed > 0 ? Math.round((hours / completed) * 10) / 10 : 0,
      efficiency: Number(tech.completionRate) || 0,
      earnings: typeof tech.revenue === 'number' && Number.isFinite(tech.revenue) ? tech.revenue : 0,
    }];
  });
}
