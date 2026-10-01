/**
 * Customers who own a work order may update job details.
 * They must not mark it paid, closed, or completed. Paid comes from Stripe.
 */
export function customerWorkOrderUpdateForbidden(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const status = typeof record.status === 'string' ? record.status.toLowerCase() : '';
  if (status === 'closed' || status === 'completed') {
    return 'Customers cannot close or complete a work order.';
  }
  const paymentStatus = typeof record.paymentStatus === 'string' ? record.paymentStatus.toLowerCase() : '';
  if (paymentStatus === 'paid') {
    return 'Customers cannot mark a work order paid.';
  }
  return null;
}
