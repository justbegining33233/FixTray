import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { checkRateLimit, getClientIP } from '@/lib/rateLimit';

const SESSION_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATIC_FILE = /\.(?:png|jpe?g|gif|webp|svg|ico|css|js|map|woff2?|ttf|txt|xml|json|webmanifest)$/i;

function ipv4Pattern(): RegExp {
  return /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/;
}

/** SHA-256 hex of a server salt and the visitor address. Never the address itself. */
export function hashVisitorIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const trimmed = ip.trim();
  if (!trimmed || trimmed.toLowerCase() === 'unknown') return null;
  const salt = process.env.PAGE_VIEW_IP_SALT || process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'fixtray-page-view';
  return crypto.createHash('sha256').update(`${salt}|${trimmed}`).digest('hex');
}

export function clientIpFromRequest(request: Request): string | null {
  const ip = getClientIP(request);
  if (!ip || ip.toLowerCase() === 'unknown') return null;
  return ip;
}

export function cleanPagePath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return null;
  const path = trimmed.split('?')[0].split('#')[0];
  if (!path.startsWith('/') || path.length > 300) return null;
  if (path.startsWith('/api/') || path.startsWith('/_next/') || path === '/_next') return null;
  if (STATIC_FILE.test(path)) return null;
  if (ipv4Pattern().test(path)) return null;
  return path;
}

export function cleanReferrer(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  if (ipv4Pattern().test(url.hostname) || url.hostname.includes(':')) return null;
  const path = url.pathname && url.pathname !== '/' ? url.pathname : '';
  const stored = `${url.origin}${path}`.slice(0, 300);
  if (ipv4Pattern().test(stored)) return null;
  return stored;
}

export function cleanUserAgent(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value
    .replace(new RegExp(ipv4Pattern().source, 'g'), '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || ipv4Pattern().test(cleaned)) return null;
  return cleaned.slice(0, 300);
}

export function cleanSessionId(value: unknown): string {
  if (typeof value === 'string' && SESSION_RE.test(value.trim())) return value.trim();
  return crypto.randomUUID();
}

export type RecordPageViewInput = {
  path: unknown;
  userAgent?: unknown;
  ip?: string | null;
  sessionId?: unknown;
  referrer?: unknown;
};

/**
 * Writes one row to the existing page_views table.
 * The visitor address is hashed into ipHash. It is not stored and not logged.
 */
export async function recordPageView(input: RecordPageViewInput): Promise<{ ok: true } | { ok: false; status: number }> {
  const path = cleanPagePath(input.path);
  if (!path) return { ok: false, status: 400 };

  const ipHash = hashVisitorIp(input.ip);
  const limitKey = `pageview:${ipHash || 'none'}`;
  const limited = await checkRateLimit(limitKey, { maxRequests: 120, windowMs: 60 * 1000 });
  if (!limited.success) return { ok: false, status: 429 };

  try {
    await prisma.pageView.create({
      data: {
        path,
        userAgent: cleanUserAgent(input.userAgent),
        ipHash,
        sessionId: cleanSessionId(input.sessionId),
        referrer: cleanReferrer(input.referrer),
      },
    });
    return { ok: true };
  } catch {
    console.error('Failed to record page view');
    return { ok: false, status: 500 };
  }
}

export type RecentPageView = {
  path: string;
  createdAt: string;
  referrer: string | null;
};

export type PageViewSummary = {
  visitCount: number;
  uniqueVisitors: number;
  recentPages: RecentPageView[];
};

/**
 * Visit count is every stored page view.
 * Unique visitors are distinct non-null ipHash values, so a shared network
 * counts once and a row with no address hash is not a visitor.
 */
export async function pageViewSummary(): Promise<PageViewSummary> {
  const [visitCount, visitors, recent] = await Promise.all([
    prisma.pageView.count(),
    prisma.pageView.groupBy({
      by: ['ipHash'],
      where: { ipHash: { not: null } },
    }),
    prisma.pageView.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { path: true, createdAt: true, referrer: true },
    }),
  ]);

  return {
    visitCount,
    uniqueVisitors: visitors.length,
    recentPages: recent.map((row) => ({
      path: row.path,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      referrer: row.referrer,
    })),
  };
}
