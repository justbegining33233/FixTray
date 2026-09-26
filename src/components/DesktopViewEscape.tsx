'use client';

import { useEffect, useState } from 'react';
import { useIsNative } from '@/context/NativeContext';
import { setViewMode } from '@/hooks/useIsMobile';
import { isAppWebViewClient } from '@/lib/nativeIntro';
import { usePhrase } from '@/lib/usePhrase';

/**
 * Always-visible way out of a stored desktop preference.
 * The computer layout's user menu is easy to miss, and some pages have no top bar.
 * The installed app never shows this — it ignores the preference entirely.
 */
export default function DesktopViewEscape() {
  const say = usePhrase();
  const native = useIsNative();
  const [forcedDesktop, setForcedDesktop] = useState(false);

  useEffect(() => {
    if (native || isAppWebViewClient()) {
      setForcedDesktop(false);
      return;
    }
    setForcedDesktop(localStorage.getItem('viewMode') === 'desktop');
  }, [native]);

  if (!forcedDesktop) return null;

  return (
    <div
      data-desktop-view-escape="1"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        zIndex: 20000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 14,
        background: '#0b1220',
        color: '#e5e7eb',
        border: '1px solid rgba(147,197,253,0.45)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 650, lineHeight: 1.3 }}>{say('You are in the desktop layout.')}</span>
      <button
        type="button"
        onClick={() => setViewMode('mobile')}
        style={{
          flexShrink: 0,
          background: '#e5332a',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          padding: '10px 14px',
          fontWeight: 800,
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        {say('Switch to Mobile View')}
      </button>
    </div>
  );
}
