export interface CustomerTrackJob {
  workOrderId: string;
  status: string;
  paymentStanding: string;
  vehicle: string;
  services: string[];
  estimateUsd: number | null;
  invoiceUsd: number | null;
  feeUsd: number | null;
  notes: string[];
  timeline: Array<{ at: string; label: string }>;
  shopName: string;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function money(value: unknown): number | null {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100) / 100;
}

function serviceNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        const row = item as Record<string, unknown>;
        return text(row.name || row.service || row.description);
      }
      return '';
    })
    .filter(Boolean);
}

/** Customer-facing job standing. Internal tech notes stay off this view. */
export function customerJobTrack(workOrder: {
  id: string;
  status?: string | null;
  paymentStatus?: string | null;
  issueDescription?: string | null;
  estimatedCost?: number | null;
  serviceLocation?: string | null;
  createdAt?: Date | string | null;
  repairs?: unknown;
  maintenance?: unknown;
  estimate?: unknown;
  vehicle?: { year?: number | null; make?: string | null; model?: string | null; licensePlate?: string | null } | null;
  shop?: { shopName?: string | null } | null;
  statusHistory?: Array<{ createdAt: Date | string; fromStatus?: string | null; toStatus?: string | null }>;
}): CustomerTrackJob {
  const estimate = workOrder.estimate && typeof workOrder.estimate === 'object'
    ? workOrder.estimate as Record<string, unknown>
    : {};
  const invoiced = ['waiting-for-payment', 'completed', 'closed'].includes(String(workOrder.status || '').toLowerCase())
    || ['paid', 'pending'].includes(String(workOrder.paymentStatus || '').toLowerCase());
  const estimateUsd = money(estimate.total ?? workOrder.estimatedCost);
  const feeUsd = money(estimate.serviceFee);
  const notes = [text(workOrder.issueDescription), text(estimate.notes)].filter(Boolean);
  const vehicle = [
    workOrder.vehicle?.year,
    workOrder.vehicle?.make,
    workOrder.vehicle?.model,
    workOrder.vehicle?.licensePlate ? `(${workOrder.vehicle.licensePlate})` : '',
  ].filter(Boolean).join(' ');
  const created = workOrder.createdAt ? new Date(workOrder.createdAt).toISOString() : '';
  const timeline = [
    ...(created ? [{ at: created, label: 'Job opened' }] : []),
    ...(workOrder.statusHistory || []).map((row) => ({
      at: new Date(row.createdAt).toISOString(),
      label: row.toStatus ? String(row.toStatus).replace(/-/g, ' ') : 'Updated',
    })),
  ];
  if (timeline.length === 0 || timeline[timeline.length - 1]?.label !== String(workOrder.status || '')) {
    timeline.push({
      at: created || new Date(0).toISOString(),
      label: String(workOrder.status || 'pending').replace(/-/g, ' '),
    });
  }
  return {
    workOrderId: workOrder.id,
    status: String(workOrder.status || 'pending'),
    paymentStanding: String(workOrder.paymentStatus || 'unpaid'),
    vehicle: vehicle || text(workOrder.serviceLocation) || 'Vehicle',
    services: [...serviceNames(workOrder.maintenance), ...serviceNames(workOrder.repairs)],
    estimateUsd,
    invoiceUsd: invoiced ? estimateUsd : null,
    feeUsd: feeUsd && feeUsd > 0 ? feeUsd : null,
    notes,
    timeline,
    shopName: workOrder.shop?.shopName || 'Shop',
  };
}
