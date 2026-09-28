'use client';

import { useEffect } from 'react';
import { useIsNative } from '@/context/NativeContext';
import { isAppWebViewClient } from '@/lib/nativeIntro';
import { ROLE_HOME } from '@/lib/roleConfig';

const HOME_PATHS = new Set([
  '/',
  '/auth/login',
  '/admin/home',
  '/shop/home',
  '/shop/admin',
  '/manager/home',
  '/tech/home',
  '/customer/dashboard',
]);

function roleHome(): string {
  const role = localStorage.getItem('userRole') || '';
  return ROLE_HOME[role] || '/auth/login';
}

function pathOf(url: string): string {
  try {
    return new URL(url, window.location.href).pathname.replace(/\/+$/, '') || '/';
  } catch {
    return '/';
  }
}

export type HardwareBackAction = 'close' | 'exit' | 'back' | 'home';

/** What the Android back key should do. Exit only from a home or the login screen. */
export function hardwareBackAction(input: {
  overlayOpen: boolean;
  path: string;
  home: string;
  historyLength: number;
}): HardwareBackAction {
  if (input.overlayOpen) return 'close';
  const path = input.path.replace(/\/+$/, '') || '/';
  const home = input.home.replace(/\/+$/, '') || '/';
  if (HOME_PATHS.has(path) || path === home) return 'exit';
  if (input.historyLength > 1) return 'back';
  return 'home';
}

/**
 * Android hardware back. Returns "handled" when this page closed an overlay
 * or moved somewhere inside the app, and "exit" only from a role home or login
 * so a deep screen with an empty history stack does not leave the app.
 */
export function fixtrayHardwareBack(): 'handled' | 'exit' {
  const more = document.querySelector('[data-role-more="open"]');
  const tour = document.querySelector('[data-onboarding-tour]');
  const drawer = document.querySelector('[data-mobile-drawer="open"]');
  const action = hardwareBackAction({
    overlayOpen: Boolean(more || tour || drawer),
    path: pathOf(window.location.href),
    home: roleHome(),
    historyLength: window.history.length,
  });
  if (action === 'close') {
    window.dispatchEvent(new CustomEvent('fixtray-close-overlays'));
    return 'handled';
  }
  if (action === 'exit') return 'exit';
  if (action === 'back') {
    window.history.back();
    return 'handled';
  }
  window.location.assign(roleHome());
  return 'handled';
}

function inApp(native: boolean): boolean {
  return native || isAppWebViewClient();
}

/**
 * Keeps the Capacitor app on one history stack: hardware back, and links that
 * would otherwise open a browser tab the app cannot return from.
 */
export default function AppNavigationGuard({ nativeHint = false }: { nativeHint?: boolean }) {
  const native = useIsNative() || nativeHint;

  useEffect(() => {
    const w = window as Window & { fixtrayHardwareBack?: typeof fixtrayHardwareBack };
    w.fixtrayHardwareBack = fixtrayHardwareBack;
    return () => {
      if (w.fixtrayHardwareBack === fixtrayHardwareBack) delete w.fixtrayHardwareBack;
    };
  }, []);

  useEffect(() => {
    if (!inApp(native)) return;

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
      const blank = anchor.target === '_blank';
      let url: URL;
      try { url = new URL(href, window.location.href); } catch { return; }
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
      if (!blank && url.origin === window.location.origin) return;
      event.preventDefault();
      window.location.assign(url.href);
    };

    const originalOpen = window.open.bind(window);
    window.open = (url?: string | URL, target?: string, features?: string) => {
      const value = url == null ? '' : String(url);
      if (!value || value === 'about:blank') return originalOpen(url as string, target, features);
      try {
        const next = new URL(value, window.location.href);
        if (next.protocol === 'http:' || next.protocol === 'https:') {
          window.location.assign(next.href);
          return null;
        }
      } catch {
        // Fall through to the real window.open.
      }
      return originalOpen(url as string, target, features);
    };

    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.open = originalOpen;
    };
  }, [native]);

  return null;
}
