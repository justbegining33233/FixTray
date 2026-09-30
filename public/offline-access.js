/* Role rules for offline navigation. Shared by the service worker and the page cache.
   Each role only gets pages that role already has. Tech job download stays on /tech. */
(function (root) {
  var SHOP_SCOPED = ['/shop', '/tech', '/manager', '/customer', '/workorders', '/reports', '/tech-offline'];
  var SHOP_LEVEL_ADMIN = [
    '/admin/dvi-approvals',
    '/admin/inventory',
    '/admin/environmental-fees',
    '/admin/compliance-dashboard',
    '/admin/campaigns',
    '/admin/performance',
  ];

  function normalizeRole(role) {
    return String(role || '').trim().toLowerCase();
  }

  function clean(pathname) {
    var path = String(pathname || '/').split('?')[0].split('#')[0];
    path = path.replace(/\/+$/, '');
    return path || '/';
  }

  function under(path, prefix) {
    return path === prefix || path.indexOf(prefix + '/') === 0;
  }

  function isPlatform(role) {
    return role === 'admin' || role === 'superadmin';
  }

  function isShopScoped(path) {
    var i;
    for (i = 0; i < SHOP_SCOPED.length; i += 1) {
      if (under(path, SHOP_SCOPED[i])) return true;
    }
    for (i = 0; i < SHOP_LEVEL_ADMIN.length; i += 1) {
      if (under(path, SHOP_LEVEL_ADMIN[i])) return true;
    }
    return false;
  }

  function isTechSurface(path) {
    return under(path, '/tech') || under(path, '/tech-offline');
  }

  /* True only for pages this role is allowed to keep on the device. */
  function mayServeCached(role, pathname) {
    var path = clean(pathname);
    role = normalizeRole(role);
    if (!role) return false;
    if (isPlatform(role)) {
      if (isShopScoped(path)) return false;
      return under(path, '/admin') || under(path, '/superadmin');
    }
    if (role === 'customer') return under(path, '/customer');
    if (role === 'shop') return under(path, '/shop') || under(path, '/workorders');
    if (role === 'manager') {
      return under(path, '/manager') || under(path, '/shop/new-inshop-job') || under(path, '/workorders');
    }
    if (role === 'tech') return isTechSurface(path);
    return false;
  }

  /* tech-shell | cached | offline */
  function decision(pathname, role) {
    var path = clean(pathname);
    role = normalizeRole(role);
    if (path === '/offline' || path === '/offline.html' || under(path, '/__fixtray_page__')) return 'offline';
    if (isTechSurface(path)) return role === 'tech' ? 'tech-shell' : 'offline';
    if (!mayServeCached(role, path)) return 'offline';
    return 'cached';
  }

  /* tech-shell | cached-page | offline-screen */
  function navigationTarget(pathname, role, hasCachedPage) {
    var kind = decision(pathname, role);
    if (kind === 'tech-shell') return 'tech-shell';
    if (kind === 'cached' && hasCachedPage) return 'cached-page';
    return 'offline-screen';
  }

  function stablePath(pathname, search) {
    var path = clean(pathname);
    var params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
    params.delete('_rsc');
    var query = params.toString();
    return query ? path + '?' + query : path;
  }

  function pageCacheUrl(origin, role, pathAndSearch, kind, userId) {
    var base = String(origin || '').replace(/\/+$/, '');
    var rolePart = encodeURIComponent(normalizeRole(role));
    var idPart = encodeURIComponent(String(userId || ''));
    var marker = kind === 'rsc' ? 'rsc' : 'doc';
    return base + '/__fixtray_page__/' + rolePart + '/' + idPart + '?u=' + encodeURIComponent(pathAndSearch || '/') + '&k=' + marker;
  }

  function sessionMarker(origin, role, userId) {
    if (!role || !userId) return '';
    var base = String(origin || '').replace(/\/+$/, '');
    return base + '/__fixtray_page__/' + encodeURIComponent(normalizeRole(role)) + '/' + encodeURIComponent(String(userId)) + '?';
  }

  root.FixTrayOfflineAccess = {
    PAGE_CACHE: 'fixtray-pages-v1',
    OFFLINE_DOCUMENT: '/offline.html',
    SHOP_SCOPED_PREFIXES: SHOP_SCOPED,
    SHOP_LEVEL_ADMIN_PATHS: SHOP_LEVEL_ADMIN,
    normalizeRole: normalizeRole,
    mayServeCached: mayServeCached,
    decision: decision,
    navigationTarget: navigationTarget,
    stablePath: stablePath,
    pageCacheUrl: pageCacheUrl,
    sessionMarker: sessionMarker,
  };
})(typeof self !== 'undefined' ? self : globalThis);
