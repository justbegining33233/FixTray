/** Money text for estimate rows. Missing or non-numeric totals render as $0.00. */
export function formatEstimateMoney(value: unknown): string {
  const amount = typeof value === 'number' ? value : Number(value);
  const safe = Number.isFinite(amount) ? amount : 0;
  return `$${safe.toFixed(2)}`;
}
