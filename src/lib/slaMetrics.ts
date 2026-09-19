/** Empty completed-with-due-date sets are N/A, not 100% success. */
export function slaComplianceRate(onTime: number, withDueDate: number): number | null {
  if (withDueDate <= 0) return null;
  return Math.round((onTime / withDueDate) * 100);
}

export function formatSlaCompliance(rate: number | null): string {
  return rate == null ? 'N/A' : `${rate.toFixed(rate % 1 === 0 ? 0 : 1)}%`;
}
