export interface GeoPoint {
  latitude: number;
  longitude: number;
}

type CacheEntry = { at: number; point: GeoPoint | null };

const memory = new Map<string, CacheEntry>();
const OK_TTL_MS = 12 * 60 * 60 * 1000;
const MISS_TTL_MS = 10 * 60 * 1000;

/**
 * Secondary unit designators that Nominatim often cannot match.
 * Short "FL" is intentionally omitted so a Florida ZIP segment is left intact.
 */
const UNIT_LABEL = '(?:suite|ste|apartment|apt|unit|building|bldg|floor|flr|room|rm|space|spc|dept)';
const POSTAL_SEGMENT = /^(?:[A-Za-z]{2}|[A-Za-z][A-Za-z .'-]{2,})\s+\d{5}(?:-\d{4})?$/;

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

function cacheFresh(entry: CacheEntry | undefined): boolean {
  if (!entry) return false;
  const ttl = entry.point ? OK_TTL_MS : MISS_TTL_MS;
  return Date.now() - entry.at < ttl;
}

/** Drop suite, unit, and apartment tokens so a street-level geocode can still hit. */
export function stripUnitDesignators(query: string): string {
  const kept: string[] = [];
  for (const raw of query.split(',')) {
    const segment = raw.trim().replace(/\s+/g, ' ');
    if (!segment) continue;
    if (POSTAL_SEGMENT.test(segment)) {
      kept.push(segment);
      continue;
    }
    const unitPhrase = new RegExp(`\\(?\\s*\\b${UNIT_LABEL}\\.?\\s*#?\\s*[A-Za-z0-9-]+\\s*\\)?`, 'gi');
    const next = segment
      .replace(unitPhrase, ' ')
      .replace(/(^|\s)#\s*[A-Za-z0-9-]+\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (next) kept.push(next);
  }
  return kept.join(', ');
}

/** Original query first, then the same address with unit tokens removed. */
export function geocodeQueryVariants(query: string): string[] {
  const original = query.trim().replace(/\s+/g, ' ');
  if (!original) return [];
  const variants = [original];
  const stripped = stripUnitDesignators(original);
  if (stripped && stripped.toLowerCase() !== original.toLowerCase()) variants.push(stripped);
  return variants;
}

type LookupResult = { ok: true; point: GeoPoint | null } | { ok: false };

async function lookupNominatim(query: string, fetchImpl: typeof fetch): Promise<LookupResult> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetchImpl(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'FixTray/1.0 (shop road-call map; https://fixtray.app)',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false };
    const data = await res.json();
    const row = Array.isArray(data) ? data[0] : null;
    return { ok: true, point: row ? asPoint(row.lat, row.lon) : null };
  } catch {
    return { ok: false };
  }
}

/**
 * Forward-geocode a street address with OpenStreetMap Nominatim.
 * No API key. A suite/unit that makes the full query miss is retried without
 * that token. Failures return null — callers must not substitute a default city.
 * The caller's address string is not rewritten; only the search query changes.
 */
export async function geocodeAddress(
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GeoPoint | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;

  const hit = memory.get(key);
  if (cacheFresh(hit)) return hit!.point;

  const variants = geocodeQueryVariants(query);
  let point: GeoPoint | null = null;
  let definitiveMiss = true;

  for (const variant of variants) {
    const variantKey = variant.toLowerCase();
    const cached = memory.get(variantKey);
    if (cacheFresh(cached)) {
      if (cached!.point) {
        point = cached!.point;
        break;
      }
      continue;
    }

    const looked = await lookupNominatim(variant, fetchImpl);
    if (!looked.ok) {
      definitiveMiss = false;
      continue;
    }
    memory.set(variantKey, { at: Date.now(), point: looked.point });
    if (looked.point) {
      point = looked.point;
      break;
    }
  }

  if (point || definitiveMiss) {
    memory.set(key, { at: Date.now(), point });
  }
  return point;
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
