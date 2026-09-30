import type { Metadata } from 'next';
import { fixtrayServiceFeeLabel } from '@/lib/publicFeeCopy';

export const PUBLIC_SITE_ORIGIN = 'https://fixtray.app';

export const PUBLIC_SITE_TITLE = 'FixTray - Free work orders for auto service';

export const PUBLIC_SITE_DESCRIPTION =
  `FixTray is a free work-order system for auto service shop members (the shop owner and that shop's employees). Customers pay the shop's quote plus a FixTray service fee of ${fixtrayServiceFeeLabel()} when that fee applies. A mobile app is in development; until it ships, use the website, including a phone browser.`;

export function publicCanonicalUrl(path: string): string {
  if (path === '/') return PUBLIC_SITE_ORIGIN;
  return `${PUBLIC_SITE_ORIGIN}${path}`;
}

/** Title, description, canonical URL, and social tags for one public page. */
export function marketingMetadata(path: string): Metadata {
  const canonical = publicCanonicalUrl(path);
  return {
    title: PUBLIC_SITE_TITLE,
    description: PUBLIC_SITE_DESCRIPTION,
    alternates: { canonical },
    openGraph: {
      title: PUBLIC_SITE_TITLE,
      description: PUBLIC_SITE_DESCRIPTION,
      url: canonical,
      siteName: 'FixTray',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: PUBLIC_SITE_TITLE,
      description: PUBLIC_SITE_DESCRIPTION,
    },
  };
}
