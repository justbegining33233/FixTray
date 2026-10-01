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

  if (!installEvent) return null;

  return (
    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <h3 style={{ color: '#e5e7eb', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{say('Install FixTray')}</h3>
      <p style={{ color: '#9aa3b2', fontSize: 14, marginBottom: 12 }}>{say('Add FixTray to this device from settings.')}</p>
      <button
        type="button"
        onClick={async () => {
          await installEvent.prompt();
          (window as Window & { __fixtrayInstallPrompt?: BeforeInstallPromptEvent | null }).__fixtrayInstallPrompt = null;
          setInstallEvent(null);
        }}
        style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontWeight: 700, cursor: 'pointer' }}
      >
        {say('Install')}
      </button>
    </div>
  );
}
