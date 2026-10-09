'use client';

import { useEffect, useState } from 'react';

/** Loads the offline engine for every signed-in role and prefetches the open job. */
export default function TechOfflineBridge() {
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
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
      const engine = window.FixTrayOffline;
      if (!engine?.downloadJob) {
        setNotice({ ok: false, message: 'Offline download is not ready on this device yet.' });
        return;
      }
      Promise.resolve(engine.downloadJob(detail.workOrderId))
        .then(() => setNotice({ ok: true, message: 'This job was saved for offline use.' }))
        .catch(() => setNotice({ ok: false, message: 'This job was not saved for offline use.' }));
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

  if (!notice) return null;
  return (
    <div role="status" style={{ position: 'fixed', bottom: 16, left: 16, right: 16, zIndex: 80, maxWidth: 420, margin: '0 auto', background: notice.ok ? '#12301c' : '#3b1214', border: `1px solid ${notice.ok ? '#86efac' : '#fca5a5'}`, color: notice.ok ? '#bbf7d0' : '#fecaca', borderRadius: 12, padding: 12, fontWeight: 700 }}>
      {notice.message}
      <button type="button" onClick={() => setNotice(null)} style={{ marginLeft: 12, background: 'transparent', color: 'inherit', border: 'none', fontWeight: 700, cursor: 'pointer' }}>Dismiss</button>
    </div>
  );
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
