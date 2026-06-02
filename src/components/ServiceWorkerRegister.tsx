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
      // Register service worker
      navigator.serviceWorker
        .register('/sw.js')
        .then((_registration) => {
        })
        .catch((_error) => {
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
