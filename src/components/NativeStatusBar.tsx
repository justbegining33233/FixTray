'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

/** Dark status bar matching the native shell. No-ops in a normal browser. */
export default function NativeStatusBar() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    (async () => {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        if (cancelled) return;
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#020608' });
        await StatusBar.setOverlaysWebView({ overlay: false });
      } catch {
        // Status bar plugin is unavailable outside the native shell.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
