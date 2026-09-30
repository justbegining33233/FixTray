'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { ROLE_HOME } from '@/lib/roleConfig';

function subscribeOnline(onStoreChange: () => void) {
  window.addEventListener('online', onStoreChange);
  window.addEventListener('offline', onStoreChange);
  return () => {
    window.removeEventListener('online', onStoreChange);
    window.removeEventListener('offline', onStoreChange);
  };
}

/** True while the browser reports a network. Server renders assume online. */
export function useNetworkOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

/**
 * Offline screen for this role only. The heading is a real apostrophe.
 * The home link is that role's own home, never another role's page.
 */
export default function OfflineNotice() {
  const [home, setHome] = useState('#');

  useEffect(() => {
    let role = '';
    try { role = localStorage.getItem('userRole') || ''; } catch { role = ''; }
    setHome(ROLE_HOME[role] || '/auth/login');
  }, []);

  return (
    <div
      data-offline-screen="1"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000000',
        color: '#f1f5f9',
        fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
        padding: 'calc(24px + env(safe-area-inset-top, 0px)) 24px calc(24px + env(safe-area-inset-bottom, 0px))',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{"You're Offline"}</h1>
      <p style={{ fontSize: 14, color: '#94a3b8', maxWidth: 360, marginBottom: 16 }}>
        {"It looks like you've lost your internet connection. Some features may be unavailable until you reconnect."}
      </p>
      <p style={{ fontSize: 14, color: '#94a3b8', maxWidth: 360, marginBottom: 24 }}>
        Payments, approvals, estimates, and pay changes need a connection.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          padding: '12px 24px',
          fontSize: 14,
          fontWeight: 700,
          background: '#e5332a',
          color: '#fff',
          border: 0,
          borderRadius: 12,
          cursor: 'pointer',
        }}
      >
        Try Again
      </button>
      <a href={home} style={{ marginTop: 16, color: '#e5332a', fontWeight: 700, textDecoration: 'none' }}>
        Go to your home
      </a>
    </div>
  );
}
