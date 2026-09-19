export type ShopServiceOption = { value: string; label: string };

/**
 * Normalize shop service records from /api/services (serviceName)
 * or similar payloads (name) into unique dropdown options.
 */
export function mapShopServiceOptions(services: unknown): ShopServiceOption[] {
  if (!Array.isArray(services)) return [];

  const names = services
    .map((service) => {
      if (!service || typeof service !== 'object') return '';
      const record = service as { serviceName?: unknown; name?: unknown };
      return String(record.serviceName || record.name || '').trim();
    })
    .filter((name) => name.length > 0);

  return Array.from(new Set(names)).map((name) => ({ value: name, label: name }));
}
