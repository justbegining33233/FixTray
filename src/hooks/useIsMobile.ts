'use client';
import { useState, useEffect } from 'react';
import { useIsMobileUA } from '@/context/NativeContext';

export type ViewMode = 'auto' | 'mobile' | 'desktop';

/** Persist a user's explicit view-mode choice and reload to apply it. */
export function setViewMode(mode: ViewMode) {
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
 * Returns whether the current viewport should render the mobile shell.
 *
 * Priority:
 *  1. Explicit user preference stored in localStorage ('mobile' | 'desktop')
 *  2. Server UA (initial paint — avoids flash)
 *  3. Client viewport width < 768 px after mount
 *
 * Also responds to window resize when no preference is set.
 * Native app wrapper (Capacitor) always treated as mobile regardless of pref.
 */
export function useIsMobile(): boolean {
  const fromServerUA = useIsMobileUA();
  const [isMobile, setIsMobile] = useState(fromServerUA);

  useEffect(() => {
    const stored = localStorage.getItem('viewMode');
    if (stored === 'desktop') { setIsMobile(false); return; }
    if (stored === 'mobile')  { setIsMobile(true);  return; }
    // No preference → use viewport width, respond to resize
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}
