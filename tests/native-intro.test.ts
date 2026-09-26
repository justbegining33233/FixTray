import fs from 'fs';
import path from 'path';
import { introHandoffPath, isAppWebView, readIntroSession } from '../src/lib/nativeIntro';

const ROOT = process.cwd();

describe('native intro handoff', () => {
  const now = Date.parse('2026-09-25T00:00:00Z');

  it('sends each valid role to its dashboard', () => {
    expect(introHandoffPath({ role: 'admin', shopProfileComplete: false }, now)).toBe('/admin/home');
    expect(introHandoffPath({ role: 'superadmin', shopProfileComplete: false }, now)).toBe('/admin/home');
    expect(introHandoffPath({ role: 'manager', shopProfileComplete: false }, now)).toBe('/manager/home');
    expect(introHandoffPath({ role: 'tech', shopProfileComplete: false }, now)).toBe('/tech/home');
    expect(introHandoffPath({ role: 'customer', shopProfileComplete: false }, now)).toBe('/customer/dashboard');
  });

  it('sends a shop with a finished profile home, and an unfinished shop to profile setup', () => {
    expect(introHandoffPath({ role: 'shop', shopProfileComplete: true }, now)).toBe('/shop/home');
    expect(introHandoffPath({ role: 'shop', shopProfileComplete: false }, now)).toBe('/shop/complete-profile');
  });

  it('stays on login when the session is missing, expired, or unknown', () => {
    expect(introHandoffPath(null, now)).toBeNull();
    expect(introHandoffPath({ role: '', shopProfileComplete: false }, now)).toBeNull();
    expect(introHandoffPath({ role: 'vendor', shopProfileComplete: false }, now)).toBeNull();
    expect(introHandoffPath({
      role: 'tech',
      exp: Math.floor(now / 1000) - 5,
      shopProfileComplete: false,
    }, now)).toBeNull();
  });

  it('reads a stored token and ignores a missing one', () => {
    const storage = {
      token: 'abc',
      userRole: 'customer',
      shopProfileComplete: null as string | null,
      getItem(key: string) {
        if (key === 'token') return this.token;
        if (key === 'userRole') return this.userRole;
        if (key === 'shopProfileComplete') return this.shopProfileComplete;
        return null;
      },
    };
    expect(readIntroSession(storage, () => ({ role: 'tech', exp: Math.floor(now / 1000) + 60 }))).toEqual({
      role: 'tech',
      exp: Math.floor(now / 1000) + 60,
      shopProfileComplete: false,
    });
    storage.token = '';
    expect(readIntroSession(storage, () => ({ role: 'tech' }))).toBeNull();
    storage.token = 'abc';
    expect(readIntroSession(storage, () => null)).toBeNull();
  });
});

describe('bundled intro stays off the website', () => {
  const config = fs.readFileSync(path.join(ROOT, 'capacitor.config.ts'), 'utf8');
  const login = fs.readFileSync(path.join(ROOT, 'src/components/LoginClient.tsx'), 'utf8');

  it('ships the video in the native projects and not as a public website file', () => {
    expect(fs.existsSync(path.join(ROOT, 'android/app/src/main/res/raw/intro.mp4'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'ios/App/App/intro.mp4'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'public/intro.mp4'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'capacitor-fallback/intro.mp4'))).toBe(false);
    expect(fs.readFileSync(path.join(ROOT, 'capacitor-fallback/index.html'), 'utf8')).not.toContain('intro.mp4');
  });

  it('opens the live site with a native-only session handoff', () => {
    expect(config).toContain("url: 'https://fixtray.app/auth/login?from=intro'");
    expect(login).toContain('Capacitor.isNativePlatform()');
    expect(login).toContain('introHandoffPath');
  });
});

describe('app webview shell', () => {
  it('keeps the phone shell for the app user-agent and native cookie only', () => {
    expect(isAppWebView({ userAgent: 'FixTray-Android-App-Pro' })).toBe(true);
    expect(isAppWebView({ userAgent: 'FixTray-iOS-App-Pro' })).toBe(true);
    expect(isAppWebView({ cookie: 'x-fixtray-native=android' })).toBe(true);
    expect(isAppWebView({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile' })).toBe(false);
    expect(isAppWebView({ userAgent: 'Mozilla/5.0 Chrome' })).toBe(false);
  });
});
