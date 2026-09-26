/* eslint-disable */
// FixTray Service Worker — offline caching + background sync
const CACHE_NAME = 'fixtray-v9';
const API_CACHE   = 'fixtray-api-v3';

// Precache the static tech workspace. Next HTML stays network-first so
// deploys are not stuck behind an old shell. When the network is gone,
// navigation falls back to this workspace.
const OFFLINE_SHELL = '/tech-offline/index.html';
const PRECACHE_URLS = [
  '/offline',
  OFFLINE_SHELL,
  '/tech-offline/app.js',
  '/tech-offline/app.css',
  '/tech-offline/engine.js',
  '/tech-offline/platform-owner.js',
  '/tech-offline/fonts/inter-latin.woff2',
  '/tech-offline/fonts/plus-jakarta-latin.woff2',
];

// ─── Install: pre-cache offline page only ────────────────────────────────────
self.addEventListener('install', (event) => {
  // Take control immediately so the new SW handles fetches right away.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(PRECACHE_URLS.map((url) => precacheUrl(cache, url))))
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
      .then(() => releaseStaleOfflineClients())
  );
});

// addAll follows redirects and would store /admin/home HTML under a script URL.
// Keep only a real 200, and never a document in place of a script or style.
function precacheUrl(cache, url) {
  const documentUrl = url === '/offline' || url === OFFLINE_SHELL || /\.html$/i.test(url);
  return fetch(url, { redirect: 'manual', cache: 'no-store' }).then((response) => {
    if (!response || !response.ok || response.type === 'opaqueredirect') return undefined;
    if (!documentUrl && isHtmlResponse(response)) return undefined;
    return cache.put(url, response);
  }).catch(() => undefined);
}

function isOfflineWorkspacePath(pathname) {
  return pathname === '/tech-offline' || pathname.startsWith('/tech-offline/');
}

function isTechWorkspaceNavigation(pathname) {
  return pathname === '/tech' || pathname.startsWith('/tech/') || isOfflineWorkspacePath(pathname);
}

function offlineDocument(pathname) {
  if (!isTechWorkspaceNavigation(pathname)) {
    return caches.match('/offline').then((cached) => cached || new Response('Offline', { status: 503 }));
  }
  return caches.match(OFFLINE_SHELL).then((shell) => {
    if (shell) return injectPlatformOwnerEscape(shell);
    return caches.match('/offline').then((cached) => cached || new Response('Offline', { status: 503 }));
  });
}

// A controlling worker can keep serving a cached copy of this page after the
// platform-owner redirect ships. Reload those tabs so the new handler runs.
function releaseStaleOfflineClients() {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) =>
    Promise.all(clients.map((client) => {
      let path = '';
      try { path = new URL(client.url).pathname; } catch (e) { return undefined; }
      if (!isOfflineWorkspacePath(path) || typeof client.navigate !== 'function') return undefined;
      return client.navigate(client.url);
    }))
  );
}

function isHtmlResponse(response) {
  if (!response) return false;
  return (response.headers.get('content-type') || '').toLowerCase().indexOf('text/html') !== -1;
}

function injectPlatformOwnerEscape(response) {
  return Promise.all([response.text(), caches.match('/tech-offline/platform-owner.js')]).then(([html, script]) => {
    if (html.indexOf('fixtrayLeavePlatformOwner') !== -1) {
      return new Response(html, { status: response.status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    const finish = (code) => {
      // A redirected asset cache can store the platform home HTML under the script URL.
      // Never execute that as JavaScript.
      if (code && String(code).trim().charAt(0) === '<') code = '';
      // Inline the escape so a cached page can leave even when the script request cannot.
      const tag = code
        ? '<script>' + code.replace(/<\/script/gi, '<\\/script') + '</script>'
        : '<script src="/tech-offline/platform-owner.js"></script>';
      const next = html.indexOf('</head>') !== -1 ? html.replace('</head>', tag + '</head>') : tag + html;
      return new Response(next, { status: response.status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    };
    return script && !isHtmlResponse(script) ? script.text().then(finish) : finish('');
  });
}

// Document loads hit the network so a platform-owner redirect can change the
// URL. Cache is only the offline fallback, and that fallback still carries
// the escape script.
function networkOfflineNavigation(request) {
  return fetch(request, { redirect: 'manual', cache: 'no-store' }).then((response) => {
    if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
      return response;
    }
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(OFFLINE_SHELL, copy)).catch(() => undefined);
    }
    return response;
  }).catch(() =>
    caches.match(OFFLINE_SHELL).then((cached) => (cached ? injectPlatformOwnerEscape(cached) : new Response('Offline', { status: 503 })))
  );
}

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

  // Static tech workspace. Navigations are network-first (see networkOfflineNavigation).
  // Scripts and styles stay cache-first so a cold start with no signal still opens.
  if (isOfflineWorkspacePath(url.pathname)) {
    if (request.mode === 'navigate') {
      event.respondWith(networkOfflineNavigation(request));
      return;
    }
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached && !isHtmlResponse(cached)) return cached;
        return fetch(request, { redirect: 'manual' }).then((response) => {
          if (response.ok && response.type !== 'opaqueredirect' && !isHtmlResponse(response)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => undefined);
            return response;
          }
          return cached || response;
        }).catch(() => cached || new Response('', { status: 504 }));
      })
    );
    return;
  }

  // Navigation: network first so deploys land immediately.
  // Offline, techs get the workspace. Every other role gets the offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => offlineDocument(url.pathname))
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
  if (event.tag === 'fixtray-tech-offline' || event.tag === 'fixtray-mutation-queue') {
    event.waitUntil((async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach((client) => client.postMessage({ type: 'FIXTRAY_SYNC' }));
      if (event.tag === 'fixtray-mutation-queue') await flushMutationQueue();
    })());
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