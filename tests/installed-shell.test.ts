import fs from 'fs';
import path from 'path';
import vm from 'vm';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { installedShellEntryRedirect, proxy } from '../src/proxy';
import {
  decodeIntroClaims,
  installedShellBootstrapScript,
  installedShellLaunchPath,
  isInstalledShellClient,
} from '../src/lib/nativeIntro';

const SECRET = 'installed-shell-test-secret';
const ROOT = process.cwd();

function request(pathname: string, init?: { ua?: string; cookie?: string }) {
  const headers = new Headers();
  if (init?.ua) headers.set('user-agent', init.ua);
  if (init?.cookie) headers.set('cookie', init.cookie);
  return new NextRequest(`http://localhost:3000${pathname}`, { headers });
}

function sign(role: string, expiresIn: number | string = '1h') {
  return jwt.sign({ id: 'user-1', role }, SECRET, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
}

describe('installed shell entry redirect', () => {
  const previous = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = SECRET;
  });

  afterAll(() => {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  });

  it('leaves a normal browser on the marketing page', async () => {
    const res = await installedShellEntryRedirect(request('/', { ua: 'Mozilla/5.0 Chrome' }));
    expect(res).toBeNull();
    const passed = await proxy(request('/', { ua: 'Mozilla/5.0 Chrome' }));
    expect(passed.status).toBe(200);
    expect(passed.headers.get('location')).toBeNull();
  });

  it('sends the Android app user-agent and native cookie to login', async () => {
    for (const init of [
      { ua: 'FixTray-Android-App-Pro' },
      { ua: 'Something FixTray-Android-App' },
      { cookie: 'x-fixtray-native=android' },
      { ua: 'FixTray-iOS-App-Pro' },
    ]) {
      const res = await installedShellEntryRedirect(request('/', init));
      expect(res?.status).toBe(307);
      expect(res?.headers.get('location')).toBe('http://localhost:3000/auth/login');
    }
    const viaProxy = await proxy(request('/', { ua: 'FixTray-Android-App-Pro', cookie: 'x-fixtray-native=android' }));
    expect(viaProxy.headers.get('location')).toBe('http://localhost:3000/auth/login');
  });

  it('sends a verified session to that role home', async () => {
    const tech = await installedShellEntryRedirect(request('/', {
      ua: 'FixTray-Android-App-Pro',
      cookie: `x-fixtray-native=android; sos_auth=${sign('tech')}`,
    }));
    expect(tech?.headers.get('location')).toBe('http://localhost:3000/tech/home');

    const shop = await installedShellEntryRedirect(request('/', {
      cookie: `x-fixtray-native=android; sos_auth=${sign('shop')}`,
    }));
    expect(shop?.headers.get('location')).toBe('http://localhost:3000/shop/admin');

    const expired = await installedShellEntryRedirect(request('/', {
      ua: 'FixTray-Android-App-Pro',
      cookie: `sos_auth=${sign('customer', -10)}`,
    }));
    expect(expired?.headers.get('location')).toBe('http://localhost:3000/auth/login');
  });

  it('does not redirect other paths or add the intro flag', async () => {
    const login = await installedShellEntryRedirect(request('/auth/login', { ua: 'FixTray-Android-App-Pro' }));
    expect(login).toBeNull();
    const res = await installedShellEntryRedirect(request('/', { ua: 'FixTray-Android-App-Pro' }));
    expect(res?.headers.get('location')).not.toContain('from=intro');
  });

  it('matches the marketing page in the live proxy config', () => {
    const source = fs.readFileSync(path.join(ROOT, 'src/proxy.ts'), 'utf8');
    expect(source).toMatch(/matcher:\s*\[[^\]]*'\s*\/\s*'/s);
  });
});

describe('installed shell client launch', () => {
  it('detects the app and an installed icon, and ignores a browser tab', () => {
    expect(isInstalledShellClient({ userAgent: 'Mozilla/5.0' })).toBe(false);
    expect(isInstalledShellClient({ userAgent: 'FixTray-Android-App-Pro' })).toBe(true);
    expect(isInstalledShellClient({ cookie: 'theme=dark; x-fixtray-native=android' })).toBe(true);
    expect(isInstalledShellClient({ capacitorNative: true })).toBe(true);
    expect(isInstalledShellClient({ displayModeStandalone: true })).toBe(true);
    expect(isInstalledShellClient({ navigatorStandalone: true })).toBe(true);
  });

  it('reuses the intro handoff map and falls back to login', () => {
    expect(installedShellLaunchPath(null)).toBe('/auth/login');
    expect(installedShellLaunchPath({ role: 'manager', shopProfileComplete: false })).toBe('/manager/home');
    expect(installedShellLaunchPath({ role: 'shop', shopProfileComplete: true })).toBe('/shop/home');
    expect(installedShellLaunchPath({ role: 'shop', shopProfileComplete: false })).toBe('/shop/complete-profile');
  });

  it('bootstrap leaves browsers alone, sends standalone to login, and continues a session', () => {
    const script = installedShellBootstrapScript();
    expect(script).not.toContain('from=intro');
    expect(script).not.toContain('intro.mp4');

    const run = (setup: (box: Record<string, unknown>) => void) => {
      const location = { pathname: '/', replace(url: string) { this.pathname = url; } };
      const box: Record<string, unknown> = {
        location,
        navigator: { userAgent: 'Mozilla/5.0', standalone: false },
        document: { cookie: '' },
        localStorage: { getItem: () => null },
        matchMedia: () => ({ matches: false }),
        Capacitor: undefined,
        atob: (value: string) => Buffer.from(value, 'base64').toString('utf8'),
        Date,
      };
      box.window = box;
      setup(box);
      vm.runInNewContext(script, box);
      return location.pathname;
    };

    expect(run(() => undefined)).toBe('/');
    expect(run((box) => {
      (box.matchMedia as () => { matches: boolean }) = () => ({ matches: true });
    })).toBe('/auth/login');
    expect(run((box) => {
      box.navigator = { userAgent: 'FixTray-Android-App-Pro', standalone: false };
      const token = jwt.sign({ role: 'customer', exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET);
      box.localStorage = { getItem: (key: string) => (key === 'token' ? token : null) };
    })).toBe('/customer/dashboard');
  });

  it('decodes a token payload without verifying it', () => {
    const token = sign('tech');
    expect(decodeIntroClaims(token)?.role).toBe('tech');
    expect(decodeIntroClaims('not-a-token')).toBeNull();
  });

  it('keeps the installed start url on login and the intro off the website', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/manifest.json'), 'utf8'));
    expect(manifest.start_url).toBe('/auth/login');
    const page = fs.readFileSync(path.join(ROOT, 'src/app/page.tsx'), 'utf8');
    const layout = fs.readFileSync(path.join(ROOT, 'src/app/layout.tsx'), 'utf8');
    expect(page).toContain('installedShellBootstrapScript');
    expect(page).toContain('window.location.replace');
    expect(layout).toContain('installedShellBootstrapScript');
    expect(page).not.toContain('intro.mp4');
    expect(layout).not.toContain('intro.mp4');
  });
});
