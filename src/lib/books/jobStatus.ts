/**
 * Which jobs are invoices. Estimates are never accounts receivable.
 * In progress is not an invoice until the job is waiting for payment.
 */

const INVOICED = new Set([
  'waiting-for-payment',
  'awaiting-payment',
  'completed',
  'closed',
  'paid',
]);

export function isInvoicedJobStatus(status: string | null | undefined): boolean {
  return INVOICED.has(String(status || '').trim().toLowerCase());
}

export function isEstimateStatus(status: string | null | undefined): boolean {
  const value = String(status || '').trim().toLowerCase();
  return value === 'pending'
    || value === 'estimate'
    || value === 'estimate-submitted'
    || value === 'estimate-pending'
    || value === 'waiting-estimate'
    || value === 'draft'
    || value === 'denied-estimate';
}
