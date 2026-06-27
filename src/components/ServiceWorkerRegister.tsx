'use client';

import { useEffect } from 'react';

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
        // updateViaCache:'none' forces the browser to always fetch the latest sw.js
        // from the network, bypassing HTTP cache, so every new deployment is picked
        // up immediately without a hard refresh.
        navigator.serviceWorker
          .register('/sw.js', { updateViaCache: 'none' })
          .catch(() => {});

        // When a new service worker takes control (skipWaiting + clients.claim),
        // reload automatically so clients get the latest HTML/JS without ever
        // needing Ctrl+Shift+R.
        let reloading = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!reloading) {
            reloading = true;
            window.location.reload();
          }
        });
      }

      // Request notification permission for mobile
      if (process.env.NODE_ENV === 'production' && 'Notification' in window && 'serviceWorker' in navigator) {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
          }
        });
      }
    }

    // Handle PWA install prompt
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let deferredPrompt: any;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;

      // Show install button or banner
    });

    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
    });

    // Handle mobile viewport height issues
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);

    return () => {
      window.removeEventListener('resize', setVH);
      window.removeEventListener('orientationchange', setVH);
    };
  }, []);

  return null;
}
