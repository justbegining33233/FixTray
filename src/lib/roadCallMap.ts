import { TRACKABLE_WORK_ORDER_STATUSES } from './customerTracking';
import type { GeoPoint } from './geocodeAddress';
import { isRoadsideLocation } from './waitingRoomBoard';
import { workOrderTitle } from './workOrderMetrics';

export type ShopPinStatus = 'pinned' | 'missing-address' | 'ungeocoded';
export type TechLocationStatus = 'live' | 'last-known' | 'unavailable';
export type JobPinStatus = 'pinned' | 'ungeocoded' | 'missing';

export interface ShopOpsShop {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: ShopPinStatus;
}

export interface ShopOpsJobRef {
  id: string;
  label: string;
}

export interface ShopOpsTech {
  id: string;
  name: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  locationStatus: TechLocationStatus;
  lastUpdate: string | null;
  jobs: ShopOpsJobRef[];
}

export interface ShopOpsJob {
  id: string;
  label: string;
  customerName: string;
  address: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  locationStatus: JobPinStatus;
  assignedTechId: string | null;
  assignedTechName: string | null;
}

export interface ShopOpsMap {
  shop: ShopOpsShop;
  techs: ShopOpsTech[];
  jobs: ShopOpsJob[];
}

const LIVE_MS = 2 * 60 * 1000;

export function formatAddressParts(parts: {
  street?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  zipCode?: string | null;
}): string {
  const street = String(parts.street || parts.address || '').trim();
  const city = String(parts.city || '').trim();
  const state = String(parts.state || '').trim();
  const zip = String(parts.zip || parts.zipCode || '').trim();
  const stateZip = [state, zip].filter(Boolean).join(' ');
  return [street, city, stateZip].filter(Boolean).join(', ');
}

export function shopAddressFromRecord(shop: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  shopLocations?: Array<{
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    isMain?: boolean | null;
    status?: string | null;
  }> | null;
}): string {
  const profile = formatAddressParts({
    address: shop.address,
    city: shop.city,
    state: shop.state,
    zipCode: shop.zipCode,
  });
  if (profile) return profile;

  const locations = (shop.shopLocations || []).filter((location) => {
    const status = String(location.status || 'active').toLowerCase();
    return status !== 'inactive';
  });
  const main = locations.find((location) => location.isMain) || locations[0];
  if (!main) return '';
  return formatAddressParts(main);
}

export function readStoredPoint(value: unknown): GeoPoint | null {
  if (!value || typeof value !== 'object') return null;
  const rec = value as Record<string, unknown>;
  const latitude = Number(rec.latitude ?? rec.lat);
  const longitude = Number(rec.longitude ?? rec.lng ?? rec.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

export function readJobAddress(location: unknown): string {
  if (!location) return '';
  if (typeof location === 'string') {
    const trimmed = location.trim();
    if (!trimmed) return '';
    try {
      return readJobAddress(JSON.parse(trimmed));
    } catch {
      return trimmed;
    }
  }
  if (typeof location !== 'object') return '';
  const rec = location as Record<string, unknown>;
  const street = typeof rec.address === 'string'
    ? rec.address
    : typeof rec.pickupAddress === 'string'
      ? rec.pickupAddress
      : '';
  return formatAddressParts({
    address: street,
    city: typeof rec.city === 'string' ? rec.city : '',
    state: typeof rec.state === 'string' ? rec.state : '',
    zipCode: typeof rec.zipCode === 'string' ? rec.zipCode : typeof rec.zip === 'string' ? rec.zip : '',
  });
}

export function isTrackableRoadCall(job: { serviceLocation?: string | null; status?: string | null }): boolean {
  if (!isRoadsideLocation(job.serviceLocation)) return false;
  const status = String(job.status || '').trim().toLowerCase();
  return (TRACKABLE_WORK_ORDER_STATUSES as readonly string[]).includes(status);
}

export interface RoadCallTechInput {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  lastLocationUpdate?: Date | string | null;
}

export interface RoadCallJobInput {
  id: string;
  status?: string | null;
  serviceLocation?: string | null;
  issueDescription?: unknown;
  location?: unknown;
  assignedTechId?: string | null;
  customer?: { firstName?: string | null; lastName?: string | null } | null;
  assignedTo?: RoadCallTechInput | null;
  tracking?: { latitude: number; longitude: number; updatedAt?: Date | string | null } | null;
  clockedInTechs?: RoadCallTechInput[] | null;
}

function personName(tech: { firstName?: string | null; lastName?: string | null } | null | undefined, fallback: string): string {
  const name = `${tech?.firstName || ''} ${tech?.lastName || ''}`.trim();
  return name || fallback;
}

function timestamp(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function freshness(at: number | null, now: number): 'live' | 'last-known' {
  if (at == null) return 'last-known';
  return now - at <= LIVE_MS ? 'live' : 'last-known';
}

function jobLabel(job: RoadCallJobInput): string {
  const shortId = job.id.slice(0, 8).toUpperCase();
  const title = workOrderTitle(job);
  return title && title !== 'Service' ? `WO-${shortId} · ${title}` : `WO-${shortId}`;
}

export function addressesToGeocode(shopAddress: string, jobs: RoadCallJobInput[]): string[] {
  const queries: string[] = [];
  if (shopAddress.trim()) queries.push(shopAddress.trim());
  for (const job of jobs) {
    if (!isTrackableRoadCall(job)) continue;
    if (readStoredPoint(job.location)) continue;
    const address = readJobAddress(job.location);
    if (address) queries.push(address);
  }
  return queries;
}

export function buildRoadCallMap(input: {
  shop: { id: string; name: string; address: string };
  jobs: RoadCallJobInput[];
  geocodes?: Record<string, GeoPoint | null | undefined>;
  now?: number;
}): ShopOpsMap {
  const now = input.now ?? Date.now();
  const geocodes = input.geocodes || {};
  const shopAddress = input.shop.address.trim();
  const shopPoint = shopAddress ? geocodes[shopAddress] ?? null : null;
  const shop: ShopOpsShop = {
    id: input.shop.id,
    name: input.shop.name || 'Shop',
    address: shopAddress,
    latitude: shopPoint?.latitude ?? null,
    longitude: shopPoint?.longitude ?? null,
    status: !shopAddress ? 'missing-address' : shopPoint ? 'pinned' : 'ungeocoded',
  };

  const jobs: ShopOpsJob[] = [];
  const techAcc = new Map<string, {
    tech: RoadCallTechInput;
    jobs: ShopOpsJobRef[];
    point: GeoPoint | null;
    at: number | null;
  }>();

  for (const job of input.jobs) {
    if (!isTrackableRoadCall(job)) continue;
    const label = jobLabel(job);
    const address = readJobAddress(job.location);
    const stored = readStoredPoint(job.location);
    const geocoded = !stored && address ? geocodes[address] ?? null : null;
    const point = stored || geocoded;
    const assigned = job.assignedTo || null;
    jobs.push({
      id: job.id,
      label,
      customerName: personName(job.customer, 'Customer'),
      address,
      status: String(job.status || ''),
      latitude: point?.latitude ?? null,
      longitude: point?.longitude ?? null,
      locationStatus: point ? 'pinned' : address ? 'ungeocoded' : 'missing',
      assignedTechId: job.assignedTechId || assigned?.id || null,
      assignedTechName: assigned ? personName(assigned, 'Technician') : null,
    });

    const people = new Map<string, { tech: RoadCallTechInput; fromAssignment: boolean }>();
    if (assigned?.id) people.set(assigned.id, { tech: assigned, fromAssignment: true });
    for (const tech of job.clockedInTechs || []) {
      if (!tech?.id || people.has(tech.id)) continue;
      people.set(tech.id, { tech, fromAssignment: false });
    }

    for (const [id, entry] of people) {
      let acc = techAcc.get(id);
      if (!acc) {
        acc = { tech: entry.tech, jobs: [], point: null, at: null };
        techAcc.set(id, acc);
      }
      acc.jobs.push({ id: job.id, label });

      const candidates: Array<{ point: GeoPoint; at: number | null }> = [];
      if (entry.fromAssignment && job.tracking) {
        const tracked = readStoredPoint(job.tracking);
        if (tracked) candidates.push({ point: tracked, at: timestamp(job.tracking.updatedAt) });
      }
      const own = readStoredPoint(entry.tech);
      if (own) candidates.push({ point: own, at: timestamp(entry.tech.lastLocationUpdate) });

      for (const candidate of candidates) {
        const candidateAt = candidate.at ?? -1;
        const currentAt = acc.at ?? -1;
        if (!acc.point || candidateAt >= currentAt) {
          acc.point = candidate.point;
          acc.at = candidate.at;
        }
      }
    }
  }

  const techs: ShopOpsTech[] = [...techAcc.values()]
    .map((acc) => {
      const locationStatus: TechLocationStatus = acc.point ? freshness(acc.at, now) : 'unavailable';
      return {
        id: acc.tech.id,
        name: personName(acc.tech, 'Technician'),
        phone: acc.tech.phone || '',
        latitude: acc.point?.latitude ?? null,
        longitude: acc.point?.longitude ?? null,
        locationStatus,
        lastUpdate: acc.at != null ? new Date(acc.at).toISOString() : null,
        jobs: acc.jobs,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { shop, techs, jobs };
}
