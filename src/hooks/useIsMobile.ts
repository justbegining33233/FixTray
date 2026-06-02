'use client';
import { useState, useEffect } from 'react';
import { useIsMobileUA } from '@/context/NativeContext';

/**
 * Returns whether the current device is mobile.
 *
 * Relies exclusively on User-Agent — intentionally ignoring viewport width.
 * This means the browser's built-in "Request Desktop Site" / "Request Mobile
 * Site" toggle works correctly: when the user picks desktop mode the browser
 * sends a desktop UA, the server detects it as non-mobile, and this hook
 * returns false even though the physical screen is still narrow.
 *
 * PRIMARY:  server-detected UA (NativeContext, set in layout.tsx).
 * FALLBACK: client-side navigator.userAgent check, in case the server value
 *           is unavailable (e.g. during static generation).
 */
export function useIsMobile(): boolean {
  const fromServer = useIsMobileUA();

  const [fromClient, setFromClient] = useState(fromServer);

  useEffect(() => {
    const mobileUA = /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    setFromClient(mobileUA);
  }, []);

  return fromServer || fromClient;
}
