/**
 * Prep-download, GPS, role, and safety rules for offline sync.
 * Append-only merges stay in techOfflineSync. These checks decide
 * whether a queued action is allowed to run at all.
 */

export const ROLE_CACHE_CAPS = {
  tech: { jobs: 50, catalog: 200, messages: 40 },
  manager: { jobs: 40, catalog: 200, messages: 40 },
  shop: { jobs: 40, catalog: 100, messages: 40 },
  customer: { jobs: 20, catalog: 0, messages: 30 },
  superadmin: { jobs: 10, catalog: 0, messages: 10, shops: 30 },
} as const;

/** Sample GPS about once a minute, and skip points that barely moved. */
export const GPS_SAMPLE_MS = 60_000;
export const GPS_MIN_MOVE_METERS = 30;

const FIELD_ROLES = new Set(['tech', 'manager', 'shop']);
const NOTE_ROLES = new Set(['tech', 'manager', 'shop', 'customer', 'superadmin']);
const CLOCK_ROLES = new Set(['tech', 'manager']);

export const LIVE_SERVER_KINDS = new Set([
  'payment',
  'estimate',
  'estimate-send',
  'estimate-sign',
  'shop-approve',
  'user-admin',
  'pay-change',
  'upload',
]);

const KIND_ROLES: Record<string, Set<string>> = {
  status: FIELD_ROLES,
  labor: FIELD_ROLES,
  part: FIELD_ROLES,
  note: NOTE_ROLES,
  message: NOTE_ROLES,
  photo: new Set(['tech', 'manager', 'shop', 'customer']),
  'clock-in': CLOCK_ROLES,
  'clock-out': CLOCK_ROLES,
  gps: CLOCK_ROLES,
};

export const SEALED_STATUSES = new Set(['closed', 'cancelled', 'canceled', 'paid']);

export function roleMayApply(role: string, kind: string): { ok: true } | { ok: false; message: string } {
  if (LIVE_SERVER_KINDS.has(kind)) {
    return { ok: false, message: 'That action needs a connection. It was not applied.' };
  }
  const roles = KIND_ROLES[kind];
  if (!roles) return { ok: false, message: 'Unknown offline action.' };
  if (!roles.has(role)) {
    return { ok: false, message: 'Your role cannot do that. The server did not apply it.' };
  }
  return { ok: true };
}

export function isSealedWorkOrder(status: unknown, paymentStatus?: unknown): boolean {
  const current = String(status || '').trim().toLowerCase();
  const payment = String(paymentStatus || '').trim().toLowerCase();
  return SEALED_STATUSES.has(current) || payment === 'paid';
}

export function sealedEditMessage(status: unknown): string {
  return `This work order is ${String(status || 'closed')}. Late edits are not applied. Your entry stays on this device for review.`;
}

export type PrepJob = {
  id?: string;
  customer?: { firstName?: string | null; lastName?: string | null; phone?: string | null } | null;
  jobAddress?: string | null;
  vehicle?: { year?: number | null; make?: string | null; model?: string | null } | null;
  vehicleType?: string | null;
  linesFetched?: boolean;
  photosFetched?: boolean;
  notesFetched?: boolean;
  laborRate?: number | null;
  laborRates?: unknown[] | null;
  catalog?: unknown[] | null;
  latitude?: number | null;
  longitude?: number | null;
  mapPack?: { roads?: unknown[] | null } | null;
};

export function assessTechPrep(job: PrepJob): { ready: boolean; missing: string[]; warning: string | null } {
  const missing: string[] = [];
  if (!job.id) missing.push('work order');
  const name = `${job.customer?.firstName || ''} ${job.customer?.lastName || ''}`.trim();
  if (!name) missing.push('customer name');
  if (!String(job.customer?.phone || '').trim()) missing.push('customer phone');
  if (!String(job.jobAddress || '').trim()) missing.push('customer address');
  const vehicle = [job.vehicle?.year, job.vehicle?.make, job.vehicle?.model].filter((part) => part !== null && part !== undefined && String(part) !== '').join(' ')
    || String(job.vehicleType || '').trim();
  if (!vehicle) missing.push('vehicle');
  if (job.linesFetched === false) missing.push('existing lines');
  if (job.photosFetched === false) missing.push('existing photos');
  if (job.notesFetched === false) missing.push('existing notes');
  const hasRate = typeof job.laborRate === 'number' || (Array.isArray(job.laborRates) && job.laborRates.length > 0);
  if (!hasRate) missing.push('labor rate');
  if (!Array.isArray(job.catalog)) missing.push('parts catalog');
  const hasPoint = Number.isFinite(job.latitude) && Number.isFinite(job.longitude);
  if (!hasPoint && !String(job.jobAddress || '').trim()) missing.push('job location');
  const warning = hasPoint && !Array.isArray(job.mapPack?.roads)
    ? 'Street map did not finish downloading. The job pin and your location still work.'
    : null;
  return { ready: missing.length === 0, missing, warning };
}

export type GpsPoint = {
  latitude: number;
  longitude: number;
  deviceAt?: string | number | Date | null;
  clientId?: string;
  createdAt?: number;
};

export function gpsTime(point: GpsPoint): number {
  const raw = point.deviceAt ?? point.createdAt;
  const time = raw instanceof Date ? raw.getTime() : new Date(raw || 0).getTime();
  if (Number.isFinite(time) && time > 0) return time;
  return point.createdAt || 0;
}

export function sortGpsPoints<T extends GpsPoint>(points: T[]): T[] {
  return [...points].sort((a, b) => gpsTime(a) - gpsTime(b) || String(a.clientId || '').localeCompare(String(b.clientId || '')));
}

export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const radius = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function shouldRecordGps(
  last: { latitude: number; longitude: number; at: number } | null,
  next: { latitude: number; longitude: number },
  now: number,
): boolean {
  if (!Number.isFinite(next.latitude) || !Number.isFinite(next.longitude)) return false;
  if (!last) return true;
  if (now - last.at < GPS_SAMPLE_MS) return false;
  return distanceMeters(last, next) >= GPS_MIN_MOVE_METERS;
}

const CLOCK_SKEW_MS = 12 * 60 * 60 * 1000;

export function stampTimes(deviceAt: unknown, receivedAt = new Date()): {
  deviceAt: string;
  receivedAt: string;
  effectiveAt: string;
  clockAdjusted: boolean;
} {
  const parsed = deviceAt instanceof Date ? deviceAt : new Date(typeof deviceAt === 'string' || typeof deviceAt === 'number' ? deviceAt : '');
  const valid = !Number.isNaN(parsed.getTime());
  const skew = valid ? Math.abs(parsed.getTime() - receivedAt.getTime()) : Number.POSITIVE_INFINITY;
  const clockAdjusted = !valid || skew > CLOCK_SKEW_MS;
  const effective = clockAdjusted ? receivedAt : parsed;
  return {
    deviceAt: valid ? parsed.toISOString() : receivedAt.toISOString(),
    receivedAt: receivedAt.toISOString(),
    effectiveAt: effective.toISOString(),
    clockAdjusted,
  };
}

export function logoutGuard(pending: number): { clearCache: boolean; warn: boolean; pending: number; message: string } {
  const count = Math.max(0, Math.floor(pending) || 0);
  if (count > 0) {
    const noun = count === 1 ? 'item has' : 'items have';
    return {
      clearCache: false,
      warn: true,
      pending: count,
      message: `You have ${count} ${noun} not uploaded. They stay on this phone until you sign back in and sync. Signing out will not delete them.`,
    };
  }
  return { clearCache: true, warn: false, pending: 0, message: '' };
}

export function sameTap(previous: { signature: string; at: number } | null, signature: string, now: number, windowMs = 800): boolean {
  if (!previous) return false;
  return previous.signature === signature && now - previous.at >= 0 && now - previous.at < windowMs;
}
