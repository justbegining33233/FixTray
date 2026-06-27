/* eslint-disable */
// FixTray Service Worker — offline caching + background sync
const CACHE_NAME = 'fixtray-v3';
const API_CACHE   = 'fixtray-api-v3';

// Only pre-cache the offline fallback page — NOT app HTML pages.
// HTML pages must always load from the network so clients get the
// latest JS/CSS after every deployment without a hard refresh.
const PRECACHE_URLS = [
  '/offline',
];

// ─── Install: pre-cache offline page only ────────────────────────────────────
self.addEventListener('install', (event) => {
  // Take control immediately so the new SW handles fetches right away.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) =>
        cache.addAll(PRECACHE_URLS).catch(() => {/* ignore individual failures */})
      )
      .catch(() => undefined)
  );
});

// ─── Activate: clean up old caches ───────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch: routing strategy ──────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests — mutations go straight to the network.
  if (request.method !== 'GET') return;

  // API routes: network-first, fall back to cached response when offline.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE)
              .then((cache) => cache.put(request, clone))
              .catch(() => undefined);
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) =>
            cached || new Response(JSON.stringify({ error: 'offline', cached: false }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            })
          )
        )
    );
    return;
  }

  // Navigation requests (HTML pages): NEVER serve from cache.
  // Always go to the network so clients get the latest HTML/JS after a deploy.
  // Only fall back to the /offline page when there is genuinely no connection.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/offline').then(
          (cached) => cached || new Response('Offline', { status: 503 })
        )
      )
    );
    return;
  }

  // Next.js hashed static assets: cache-first (filename already contains content hash).
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) => cached || fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(request, clone))
              .catch(() => undefined);
          }
          return response;
        })
      )
    );
    return;
  }

  // Everything else (images, fonts, etc.): network-first.
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// ─── Background Sync: flush queued mutations when back online ─────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'fixtray-mutation-queue') {
    event.waitUntil(flushMutationQueue());
  }
});

async function flushMutationQueue() {
  const db = await openDB();
  const tx = db.transaction('mutations', 'readwrite');
  const store = tx.objectStore('mutations');
  const all = await storeGetAll(store);

  for (const item of all) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: { 'Content-Type': 'application/json', ...(item.headers || {}) },
        body: JSON.stringify(item.body),
      });
      if (response.ok) {
        store.delete(item.id);
      }
    } catch (_) {
      // still offline — leave in queue
    }
  }

  // Notify all open clients that sync is complete
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach((c) => c.postMessage({ type: 'SYNC_COMPLETE' }));
}

// ─── Minimal IndexedDB helpers (used inside SW) ───────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('fixtray-offline', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('mutations')) {
        db.createObjectStore('mutations', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror  = (e) => reject(e.target.error);
  });
}

function storeGetAll(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror  = (e) => reject(e.target.error);
  });
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Notification', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Notification';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192x192.png',
    badge: data.badge || '/icon-96x96.png',
    data: data.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});