/**
 * Turn-by-turn for a technician on a road call or assigned job.
 * Steps come from the public OSRM driving router (same OpenStreetMap data
 * the Leaflet map already uses). Google Maps and Apple Maps links stay
 * browser deep links; their tiles are not cached. Nothing here changes
 * work-order status.
 */
import { externalMapLinks } from './offlineMapPack';
import { isRoadsideLocation } from './waitingRoomBoard';
import { readJobAddress, readStoredPoint } from './roadCallMap';
import type { GeoPoint } from './geocodeAddress';

export interface TurnStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  street: string;
  latitude: number;
  longitude: number;
}

export interface ParsedRoute {
  steps: TurnStep[];
  line: GeoPoint[];
  distanceMeters: number;
  durationSeconds: number;
}

export interface JobDirectionTarget {
  kind: 'job' | 'shop';
  label: string;
  address: string;
  point: GeoPoint | null;
}

const TECH_ROLES = new Set(['tech', 'manager']);

/** A tech or manager on a road call, or on a job that already has an assignee. */
export function jobNeedsDirections(input: {
  viewerRole?: string | null;
  serviceLocation?: string | null;
  assignedTechId?: string | null;
}): boolean {
  if (!TECH_ROLES.has(String(input.viewerRole || ''))) return false;
  if (isRoadsideLocation(input.serviceLocation)) return true;
  return Boolean(input.assignedTechId);
}

/** In-shop jobs route to the shop. Road calls route to the job site. */
export function resolveDirectionTarget(input: {
  serviceLocation?: string | null;
  location?: unknown;
  shopAddress?: string | null;
  geocodes?: Record<string, GeoPoint | null | undefined>;
}): JobDirectionTarget | null {
  const geocodes = input.geocodes || {};
  if (isRoadsideLocation(input.serviceLocation)) {
    const address = readJobAddress(input.location);
    const stored = readStoredPoint(input.location);
    const geocoded = !stored && address ? geocodes[address] ?? null : null;
    if (!stored && !address) return null;
    return {
      kind: 'job',
      label: 'Job site',
      address,
      point: stored || geocoded,
    };
  }
  const address = String(input.shopAddress || '').trim();
  if (!address) return null;
  return {
    kind: 'shop',
    label: 'Shop',
    address,
    point: geocodes[address] ?? null,
  };
}

export function osrmRouteUrl(origin: GeoPoint, destination: GeoPoint): string {
  const path = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  return `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson&steps=true`;
}

export function browserDirectionLinks(destination: GeoPoint, origin?: GeoPoint | null): { google: string; apple: string } {
  const links = externalMapLinks(destination.latitude, destination.longitude);
  if (!origin) return links;
  const from = `${origin.latitude},${origin.longitude}`;
  return {
    google: `${links.google}&origin=${encodeURIComponent(from)}`,
    apple: `${links.apple}&saddr=${encodeURIComponent(from)}`,
  };
}

function modifierPhrase(modifier?: string): string {
  switch (modifier) {
    case 'uturn': return 'make a U-turn';
    case 'sharp right': return 'turn sharp right';
    case 'right': return 'turn right';
    case 'slight right': return 'bear right';
    case 'straight': return 'continue straight';
    case 'slight left': return 'bear left';
    case 'left': return 'turn left';
    case 'sharp left': return 'turn sharp left';
    default: return '';
  }
}

function departDirection(modifier?: string): string {
  switch (modifier) {
    case 'right':
    case 'slight right':
    case 'sharp right':
      return 'right';
    case 'left':
    case 'slight left':
    case 'sharp left':
      return 'left';
    case 'uturn':
      return 'back';
    default:
      return '';
  }
}

export function stepInstruction(maneuver: { type?: string; modifier?: string }, street: string): string {
  const type = String(maneuver.type || '');
  const how = modifierPhrase(maneuver.modifier);
  const road = street.trim();
  if (type === 'arrive') return 'Arrive at the job';
  if (type === 'depart') {
    const dir = departDirection(maneuver.modifier);
    if (dir && road) return `Head ${dir} on ${road}`;
    if (road) return `Head out on ${road}`;
    return 'Head toward the job';
  }
  if (type === 'turn' || type === 'end of road' || type === 'roundabout turn') {
    if (how && road) return `${how.charAt(0).toUpperCase()}${how.slice(1)} onto ${road}`;
    if (how) return `${how.charAt(0).toUpperCase()}${how.slice(1)}`;
    return road ? `Continue onto ${road}` : 'Continue';
  }
  if (type === 'roundabout' || type === 'rotary') return road ? `Enter the roundabout and take ${road}` : 'Enter the roundabout';
  if (type === 'exit roundabout' || type === 'exit rotary') return road ? `Exit the roundabout onto ${road}` : 'Exit the roundabout';
  if (type === 'merge') return road ? `Merge onto ${road}` : 'Merge';
  if (type === 'on ramp') return road ? `Take the ramp onto ${road}` : 'Take the ramp';
  if (type === 'off ramp') return road ? `Take the exit onto ${road}` : 'Take the exit';
  if (type === 'fork') return how && road ? `${how.charAt(0).toUpperCase()}${how.slice(1)} onto ${road}` : road ? `Keep to ${road}` : 'Keep to the fork';
  if (type === 'new name' || type === 'continue') return road ? `Continue onto ${road}` : 'Continue';
  if (road) return how ? `${how.charAt(0).toUpperCase()}${how.slice(1)} onto ${road}` : `Continue on ${road}`;
  return 'Continue';
}

function asCoord(value: unknown): GeoPoint | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const longitude = Number(value[0]);
  const latitude = Number(value[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

export function parseOsrmRoute(payload: unknown): ParsedRoute | null {
  if (!payload || typeof payload !== 'object') return null;
  const code = (payload as { code?: unknown }).code;
  if (code !== 'Ok') return null;
  const routes = (payload as { routes?: unknown }).routes;
  if (!Array.isArray(routes) || !routes[0] || typeof routes[0] !== 'object') return null;
  const route = routes[0] as {
    distance?: unknown;
    duration?: unknown;
    geometry?: { coordinates?: unknown };
    legs?: unknown;
  };
  const legs = Array.isArray(route.legs) ? route.legs : [];
  const steps: TurnStep[] = [];
  for (const leg of legs) {
    if (!leg || typeof leg !== 'object') continue;
    const rawSteps = (leg as { steps?: unknown }).steps;
    if (!Array.isArray(rawSteps)) continue;
    for (const step of rawSteps) {
      if (!step || typeof step !== 'object') continue;
      const rec = step as {
        distance?: unknown;
        duration?: unknown;
        name?: unknown;
        maneuver?: { type?: string; modifier?: string; location?: unknown };
      };
      const at = asCoord(rec.maneuver?.location);
      if (!at) continue;
      const street = typeof rec.name === 'string' ? rec.name : '';
      steps.push({
        instruction: stepInstruction(rec.maneuver || {}, street),
        distanceMeters: Number(rec.distance) || 0,
        durationSeconds: Number(rec.duration) || 0,
        street,
        latitude: at.latitude,
        longitude: at.longitude,
      });
    }
  }
  if (steps.length === 0) return null;
  const coords = route.geometry && typeof route.geometry === 'object'
    ? (route.geometry as { coordinates?: unknown }).coordinates
    : null;
  const line: GeoPoint[] = [];
  if (Array.isArray(coords)) {
    for (const pair of coords) {
      const point = asCoord(pair);
      if (point) line.push(point);
    }
  }
  return {
    steps,
    line,
    distanceMeters: Number(route.distance) || steps.reduce((sum, step) => sum + step.distanceMeters, 0),
    durationSeconds: Number(route.duration) || steps.reduce((sum, step) => sum + step.durationSeconds, 0),
  };
}

export function formatTripDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '';
  const feet = meters * 3.28084;
  if (feet < 500) return `${Math.max(10, Math.round(feet / 10) * 10)} ft`;
  const miles = meters / 1609.344;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export function formatTripDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Step the driver is nearest to. Looking at a step does not change the job. */
export function activeStepIndex(steps: Array<Pick<TurnStep, 'latitude' | 'longitude'>>, here: GeoPoint): number {
  if (steps.length === 0) return 0;
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < steps.length; i += 1) {
    const distance = haversineMeters(here, steps[i]);
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  }
  return best;
}

export function nearestLineDistance(line: GeoPoint[], here: GeoPoint): number | null {
  if (line.length === 0) return null;
  let best = Infinity;
  for (const point of line) {
    const distance = haversineMeters(here, point);
    if (distance < best) best = distance;
  }
  return best;
}

export function readOriginParam(lat: string | null, lng: string | null): GeoPoint | null {
  if (lat == null || lng == null || lat === '' || lng === '') return null;
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}
