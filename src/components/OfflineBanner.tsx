'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useState, useEffect } from 'react';

type OfflineDetail = {
  offline?: boolean;
  pending?: number;
  conflicts?: number;
  syncing?: boolean;
  needsReauth?: boolean;
  label?: string;
};

export default function OfflineBanner() {
  const say = usePhrase();
  const [offline, setOffline] = useState(false);
  const [detail, setDetail] = useState<OfflineDetail>({});

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    const onStatus = (event: Event) => {
      setDetail((event as CustomEvent<OfflineDetail>).detail || {});
    };
    setOffline(!navigator.onLine);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    window.addEventListener('fixtray-offline-status', onStatus);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('fixtray-offline-status', onStatus);
    };
  }, []);

  const pending = detail.pending || 0;
  const techOffline = pending > 0 || !!detail.syncing || !!detail.needsReauth || (detail.conflicts || 0) > 0;
  if (!offline && !techOffline) return null;

  const syncNow = () => {
    const engine = (window as Window & { FixTrayOffline?: { syncNow?: () => void } }).FixTrayOffline;
    engine?.syncNow?.();
  };

  let message = say('You are offline. Some features may be unavailable.');
  if (detail.needsReauth) message = say('Sign in to finish syncing. Your offline work is saved.');
  else if (detail.syncing) message = say('Syncing…');
  else if (offline && pending) message = say('You are offline.') + ' ' + pending + ' ' + say('pending upload.');
  else if (pending) message = pending + ' ' + say('pending upload.');
  else if ((detail.conflicts || 0) > 0) message = say('Some offline items need review. Nothing was discarded.');
  else if (!offline && detail.label === 'All synced') message = say('All synced');

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10000,
      background: detail.needsReauth ? '#450a0a' : '#f59e0b',
      color: detail.needsReauth ? '#fecaca' : '#000',
      textAlign: 'center',
      padding: '6px 12px',
      fontSize: 13,
      fontWeight: 600,
      display: 'flex',
      gap: 8,
      justifyContent: 'center',
      alignItems: 'center',
      flexWrap: 'wrap',
    }}>
      <span>{message}</span>
      {offline && <span>{say('Payments and sending estimates need a connection.')}</span>}
      {techOffline && (
        <button type="button" onClick={syncNow} style={{ border: 0, borderRadius: 8, padding: '4px 8px', fontWeight: 700, cursor: 'pointer' }}>
          {say('Sync now')}
        </button>
      )}
      {(offline || techOffline) && (
        <a href="/tech-offline/" style={{ color: 'inherit', fontWeight: 700 }}>{say('Offline jobs')}</a>
      )}
    </div>
  );
}
