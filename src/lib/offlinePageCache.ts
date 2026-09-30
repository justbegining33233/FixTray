import { portalAccessDecision } from '@/lib/roleMenus';

const RUNTIME = '10';

type OfflineAccess = {
  PAGE_CACHE: string;
  normalizeRole: (role: string | null | undefined) => string;
  decision: (pathname: string, role: string | null | undefined) => string;
  stablePath: (pathname: string, search: string) => string;
  pageCacheUrl: (origin: string, role: string, pathAndSearch: string, kind: string, userId: string) => string;
  sessionMarker: (origin: string, role: string, userId: string) => string;
};

type OfflineSessionApi = {
  readSession: () => Promise<{ role: string; userId: string }>;
  writeSession: (role: string, userId: string) => Promise<{ role: string; userId: string }>;
};

declare global {
  interface Window {
    FixTrayOfflineAccess?: OfflineAccess;
    FixTrayOfflineSession?: OfflineSessionApi;
  }
}

function loadScript(src: string): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) return Promise.resolve();
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

let loading: Promise<boolean> | null = null;

function runtimeReady(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.FixTrayOfflineAccess && window.FixTrayOfflineSession) return Promise.resolve(true);
  if (!loading) {
    loading = loadScript(`/offline-access.js?v=${RUNTIME}`)
      .then(() => loadScript(`/offline-session.js?v=${RUNTIME}`))
      .then(() => Boolean(window.FixTrayOfflineAccess && window.FixTrayOfflineSession))
      .catch(() => false);
  }
  return loading;
}

async function retainPages(role: string, userId: string): Promise<void> {
  const access = window.FixTrayOfflineAccess;
  if (!access || !('caches' in window)) return;
  const marker = role && userId ? access.sessionMarker(window.location.origin, role, userId) : '';
  const cache = await caches.open(access.PAGE_CACHE);
  const keys = await cache.keys();
  await Promise.all(keys.map((key) => {
    if (marker && key.url.startsWith(marker)) return Promise.resolve(false);
    return cache.delete(key);
  }));
}

/** Remember who is signed in, and drop page snapshots that belong to someone else. */
export async function rememberOfflineSession(role: string | null, userId: string | null): Promise<void> {
  try {
    if (!(await runtimeReady())) return;
    const access = window.FixTrayOfflineAccess;
    const session = window.FixTrayOfflineSession;
    if (!access || !session) return;
    const previous = await session.readSession();
    const nextRole = role ? access.normalizeRole(role) : '';
    const nextId = userId ? String(userId) : '';
    await session.writeSession(nextRole, nextId);
    if (previous.role !== nextRole || previous.userId !== nextId) {
      await retainPages(nextRole, nextId);
    }
  } catch {
    // Signing in still finishes when the device cannot store an offline copy.
  }
}

/**
 * Save the open page for this user. Full reloads while offline replay it.
 * Pages the role cannot open are not stored.
 */
export async function cacheCurrentDocument(role: string | null, userId: string | null, signal?: AbortSignal): Promise<void> {
  await rememberOfflineSession(role, userId);
  try {
    if (signal?.aborted || !role || !userId || typeof window === 'undefined' || !navigator.onLine) return;
    const access = window.FixTrayOfflineAccess;
    const sessionApi = window.FixTrayOfflineSession;
    if (!access || !sessionApi) return;
    const path = window.location.pathname;
    const search = window.location.search;
    const href = window.location.href;
    if (access.decision(path, role) !== 'cached') return;
    if (portalAccessDecision(path, role) !== 'allow') return;

    const response = await fetch(href, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      credentials: 'same-origin',
      signal,
    });
    if (signal?.aborted || !response.ok || response.type === 'opaqueredirect') return;
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('text/html')) return;

    const current = await sessionApi.readSession();
    if (current.userId !== String(userId) || current.role !== access.normalizeRole(role)) return;
    const stable = access.stablePath(path, search);
    const key = access.pageCacheUrl(window.location.origin, role, stable, 'doc', String(userId));
    const cache = await caches.open(access.PAGE_CACHE);
    await cache.put(key, response);
  } catch {
    // The next online visit can try again. A failed save must not break the page.
  }
}
