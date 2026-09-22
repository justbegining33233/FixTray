export const DEFAULT_SERVICE_FEE_CENTS = 500;

export function feePerPaidWorkOrder(serviceFeeCents: number | null | undefined): number {
  const cents = typeof serviceFeeCents === 'number' && Number.isFinite(serviceFeeCents)
    ? serviceFeeCents
    : DEFAULT_SERVICE_FEE_CENTS;
  return Math.max(0, cents) / 100;
}

export function platformFeeForPaidOrders(paidCount: number, serviceFeeCents: number | null | undefined): number {
  const count = Number.isFinite(paidCount) ? Math.max(0, Math.floor(paidCount)) : 0;
  return count * feePerPaidWorkOrder(serviceFeeCents);
}
