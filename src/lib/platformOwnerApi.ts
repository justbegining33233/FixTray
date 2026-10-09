/**
 * The platform owner (SupAdm1006) has no shop. Shop-operational APIs return
 * 403 for that login. Platform administration (shop list and approvals,
 * users, tenants, fee revenue, year-end, health) stays open.
 */

const SHOP_OPERATIONAL_PREFIXES = [
  '/api/analytics',
  '/api/appointments',
  '/api/ar-aging',
  '/api/bays',
  '/api/campaigns',
  '/api/core-returns',
  '/api/customers',
  '/api/dvi',
  '/api/dvi-approvals',
  '/api/dtc-lookup',
  '/api/environmental-fees',
  '/api/fleet',
  '/api/fleet-accounts',
  '/api/fleet-vehicles',
  '/api/inventory',
  '/api/leave-requests',
  '/api/loaner-vehicles',
  '/api/loaners',
  '/api/location',
  '/api/manager',
  '/api/messages/contacts',
  '/api/offline',
  '/api/payment-links',
  '/api/payment/checkout',
  '/api/payment/create-intent',
  '/api/payment/refund',
  '/api/payroll',
  '/api/permissions',
  '/api/photos',
  '/api/profit-margins',
  '/api/purchase-orders',
  '/api/recurring-workorders',
  '/api/reports',
  '/api/services',
  '/api/shift-swaps',
  '/api/shifts',
  '/api/shop',
  '/api/state-inspections',
  '/api/stripe/connect',
  '/api/tech',
  '/api/techs',
  '/api/time-tracking',
  '/api/timeclock',
  '/api/upload',
  '/api/vehicles',
  '/api/waiting-room',
  '/api/work-authorizations',
  '/api/workorders',
] as const;

/** Shop directory endpoints the platform owner uses for approvals. */
const PLATFORM_SHOP_DIRECTORY = new Set([
  '/api/shops/pending',
  '/api/shops/accepted',
  '/api/shops/register',
]);

function cleanPath(pathname: string): string {
  const path = pathname.split('?')[0].split('#')[0].replace(/\/+$/, '');
  return path || '/';
}

function under(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function isShopOperationalApi(pathname: string): boolean {
  const path = cleanPath(pathname);
  if (!path.startsWith('/api/')) return false;
  if (SHOP_OPERATIONAL_PREFIXES.some((prefix) => under(path, prefix))) return true;
  if (under(path, '/api/shops')) {
    return !PLATFORM_SHOP_DIRECTORY.has(path);
  }
  return false;
}

export const PLATFORM_OWNER_SHOP_DENIED = {
  error: 'Platform accounts cannot read shop operations.',
} as const;
