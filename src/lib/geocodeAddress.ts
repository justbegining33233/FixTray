export interface GeoPoint {
  latitude: number;
  longitude: number;
}

type CacheEntry = { at: number; point: GeoPoint | null };

const memory = new Map<string, CacheEntry>();
const OK_TTL_MS = 12 * 60 * 60 * 1000;
const MISS_TTL_MS = 10 * 60 * 1000;

/** Test hook. Production calls share one process cache so map polls do not re-geocode. */
export function clearGeocodeCache() {
  memory.clear();
}

function asPoint(lat: unknown, lon: unknown): GeoPoint | null {
  const latitude = typeof lat === 'number' ? lat : Number(lat);
  const longitude = typeof lon === 'number' ? lon : Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

/**
 * Forward-geocode a street address with OpenStreetMap Nominatim.
 * No API key. Failures return null — callers must not substitute a default city.
 */
export async function geocodeAddress(
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GeoPoint | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;

  const hit = memory.get(key);
  if (hit) {
    const ttl = hit.point ? OK_TTL_MS : MISS_TTL_MS;
    if (Date.now() - hit.at < ttl) return hit.point;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query.trim())}`;
    const res = await fetchImpl(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'FixTray/1.0 (shop road-call map; https://fixtray.app)',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const row = Array.isArray(data) ? data[0] : null;
    const point = row ? asPoint(row.lat, row.lon) : null;
    memory.set(key, { at: Date.now(), point });
    return point;
  } catch {
    return null;
  }
}

/** Geocode unique addresses until the time budget runs out. Cached hits are free. */
export async function geocodeAddresses(
  addresses: string[],
  options?: { fetchImpl?: typeof fetch; budgetMs?: number },
): Promise<Record<string, GeoPoint | null>> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const deadline = Date.now() + (options?.budgetMs ?? 8000);
  const out: Record<string, GeoPoint | null> = {};
  const seen = new Set<string>();
  for (const address of addresses) {
    const trimmed = address.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    if (Date.now() > deadline && !memory.has(trimmed.toLowerCase())) continue;
    out[trimmed] = await geocodeAddress(trimmed, fetchImpl);
  }
  return out;
}
