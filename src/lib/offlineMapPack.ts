/**
 * Online maps on the site are Leaflet tiles from tile.openstreetmap.org.
 * The OSMF tile usage policy forbids downloading an area of those tiles
 * for offline use, and the Google Maps JavaScript API forbids offline tile
 * caches. The offline job map stores OpenStreetMap data (ODbL) from one
 * small Overpass query and draws it locally. Turn-by-turn opens Google Maps
 * or Apple Maps, which ship their own offline maps.
 */

export const OFFLINE_MAP_PROVIDER = {
  online: 'Leaflet + OpenStreetMap raster tiles (tile.openstreetmap.org), online only',
  offline: 'OpenStreetMap data via Overpass, drawn on this device (ODbL)',
  turnByTurn: 'Google Maps and Apple Maps deep links. Their tiles are not cached.',
  attribution: '© OpenStreetMap contributors',
} as const;

export type MapRoad = { lat: number; lng: number }[];

export function externalMapLinks(latitude: number, longitude: number): { google: string; apple: string } {
  const pair = `${latitude},${longitude}`;
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pair)}`,
    apple: `https://maps.apple.com/?daddr=${encodeURIComponent(pair)}`,
  };
}

export function overpassQuery(latitude: number, longitude: number, radiusMeters = 1500): string {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const radius = Math.max(200, Math.min(3000, Math.round(radiusMeters)));
  return `[out:json][timeout:12];way["highway"](around:${radius},${lat},${lng});out geom;`;
}

export function roadsFromOverpass(payload: unknown, limit = 250): MapRoad[] {
  const elements = payload && typeof payload === 'object' ? (payload as { elements?: unknown }).elements : null;
  if (!Array.isArray(elements)) return [];
  const roads: MapRoad[] = [];
  for (const element of elements) {
    if (roads.length >= limit) break;
    if (!element || typeof element !== 'object') continue;
    const geometry = (element as { geometry?: unknown }).geometry;
    if (!Array.isArray(geometry)) continue;
    const line: MapRoad = [];
    const step = Math.max(1, Math.ceil(geometry.length / 40));
    for (let i = 0; i < geometry.length; i += step) {
      const point = geometry[i] as { lat?: unknown; lon?: unknown };
      const lat = Number(point?.lat);
      const lng = Number(point?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      line.push({ lat, lng });
    }
    const last = geometry[geometry.length - 1] as { lat?: unknown; lon?: unknown } | undefined;
    if (last && line.length) {
      const lat = Number(last.lat);
      const lng = Number(last.lon);
      const tail = line[line.length - 1];
      if (Number.isFinite(lat) && Number.isFinite(lng) && (tail.lat !== lat || tail.lng !== lng)) {
        line.push({ lat, lng });
      }
    }
    if (line.length >= 2) roads.push(line);
  }
  return roads;
}

export function readLatLng(location: unknown): { latitude: number; longitude: number } | null {
  if (!location || typeof location !== 'object') return null;
  const rec = location as Record<string, unknown>;
  const latitude = Number(rec.latitude ?? rec.lat);
  const longitude = Number(rec.longitude ?? rec.lng ?? rec.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}
