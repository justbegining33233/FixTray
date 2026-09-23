'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useState, useEffect } from 'react';

export default function OfflineBanner() {
  const say = usePhrase();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    setOffline(!navigator.onLine);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10000,
      background: '#f59e0b',
      color: '#000',
      textAlign: 'center',
      padding: '6px 12px',
      fontSize: 13,
      fontWeight: 600,
    }}>
      {say("You are offline. Some features may be unavailable.")}{' '}</div>
  );
}
