/** Shop, manager, and tech nav may read shop records. Customers must not. */
const SHOP_SCOPED_ROLES = new Set(['shop', 'manager', 'tech', 'admin', 'superadmin']);

export function roleUsesShopAdminApis(role: string | null | undefined): boolean {
  return typeof role === 'string' && SHOP_SCOPED_ROLES.has(role);
}

/** Stripe Connect onboarding is a shop-owner action. */
export function roleMayStartStripeConnect(role: string | null | undefined): boolean {
  return role === 'shop';
}

/**
 * Welcome text must be identical on the server and the first client render.
 * localStorage is only available after mount, so the name stays blank until then.
 */
export function welcomeDisplayName(options: {
  mounted: boolean;
  accountName?: string | null;
  storedName?: string | null;
}): string {
  if (!options.mounted) return '';
  const accountName = typeof options.accountName === 'string' ? options.accountName.trim() : '';
  if (accountName) return accountName;
  const storedName = typeof options.storedName === 'string' ? options.storedName.trim() : '';
  return storedName;
}

export type LoginProbe = 'customer' | 'admin' | 'tech' | 'shop';

const DEFAULT_LOGIN_PROBES: LoginProbe[] = ['admin', 'tech', 'shop', 'customer'];

/**
 * Email logins are customers in this app. Try that account before admin, tech,
 * and shop so a successful customer sign-in does not fire those 401s.
 */
export function loginProbeOrder(identifier: string): LoginProbe[] {
  const value = identifier.trim();
  if (value.includes('@')) return ['customer', 'admin', 'tech', 'shop'];
  return DEFAULT_LOGIN_PROBES;
}
