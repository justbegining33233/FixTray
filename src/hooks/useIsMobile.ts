'use client';
import { useState, useEffect } from 'react';
import { useIsMobileUA } from '@/context/NativeContext';
import { isAppWebViewClient } from '@/lib/nativeIntro';

export type ViewMode = 'auto' | 'mobile' | 'desktop';

export type MobileShellInput = {
  /** Capacitor app (user agent or native cookie). Always the phone shell. */
  app: boolean;
  /** Server already chose the phone shell (native header or mobile UA). */
  serverMobile: boolean;
  stored: string | null;
  /** Null before the viewport is measured. */
  viewportWidth: number | null;
};

/**
 * Phone shell decision.
 * The installed app ignores a stored desktop preference so a "Web view" tap
 * cannot lock the APK into the computer layout.
 * A stored desktop preference still wins in a normal browser.
 */
export function resolveIsMobile(input: MobileShellInput): boolean {
  if (input.app) return true;
  if (input.stored === 'desktop') return false;
  if (input.stored === 'mobile') return true;
  if (input.viewportWidth != null) return input.viewportWidth < 768;
  return input.serverMobile;
}

/** The app must not keep a desktop preference that would hide the phone shell. */
export function clearDesktopViewMode(storage: { getItem(key: string): string | null; removeItem(key: string): void }) {
  if (storage.getItem('viewMode') === 'desktop') storage.removeItem('viewMode');
}

/** Persist a user's explicit view-mode choice and reload to apply it. */
export function setViewMode(mode: ViewMode) {
  if (isAppWebViewClient()) {
    clearDesktopViewMode(localStorage);
    return;
  }
  if (mode === 'auto') {
    localStorage.removeItem('viewMode');
  } else {
    localStorage.setItem('viewMode', mode);
  }
  window.location.reload();
}

/** Read the stored preference without triggering a reload. */
export function getStoredViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'auto';
  const v = localStorage.getItem('viewMode');
  if (v === 'mobile' || v === 'desktop') return v;
  return 'auto';
}

/**
 * Phone shell for the current screen.
 * The app always wins, including over a stored desktop preference.
 * In a browser, a stored preference wins, then the server UA, then the viewport.
 */
export function useIsMobile(): boolean {
  const fromServerUA = useIsMobileUA();
  const [isMobile, setIsMobile] = useState(() => resolveIsMobile({
    app: false,
    serverMobile: fromServerUA,
    stored: null,
    viewportWidth: null,
  }));

  useEffect(() => {
    const app = isAppWebViewClient();
    if (app) clearDesktopViewMode(localStorage);
    const apply = () => setIsMobile(resolveIsMobile({
      app,
      serverMobile: fromServerUA,
      stored: app ? null : localStorage.getItem('viewMode'),
      viewportWidth: app || localStorage.getItem('viewMode') ? null : window.innerWidth,
    }));
    apply();
    if (app || localStorage.getItem('viewMode')) return;
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [fromServerUA]);

  return isMobile;
}
