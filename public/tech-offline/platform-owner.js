/* Platform owner escape for the static offline workspace.
   The service worker can serve this page from cache, so the Next.js
   redirect never runs. Leave for /admin/home when this device is online. */
(function (root) {
  function payloadRole(token) {
    try {
      var part = String(token || '').split('.')[1];
      if (!part) return '';
      var b64 = part.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      var json = JSON.parse(root.atob(b64));
      return typeof json.role === 'string' ? json.role.trim().toLowerCase() : '';
    } catch (e) {
      return '';
    }
  }

  function currentRole() {
    var tokenRole = '';
    var stored = '';
    try { tokenRole = payloadRole(root.localStorage.getItem('token')); } catch (e) { tokenRole = ''; }
    try { stored = String(root.localStorage.getItem('userRole') || '').trim().toLowerCase(); } catch (e) { stored = ''; }
    return tokenRole || stored;
  }

  function onWorkspace() {
    var path = root.location && root.location.pathname ? root.location.pathname : '';
    return path === '/tech-offline' || path.indexOf('/tech-offline/') === 0;
  }

  function leave() {
    if (!onWorkspace()) return;
    if (root.navigator && root.navigator.onLine === false) return;
    var role = currentRole();
    if (role !== 'admin' && role !== 'superadmin') return;
    if (root.location && typeof root.location.replace === 'function') {
      root.location.replace('/admin/home');
    }
  }

  root.fixtrayLeavePlatformOwner = leave;
  if (root.document && root.addEventListener) {
    leave();
    root.addEventListener('online', leave);
  }
})(typeof window !== 'undefined' ? window : this);
