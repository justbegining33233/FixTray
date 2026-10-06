export function feePerPaidWorkOrder(serviceFeeCents: number | null | undefined): number {
  if (typeof serviceFeeCents !== 'number' || !Number.isFinite(serviceFeeCents)) return 0;
  return Math.round(Math.max(0, serviceFeeCents)) / 100;
}

export function platformFeeForPaidOrders(paidCount: number, serviceFeeCents: number | null | undefined): number {
  const count = Number.isFinite(paidCount) ? Math.max(0, Math.floor(paidCount)) : 0;
  return count * feePerPaidWorkOrder(serviceFeeCents);
}
