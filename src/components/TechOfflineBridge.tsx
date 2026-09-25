'use client';

import { useEffect } from 'react';

/** Loads the tech offline engine when a technician is signed in. */
export default function TechOfflineBridge() {
  useEffect(() => {
    const role = localStorage.getItem('userRole');
    if (role !== 'tech' && role !== 'manager') return;
    if (document.querySelector('script[data-tech-offline]')) {
      window.FixTrayOffline?.startBridge();
      return;
    }
    const script = document.createElement('script');
    script.src = '/tech-offline/engine.js';
    script.async = true;
    script.dataset.techOffline = '1';
    script.onload = () => window.FixTrayOffline?.startBridge();
    document.body.appendChild(script);
  }, []);

  return null;
}

declare global {
  interface Window {
    FixTrayOffline?: { startBridge: () => void; syncNow?: () => void; clearAll?: () => void };
  }
}
