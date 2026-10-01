'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function ServiceWorkerRegister() {
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

    const onPrompt = (event: Event) => {
      if (native || standalone) return;
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;
      (window as Window & { __fixtrayInstallPrompt?: BeforeInstallPromptEvent }).__fixtrayInstallPrompt = promptEvent;
      window.dispatchEvent(new Event('fixtray-install-available'));
    };
    const onInstalled = () => {
      (window as Window & { __fixtrayInstallPrompt?: BeforeInstallPromptEvent | null }).__fixtrayInstallPrompt = null;
    };

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

  return null;
}
