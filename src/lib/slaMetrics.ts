/**
 * SLA compliance is on-time completions divided by completions that have a due date.
 * Zero completed jobs (or none with a due date) is N/A, never 100%.
 */
export function slaComplianceRate(onTime: number, withDueDate: number): number | null {
  if (!Number.isFinite(withDueDate) || withDueDate <= 0) return null;
  if (!Number.isFinite(onTime) || onTime < 0) return null;
  return Math.round((onTime / withDueDate) * 100);
}

export function formatSlaCompliance(rate: number | null): string {
  return rate == null ? 'N/A' : `${rate.toFixed(rate % 1 === 0 ? 0 : 1)}%`;
}
