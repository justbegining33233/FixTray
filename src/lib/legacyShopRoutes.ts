export const LEGACY_SHOP_REDIRECTS = [
  { source: '/shop/board', destination: '/shop/home', permanent: false as const },
  { source: '/shop/appointments', destination: '/shop/calendar', permanent: false as const },
  { source: '/shop/subscribe', destination: '/shop/home', permanent: false as const },
];

/** Guessed shop URLs that used to 404. Send them to the real pages. */
export const GUESSED_SHOP_REDIRECTS = [
  { source: '/shop/messages', destination: '/shop/customer-messages', permanent: false as const },
  { source: '/shop/settings/billing', destination: '/shop/settings', permanent: false as const },
];
