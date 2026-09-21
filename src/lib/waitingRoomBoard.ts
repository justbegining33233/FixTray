/**
 * Waiting-room board selection and display mapping.
 *
 * Shop Home and the calendar already surface pending in-shop appointments
 * (work orders with status `pending` and serviceLocation `in-shop`). The
 * lobby board used a narrower status list and a different status vocabulary,
 * so those appointments never appeared. No separate check-in flag is required.
 */

export const WAITING_ROOM_ACTIVE_STATUSES = [
  'assigned',
  'in-progress',
  'waiting-estimate',
  'waiting-for-payment',
] as const;

export type WaitingBoardStatus = 'pending' | 'in_progress' | 'completed' | 'on_hold';

export interface WaitingRoomWorkOrderLike {
  id: string;
  status?: string | null;
  serviceLocation?: string | null;
  vehicleType?: string | null;
  issueDescription?: unknown;
  bay?: number | null;
  dueDate?: string | Date | null;
  createdAt?: string | Date | null;
  location?: unknown;
  customer?: { firstName?: string | null } | null;
  assignedTo?: { firstName?: string | null; lastName?: string | null } | null;
  vehicle?: { year?: number | null; make?: string | null; model?: string | null } | null;
}

export interface WaitingRoomCard {
  id: string;
  ticketNumber: string;
  customerInitial: string;
  status: WaitingBoardStatus;
  rawStatus: string;
  vehicle: string;
  vehicleType: string;
  service: string;
  bay: number | null;
  tech?: string;
  message?: string;
  estimatedCompletion?: string;
  createdAt?: string | Date | null;
}

export function isInShopLocation(serviceLocation?: string | null): boolean {
  const raw = String(serviceLocation || '').trim().toLowerCase().replace(/_/g, '-');
  return raw === 'in-shop' || raw === 'inshop' || raw === 'shop';
}

export function isRoadsideLocation(serviceLocation?: string | null): boolean {
  const raw = String(serviceLocation || '').trim().toLowerCase().replace(/_/g, '-');
  return raw === 'road-call' || raw === 'roadside' || raw === 'roadcall';
}

/** Jobs that belong on the lobby board. Pending roadside work stays off it. */
export function isWaitingRoomCandidate(wo: {
  status?: string | null;
  serviceLocation?: string | null;
}): boolean {
  const status = String(wo.status || '').trim().toLowerCase();
  if ((WAITING_ROOM_ACTIVE_STATUSES as readonly string[]).includes(status)) return true;
  return status === 'pending' && isInShopLocation(wo.serviceLocation);
}

export function waitingRoomWorkOrderWhere(shopId: string) {
  return {
    shopId,
    OR: [
      { status: { in: [...WAITING_ROOM_ACTIVE_STATUSES] } },
      {
        status: 'pending',
        serviceLocation: {
          in: ['in-shop', 'inshop', 'shop', 'in_shop'],
          mode: 'insensitive' as const,
        },
      },
    ],
  };
}

export function toWaitingBoardStatus(status?: string | null): WaitingBoardStatus {
  const raw = String(status || '').trim().toLowerCase().replace(/-/g, '_');
  if (raw === 'completed' || raw === 'ready' || raw === 'closed') return 'completed';
  if (raw === 'assigned' || raw === 'in_progress') return 'in_progress';
  if (raw === 'on_hold') return 'on_hold';
  return 'pending';
}

export function issueSummary(issueDescription: unknown): string {
  if (typeof issueDescription === 'string') {
    return issueDescription.split('\n')[0].trim();
  }
  if (issueDescription && typeof issueDescription === 'object' && 'symptoms' in issueDescription) {
    const symptoms = (issueDescription as { symptoms?: unknown }).symptoms;
    if (typeof symptoms === 'string') return symptoms.split('\n')[0].trim();
  }
  return '';
}

function vehicleName(wo: WaitingRoomWorkOrderLike): string {
  const location = wo.location && typeof wo.location === 'object'
    ? wo.location as { vehicleInfo?: { year?: unknown; make?: unknown; model?: unknown } }
    : null;
  const info = location?.vehicleInfo;
  const fromInfo = [info?.year, info?.make, info?.model].filter(Boolean).join(' ').trim();
  const fromRecord = wo.vehicle
    ? [wo.vehicle.year, wo.vehicle.make, wo.vehicle.model].filter(Boolean).join(' ').trim()
    : '';
  return fromInfo || fromRecord || (wo.vehicleType ? String(wo.vehicleType) : 'Vehicle');
}

export function toWaitingRoomCard(wo: WaitingRoomWorkOrderLike): WaitingRoomCard {
  const service = issueSummary(wo.issueDescription) || 'Service';
  const name = vehicleName(wo);
  const tech = wo.assignedTo
    ? [wo.assignedTo.firstName, wo.assignedTo.lastName].filter(Boolean).join(' ').trim()
    : '';
  const initial = wo.customer?.firstName ? `${wo.customer.firstName.charAt(0)}.` : '';

  return {
    id: wo.id,
    ticketNumber: wo.id.slice(-6).toUpperCase(),
    customerInitial: initial,
    status: toWaitingBoardStatus(wo.status),
    rawStatus: String(wo.status || ''),
    vehicle: service ? `${name} · ${service}` : name,
    vehicleType: wo.vehicleType || '',
    service,
    bay: typeof wo.bay === 'number' ? wo.bay : null,
    tech: tech || undefined,
    message: initial ? `Customer ${initial}` : undefined,
    estimatedCompletion: wo.dueDate ? new Date(wo.dueDate).toISOString() : undefined,
    createdAt: wo.createdAt,
  };
}
