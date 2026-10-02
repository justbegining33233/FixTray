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

/** True when the message was addressed to the support inbox. */
export function isSupportInboxRecipient(value: unknown): boolean {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  return list.some((item) => typeof item === 'string' && emailAddress(item) === SUPPORT_INBOX);
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
