/**
 * FixTray mail inside the app is limited to one admin login.
 * The username is compared exactly, the same way admin login looks it up.
 * Lowercase supadm1006 is a different account and does not get this page.
 */

export const PLATFORM_EMAIL_ACCOUNT = 'SupAdm1006';
export const PLATFORM_EMAIL_HREF = '/admin/emails';

export const SUPPORT_INBOX = 'support@fixtray.app';

export const PLATFORM_FROM_CHOICES = [
  { address: SUPPORT_INBOX, from: 'FixTray Support <support@fixtray.app>' },
] as const;

export function emailAddress(value: string): string {
  const bracket = value.match(/<([^>]+)>/);
  return (bracket ? bracket[1] : value).trim().toLowerCase();
}

/** Split a header without breaking a display name that contains a comma. */
function splitAddressHeader(value: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  for (const char of value) {
    if (char === '<') depth += 1;
    if (char === '>') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** Addresses from a Resend to, cc, bcc, or received_for field. */
export function addressList(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : value == null || value === '' ? [] : [value];
  const addresses: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      addresses.push(...splitAddressHeader(item));
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const email = typeof record.email === 'string' ? record.email : typeof record.address === 'string' ? record.address : '';
    if (email.trim()) addresses.push(email.trim());
  }
  return addresses;
}

/** True when the message was addressed to the support inbox. */
export function isSupportInboxRecipient(value: unknown): boolean {
  return addressList(value).some((item) => emailAddress(item) === SUPPORT_INBOX);
}

export function isPlatformEmailAccount(username: unknown): boolean {
  return typeof username === 'string' && username.trim() === PLATFORM_EMAIL_ACCOUNT;
}

export function isPlatformEmailPath(pathname: string): boolean {
  const path = pathname.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  return path === PLATFORM_EMAIL_HREF || path.startsWith(`${PLATFORM_EMAIL_HREF}/`);
}

/** The Emails page sends only from support@fixtray.app. */
export function platformFromHeader(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  const bracket = raw.match(/<([^>]+)>/);
  const email = (bracket ? bracket[1] : raw).trim().toLowerCase();
  const choice = PLATFORM_FROM_CHOICES.find((item) => item.address === email);
  return choice ? choice.from : null;
}
