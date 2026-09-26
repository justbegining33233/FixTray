import { clearDesktopViewMode, resolveIsMobile } from '../src/hooks/useIsMobile';
import { appDesktopViewResetScript } from '../src/lib/nativeIntro';
import { nativePlatformFromRequest } from '../src/proxy';
import { NextRequest } from 'next/server';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem(key: string) { return data[key] ?? null; },
    removeItem(key: string) { delete data[key]; },
  };
}

describe('app view mode', () => {
  it('keeps the phone shell in the app even when desktop was stored', () => {
    expect(resolveIsMobile({
      app: true,
      serverMobile: true,
      stored: 'desktop',
      viewportWidth: 1280,
    })).toBe(true);
    expect(resolveIsMobile({
      app: false,
      serverMobile: true,
      stored: 'desktop',
      viewportWidth: 390,
    })).toBe(false);
    expect(resolveIsMobile({
      app: false,
      serverMobile: false,
      stored: 'mobile',
      viewportWidth: 1400,
    })).toBe(true);
    expect(resolveIsMobile({
      app: false,
      serverMobile: true,
      stored: null,
      viewportWidth: null,
    })).toBe(true);
  });

  it('removes only a stored desktop preference', () => {
    const desktop = memoryStorage({ viewMode: 'desktop' });
    clearDesktopViewMode(desktop);
    expect(desktop.data.viewMode).toBeUndefined();
    const mobile = memoryStorage({ viewMode: 'mobile' });
    clearDesktopViewMode(mobile);
    expect(mobile.data.viewMode).toBe('mobile');
  });

  it('resets the preference before paint inside the app', () => {
    const script = appDesktopViewResetScript();
    expect(script).toContain('FixTray-Android-App');
    expect(script).toContain("getItem('viewMode')==='desktop'");
    expect(script).toContain('removeItem');
  });

  it('marks any FixTray app user agent as the native shell', () => {
    const android = new NextRequest('http://localhost:3000/shop/home', {
      headers: { 'user-agent': 'FixTray-Android-App' },
    });
    const pro = new NextRequest('http://localhost:3000/shop/home', {
      headers: { 'user-agent': 'FixTray-Android-App-Pro' },
    });
    expect(nativePlatformFromRequest(android)).toBe('android');
    expect(nativePlatformFromRequest(pro)).toBe('android');
  });
});
