import type { Metadata } from 'next';
import { HELP_ARTICLES } from '@/lib/helpCenter';

export const PUBLIC_SITE_ORIGIN = 'https://fixtray.app';

export const PUBLIC_SITE_TITLE = 'FixTray - Free work orders for auto service';

export const PUBLIC_SITE_DESCRIPTION =
  `FixTray is a free work-order system for auto service shop members (the shop owner and that shop's employees). Customers pay the shop's quote plus a FixTray service fee when that fee applies. A mobile app is in development; until it ships, use the website, including a phone browser.`;

const PUBLIC_PAGE_COPY: Record<string, { title: string; description: string }> = {
  '/features': {
    title: 'Features | FixTray',
    description:
      'Work orders, estimates, inventory, payroll, and customer updates for auto service shops. Shop members use FixTray at no charge.',
  },
  '/about': {
    title: 'About | FixTray',
    description:
      'FixTray is a free work-order system for roadside and in-shop auto service, used by shop owners, managers, technicians, and customers.',
  },
  '/contact': {
    title: 'Contact | FixTray',
    description: 'Contact FixTray about the work-order system. Expect a response within one business day.',
  },
  '/demo': {
    title: 'Demo shop | FixTray',
    description:
      'Email yourself a username and password for a demo shop. The 30 minutes start at your first login. This is not a meeting.',
  },
  '/security': {
    title: 'Security | FixTray',
    description:
      'Role checks, JWT authentication, password hashing, CSRF protection, rate limiting, and input validation in FixTray.',
  },
  '/privacy': {
    title: 'Privacy Policy | FixTray',
    description: 'How FixTray collects and uses account, job, and payment information on fixtray.app.',
  },
  '/terms': {
    title: 'Terms of Service | FixTray',
    description:
      'Terms for using FixTray. The work-order system is free for shop members. A customer pays the shop quote plus a service fee when that fee applies.',
  },
  '/get-started': {
    title: 'Get started | FixTray',
    description: 'Create a shop account or a customer account on FixTray. Log in is for people who already have an account.',
  },
  '/help': {
    title: 'Help Center | FixTray',
    description:
      'Short how-tos for approving an estimate, adding a technician, turn-by-turn directions, and notification flags.',
  },
};

const HELP_PAGE_TITLES: Record<string, string> = {
  'approve-an-estimate': 'Approve an estimate | FixTray Help',
  'deny-an-estimate': 'Deny an estimate | FixTray Help',
  'add-a-tech': 'Add a tech | FixTray Help',
  'turn-by-turn': 'Turn-by-turn directions | FixTray Help',
  'notification-flag': 'Notification flags | FixTray Help',
  'email-support': 'Email support | FixTray Help',
};

export function publicCanonicalUrl(path: string): string {
  if (path === '/') return PUBLIC_SITE_ORIGIN;
  return `${PUBLIC_SITE_ORIGIN}${path}`;
}

function helpArticleCopy(path: string): { title: string; description: string } | null {
  const match = /^\/help\/([^/]+)$/.exec(path);
  if (!match) return null;
  const article = HELP_ARTICLES.find((item) => item.slug === match[1]);
  if (!article) return null;
  return {
    title: HELP_PAGE_TITLES[article.slug] ?? `${article.title} | FixTray Help`,
    description: article.summary,
  };
}

function pageCopy(path: string): { title: string; description: string } {
  if (path === '/') {
    return { title: PUBLIC_SITE_TITLE, description: PUBLIC_SITE_DESCRIPTION };
  }
  return PUBLIC_PAGE_COPY[path] ?? helpArticleCopy(path) ?? {
    title: PUBLIC_SITE_TITLE,
    description: PUBLIC_SITE_DESCRIPTION,
  };
}

/** Title, description, canonical URL, and social tags for one public page. */
export function marketingMetadata(path: string): Metadata {
  const canonical = publicCanonicalUrl(path);
  const { title, description } = pageCopy(path);
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'FixTray',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}
