import fs from 'fs';
import vm from 'vm';

const source = fs.readFileSync('public/tech-offline/platform-owner.js', 'utf8');
const sw = fs.readFileSync('public/sw.js', 'utf8');
const html = fs.readFileSync('public/tech-offline/index.html', 'utf8');

function token(role: string): string {
  const body = Buffer.from(JSON.stringify({ role })).toString('base64url');
  return `e30.${body}.sig`;
}

function boot(options: {
  path?: string;
  role?: string;
  tokenRole?: string | null;
  online?: boolean;
}) {
  const location = {
    pathname: options.path ?? '/tech-offline/',
    replaced: '',
    replace(url: string) { this.replaced = url; },
  };
  const storage: Record<string, string> = {};
  if (options.role) storage.userRole = options.role;
  if (options.tokenRole) storage.token = token(options.tokenRole);
  const listeners: Record<string, Array<() => void>> = {};
  const sandbox = {
    atob: (value: string) => Buffer.from(value, 'base64').toString('utf8'),
    localStorage: {
      getItem: (key: string) => storage[key] ?? null,
    },
    location,
    navigator: { onLine: options.online !== false },
    document: {},
    addEventListener: (name: string, fn: () => void) => {
      listeners[name] = listeners[name] || [];
      listeners[name].push(fn);
    },
  };
  const context = vm.createContext(sandbox);
  (context as { window?: unknown }).window = context;
  vm.runInContext(source, context);
  return {
    location,
    goOnline() {
      sandbox.navigator.onLine = true;
      (listeners.online || []).forEach((fn) => fn());
    },
  };
}

describe('stale tech-offline page', () => {
  it('sends the platform owner home once the device is online', () => {
    expect(boot({ role: 'superadmin' }).location.replaced).toBe('/admin/home');
    expect(boot({ role: 'admin' }).location.replaced).toBe('/admin/home');
    expect(boot({ tokenRole: 'superadmin', role: 'shop' }).location.replaced).toBe('/admin/home');
  });

  it('stays on the workspace while offline, then leaves when service returns', () => {
    const page = boot({ role: 'superadmin', online: false });
    expect(page.location.replaced).toBe('');
    page.goOnline();
    expect(page.location.replaced).toBe('/admin/home');
  });

  it('does not move shop, tech, customer, or a platform page', () => {
    expect(boot({ role: 'shop' }).location.replaced).toBe('');
    expect(boot({ role: 'tech' }).location.replaced).toBe('');
    expect(boot({ role: 'manager' }).location.replaced).toBe('');
    expect(boot({ role: 'customer' }).location.replaced).toBe('');
    expect(boot({ tokenRole: 'shop', role: 'admin' }).location.replaced).toBe('');
    expect(boot({ role: 'superadmin', path: '/admin/home' }).location.replaced).toBe('');
  });

  it('loads before the workspace and the service worker will not keep a stale copy in front', () => {
    expect(html.indexOf('platform-owner.js')).toBeLessThan(html.indexOf('app.js'));
    expect(sw).toContain("redirect: 'manual'");
    expect(sw).toContain('releaseStaleOfflineClients');
    expect(sw).toContain('client.navigate(client.url)');
    expect(sw).toContain('fixtray-v8');
    expect(sw).toContain("request.mode === 'navigate'");
    expect(sw).toContain('injectPlatformOwnerEscape');
    expect(sw).toContain("charAt(0) === '<'");
    expect(sw).toContain('precacheUrl');
    const navigateFirst = sw.indexOf('networkOfflineNavigation(request)');
    const assetCache = sw.indexOf('caches.match(request)');
    expect(navigateFirst).toBeGreaterThan(0);
    expect(navigateFirst).toBeLessThan(assetCache);
  });
});
