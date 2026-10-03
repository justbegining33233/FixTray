/* eslint-disable */
// FixTray Service Worker — offline caching + background sync
// Bump the runtime query when this file's offline rules change so importScripts is not stale.
importScripts('/offline-access.js?v=10', '/offline-session.js?v=10');

const CACHE_NAME = 'fixtray-v10';
const API_CACHE   = 'fixtray-api-v4';
const PAGE_CACHE = self.FixTrayOfflineAccess.PAGE_CACHE;
const OFFLINE_DOCUMENT = self.FixTrayOfflineAccess.OFFLINE_DOCUMENT;

// Precache the static tech workspace and the role-neutral offline screen.
// Next HTML stays network-first so deploys are not stuck behind an old shell.
// When the network is gone, techs get the workspace. Every other role gets
// that role's cached page, or the static offline screen. Never another role's page.
const OFFLINE_SHELL = '/tech-offline/index.html';
const PRECACHE_URLS = [
  OFFLINE_DOCUMENT,
  OFFLINE_SHELL,
  '/tech-offline/app.js',
  '/tech-offline/app.css',
  '/tech-offline/engine.js',
  '/tech-offline/platform-owner.js',
  '/tech-offline/fonts/inter-latin.woff2',
  '/tech-offline/fonts/plus-jakarta-latin.woff2',
];

const OFFLINE_HTML_FALLBACK = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>You\'re Offline</title></head><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#000;color:#f1f5f9;font-family:system-ui,sans-serif;text-align:center;padding:24px"><main data-offline-screen="1"><h1>You\'re Offline</h1><p>It looks like you\'ve lost your internet connection. Some features may be unavailable until you reconnect.</p><p>Payments, approvals, estimates, and pay changes need a connection.</p><button type="button" onclick="location.reload()">Try Again</button><div><a id="offline-home" href="#">Go to your home</a></div></main><script>(function(){var homes={admin:"/admin/home",superadmin:"/admin/home",shop:"/shop/admin",manager:"/manager/home",tech:"/tech/home",customer:"/customer/dashboard"};var link=document.getElementById("offline-home");if(link){var role="";try{role=localStorage.getItem("userRole")||""}catch(e){role=""}link.setAttribute("href",homes[role]||"/auth/login")}window.addEventListener("online",function(){window.location.reload()})})();</script></body></html>';

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
          .filter((k) => k !== CACHE_NAME && k !== API_CACHE && k !== PAGE_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
      .then(() => releaseStaleOfflineClients())
  );
});

// addAll follows redirects and would store /admin/home HTML under a script URL.
// Keep only a real 200, and never a document in place of a script or style.
function precacheUrl(cache, url) {
  const documentUrl = url === OFFLINE_DOCUMENT || url === OFFLINE_SHELL || /\.html$/i.test(url);
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

function dropBody(response) {
  try {
    if (response && response.body && response.body.cancel) response.body.cancel();
  } catch (e) { /* already consumed */ }
}

function offlineScreen() {
  return caches.open(CACHE_NAME).then((cache) => cache.match(OFFLINE_DOCUMENT)).then((cached) => {
    if (cached) return cached;
    return new Response(OFFLINE_HTML_FALLBACK, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  });
}

function shellDocument() {
  return caches.open(CACHE_NAME).then((cache) => cache.match(OFFLINE_SHELL)).then((shell) => shell || caches.match(OFFLINE_SHELL));
}

function pageKey(session, url, kind) {
  if (!session || !session.role || !session.userId) return '';
  const stable = self.FixTrayOfflineAccess.stablePath(url.pathname, url.search);
  return self.FixTrayOfflineAccess.pageCacheUrl(self.location.origin, session.role, stable, kind, session.userId);
}

function cachedRolePage(session, url, kind) {
  const key = pageKey(session, url, kind);
  if (!key) return Promise.resolve(null);
  return caches.open(PAGE_CACHE).then((cache) => cache.match(key));
}

function stashRolePage(session, url, response, kind) {
  const key = pageKey(session, url, kind);
  const decision = self.FixTrayOfflineAccess.decision(url.pathname, session && session.role);
  if (!key || decision !== 'cached') {
    dropBody(response);
    return Promise.resolve();
  }
  return caches.open(PAGE_CACHE).then((cache) => cache.put(key, response)).catch(() => undefined);
}

// Offline navigation: tech workspace, this user's cached document, or the static screen.
function offlineDocument(input) {
  const url = typeof input === 'string' ? new URL(input, self.location.origin) : input;
  return self.FixTrayOfflineSession.readSession().then((session) => {
    const target = self.FixTrayOfflineAccess.navigationTarget(
      url.pathname,
      session && session.role,
      false,
    );
    if (target === 'tech-shell' || (session && session.role === 'tech' && isTechWorkspaceNavigation(url.pathname))) {
      return shellDocument().then((shell) => {
        if (shell) return injectPlatformOwnerEscape(shell);
        return offlineScreen();
      });
    }
    if (self.FixTrayOfflineAccess.decision(url.pathname, session && session.role) !== 'cached') {
      return offlineScreen();
    }
    return cachedRolePage(session, url, 'doc').then((page) => page || offlineScreen());
  }).catch(() => offlineScreen());
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

function isRedirect(response) {
  return !response || response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400);
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
// the escape script. A non-tech never receives the tech workspace.
function networkOfflineNavigation(request) {
  const url = new URL(request.url);
  return fetch(request, { redirect: 'manual', cache: 'no-store' }).then((response) => {
    if (isRedirect(response)) return response;
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(OFFLINE_SHELL, copy)).catch(() => undefined);
    }
    return response;
  }).catch(() => offlineDocument(url));
}

function networkThenRolePage(request) {
  const url = new URL(request.url);
  return fetch(request, { redirect: 'manual', cache: 'no-store' }).then((response) => {
    if (isRedirect(response)) return response;
    if (response.ok && isHtmlResponse(response)) {
      const copy = response.clone();
      self.FixTrayOfflineSession.readSession()
        .then((session) => stashRolePage(session, url, copy, 'doc'))
        .catch(() => dropBody(copy));
    }
    return response;
  }).catch(() => offlineDocument(url));
}

function isAppDataRequest(request) {
  if (request.mode === 'navigate') return false;
  const headers = request.headers;
  if (headers.get('RSC') === '1') return true;
  if (headers.get('Next-Router-Prefetch')) return true;
  if (headers.get('Next-Router-Segment-Prefetch')) return true;
  const accept = headers.get('Accept') || '';
  return accept.indexOf('text/x-component') !== -1;
}

function networkThenRoleData(request) {
  const url = new URL(request.url);
  return self.FixTrayOfflineSession.readSession().then((session) => {
    const allowed = self.FixTrayOfflineAccess.decision(url.pathname, session && session.role) === 'cached';
    return fetch(request).then((response) => {
      if (response.ok && allowed) {
        const copy = response.clone();
        stashRolePage(session, url, copy, 'rsc');
      }
      return response;
    }).catch(() => {
      if (!allowed) return new Response('', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      return cachedRolePage(session, url, 'rsc').then((cached) => cached || new Response('', { status: 503, headers: { 'Content-Type': 'text/plain' } }));
    });
  }).catch(() => new Response('', { status: 503, headers: { 'Content-Type': 'text/plain' } }));
}

// ─── Fetch: routing strategy ──────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests — mutations go straight to the network.
  if (request.method !== 'GET') return;

  if (url.pathname.startsWith('/__fixtray_page__')) {
    event.respondWith(new Response('', { status: 404 }));
    return;
  }

  // The support inbox must not replay a cached empty list as a successful load.
  if (url.pathname === '/api/admin/emails' || url.pathname.startsWith('/api/admin/emails/')) {
    event.respondWith(fetch(request));
    return;
  }

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
  // Offline, techs get the workspace. Every other role gets their own cached
  // page or the static offline screen. Blocked URLs never reuse another role's cache.
  if (request.mode === 'navigate') {
    event.respondWith(networkThenRolePage(request));
    return;
  }

  if (isAppDataRequest(request)) {
    event.respondWith(networkThenRoleData(request));
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
