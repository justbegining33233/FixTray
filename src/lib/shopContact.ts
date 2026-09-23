const INVALID_EMAIL = new Set(['undefined', 'null', 'n/a', 'na', 'none', '-']);

/** A real contact address, or '' when the value is missing or the string "undefined". */
export function resolveShopContactEmail(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const value = candidate.trim();
    if (!value || INVALID_EMAIL.has(value.toLowerCase())) continue;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) continue;
    return value;
  }
  return '';
}

/** mailto href, or null so the UI never renders mailto:undefined. */
export function shopContactMailto(email: string): string | null {
  const resolved = resolveShopContactEmail(email);
  return resolved ? `mailto:${resolved}` : null;
}

/** Admin and superadmin contact views may show the shop owner email. */
export function canExposeShopContact(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'superadmin';
}

/**
 * Contact fields for GET /api/shops/accepted.
 * The public payload omits email; platform admins receive the shop owner email.
 */
export function acceptedShopContactPayload(
  shop: { email?: string | null; ownerName?: string | null },
  exposeContact: boolean,
): { email?: string; ownerName?: string } {
  if (!exposeContact) return {};
  return {
    email: typeof shop.email === 'string' ? shop.email : '',
    ownerName: typeof shop.ownerName === 'string' ? shop.ownerName : '',
  };
}
