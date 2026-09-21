export type ShopServiceOption = { value: string; label: string };
export type ShopServiceChannel = 'roadside' | 'in-shop' | 'any';

type ShopServiceRecord = {
  serviceName?: unknown;
  name?: unknown;
  isActive?: unknown;
  availableInShop?: unknown;
  availableRoadside?: unknown;
};

function flagAllows(value: unknown): boolean {
  return value !== false;
}

/** Missing flags stay eligible so existing catalog rows keep listing. */
export function isServiceOfferedForChannel(service: unknown, channel: ShopServiceChannel = 'any'): boolean {
  if (!service || typeof service !== 'object') return false;
  const record = service as ShopServiceRecord;
  if (!flagAllows(record.isActive)) return false;
  if (channel === 'roadside') return flagAllows(record.availableRoadside);
  if (channel === 'in-shop') return flagAllows(record.availableInShop);
  return true;
}

/**
 * Normalize shop service records from /api/services (serviceName)
 * or similar payloads (name) into unique dropdown options.
 * Channel filters respect active / roadside / in-shop toggles (VIS-110).
 */
export function mapShopServiceOptions(services: unknown, channel: ShopServiceChannel = 'any'): ShopServiceOption[] {
  if (!Array.isArray(services)) return [];

  const names = services
    .filter((service) => isServiceOfferedForChannel(service, channel))
    .map((service) => {
      const record = service as ShopServiceRecord;
      return String(record.serviceName || record.name || '').trim();
    })
    .filter((name) => name.length > 0);

  return Array.from(new Set(names)).map((name) => ({ value: name, label: name }));
}
