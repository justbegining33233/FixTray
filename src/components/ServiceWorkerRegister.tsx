'use client';

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'fixtrayInstallDismissed';

export default function ServiceWorkerRegister() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // In development, remove existing service workers/caches to avoid stale chunks.
      if (process.env.NODE_ENV !== 'production') {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => {
            registration.unregister();
          });
        });

        if ('caches' in window) {
          caches.keys().then((keys) => {
            keys.forEach((key) => {
              caches.delete(key);
            });
          });
        }
      } else {
        navigator.serviceWorker
          .register('/sw.js', { updateViaCache: 'none' })
          .catch(() => {});

        let reloading = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!reloading) {
            reloading = true;
            window.location.reload();
          }
        });
      }
    }

    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const native = Capacitor.isNativePlatform();
    const dismissed = sessionStorage.getItem(DISMISS_KEY) === '1';

    const onPrompt = (event: Event) => {
      if (native || standalone || dismissed) return;
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallEvent(null);

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('resize', setVH);
      window.removeEventListener('orientationchange', setVH);
    };
  }, []);

  if (!installEvent) return null;

  return (
    <div
      role="region"
      aria-label="Install FixTray"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'calc(88px + env(safe-area-inset-bottom))',
        zIndex: 80,
        background: '#020608',
        color: '#e5e7eb',
        border: '1px solid #e5332a',
        borderRadius: 12,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
      }}
    >
      <span style={{ flex: 1, fontWeight: 700 }}>Install FixTray</span>
      <button
        type="button"
        onClick={async () => {
          await installEvent.prompt();
          setInstallEvent(null);
        }}
        style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontWeight: 700, cursor: 'pointer' }}
      >
        Install
      </button>
      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, '1');
          setInstallEvent(null);
        }}
        style={{ background: 'transparent', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}
      >
        Not now
      </button>
    </div>
  );
}
