'use client';

import { useEffect, useState } from 'react';
import { usePhrase } from '@/lib/usePhrase';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function MemberInstallPrompt() {
  const say = usePhrase();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const read = () => {
      const current = (window as Window & { __fixtrayInstallPrompt?: BeforeInstallPromptEvent | null }).__fixtrayInstallPrompt;
      setInstallEvent(current ?? null);
    };
    read();
    window.addEventListener('fixtray-install-available', read);
    window.addEventListener('appinstalled', read);
    return () => {
      window.removeEventListener('fixtray-install-available', read);
      window.removeEventListener('appinstalled', read);
    };
  }, []);

  return (
    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <h3 style={{ color: '#e5e7eb', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{say('Install FixTray')}</h3>
      <p style={{ color: '#9aa3b2', fontSize: 14, marginBottom: 12 }}>
        {installEvent
          ? say('Add FixTray to this device from settings.')
          : say('This browser did not offer an install prompt. On iPhone or iPad, open Share and choose Add to Home Screen. On desktop Chrome, use the install icon in the address bar.')}
      </p>
      <button
        type="button"
        onClick={async () => {
          if (!installEvent) return;
          await installEvent.prompt();
          (window as Window & { __fixtrayInstallPrompt?: BeforeInstallPromptEvent | null }).__fixtrayInstallPrompt = null;
          setInstallEvent(null);
        }}
        disabled={!installEvent}
        style={{ background: installEvent ? '#e5332a' : '#1f2937', color: installEvent ? '#fff' : '#9ca3af', border: 'none', borderRadius: 8, padding: '8px 12px', fontWeight: 700, cursor: installEvent ? 'pointer' : 'not-allowed' }}
      >
        {say('Install')}
      </button>
    </div>
  );
}
