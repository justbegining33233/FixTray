'use client';

import { useEffect } from 'react';

/** Loads the offline engine for every signed-in role and prefetches the open job. */
export default function TechOfflineBridge() {
  useEffect(() => {
    const boot = () => {
      const role = localStorage.getItem('userRole');
      if (!role) return;
      const engine = window.FixTrayOffline;
      engine?.startBridge();
      const match = window.location.pathname.match(/^\/workorders\/([^/]+)/);
      if (match?.[1]) engine?.downloadJob?.(decodeURIComponent(match[1]));
    };

    const onPrep = (event: Event) => {
      const detail = (event as CustomEvent<{ workOrderId?: string; status?: string; baseStatus?: string }>).detail || {};
      if (!detail.workOrderId) return;
      window.FixTrayOffline?.downloadJob?.(detail.workOrderId);
      if (detail.status === 'en-route') {
        window.FixTrayOffline?.setStatus?.(detail.workOrderId, detail.baseStatus || 'assigned', 'en-route');
      }
    };

    if (!document.querySelector('script[data-tech-offline]')) {
      const script = document.createElement('script');
      script.src = '/tech-offline/engine.js';
      script.async = true;
      script.dataset.techOffline = '1';
      script.onload = boot;
      document.body.appendChild(script);
    } else {
      boot();
    }
    window.addEventListener('fixtray-prep-download', onPrep);
    return () => window.removeEventListener('fixtray-prep-download', onPrep);
  }, []);

  return null;
}

declare global {
  interface Window {
    FixTrayOffline?: {
      startBridge: () => void;
      syncNow?: () => void;
      clearSynced?: () => Promise<void>;
      downloadJob?: (workOrderId: string) => Promise<unknown>;
      setStatus?: (workOrderId: string, baseStatus: string, status: string) => Promise<unknown>;
      logoutCheck?: () => Promise<{ pending: number; message: string }>;
    };
  }
}
