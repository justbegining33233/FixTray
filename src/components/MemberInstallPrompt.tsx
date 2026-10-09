'use client';

import { useEffect, useState } from 'react';
import { usePhrase } from '@/lib/usePhrase';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function alreadyInstalled(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

export default function MemberInstallPrompt() {
  const say = usePhrase();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const read = () => {
      const current = (window as Window & { __fixtrayInstallPrompt?: BeforeInstallPromptEvent | null }).__fixtrayInstallPrompt;
      setInstallEvent(current ?? null);
      if (alreadyInstalled()) setInstalled(true);
    };
    read();
    const onInstalled = () => {
      setInstalled(true);
      setNotice('FixTray was added to this device.');
    };
    window.addEventListener('fixtray-install-available', read);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('fixtray-install-available', read);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const status = installed
    ? 'already installed'
    : notice;

  return (
    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <h3 style={{ color: '#e5e7eb', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{say('Install FixTray')}</h3>
      <p style={{ color: '#9aa3b2', fontSize: 14, marginBottom: 12 }}>
        {installed
          ? 'already installed'
          : say('On iPhone or iPad, open Share and choose Add to Home Screen.')}
      </p>
      {status ? <div role="status" style={{ color: '#e5e7eb', fontSize: 14, marginBottom: 12 }}>{status}</div> : null}
      <button
        type="button"
        onClick={async () => {
          if (installed || alreadyInstalled()) {
            setInstalled(true);
            setNotice('already installed');
            return;
          }
          if (installEvent) {
            await installEvent.prompt();
            const choice = await installEvent.userChoice.catch(() => null);
            (window as Window & { __fixtrayInstallPrompt?: BeforeInstallPromptEvent | null }).__fixtrayInstallPrompt = null;
            setInstallEvent(null);
            if (choice?.outcome === 'accepted' || alreadyInstalled()) {
              setInstalled(true);
              setNotice('FixTray was added to this device.');
            }
            return;
          }
          setNotice('On iPhone or iPad, open Share and choose Add to Home Screen.');
        }}
        style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontWeight: 700, cursor: 'pointer' }}
      >
        {say('Install')}
      </button>
    </div>
  );
}
