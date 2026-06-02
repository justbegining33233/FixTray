'use client';

import { FaSatelliteDish } from 'react-icons/fa';

export default function OfflinePage() {
  return (
    <div style={{
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
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}><FaSatelliteDish style={{marginRight:4}} /></div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>You&apos;re Offline</h1>
      <p style={{ fontSize: 14, color: '#94a3b8', maxWidth: 320, marginBottom: 24 }}>
        It looks like you&apos;ve lost your internet connection. Some features may be unavailable until you reconnect.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="btn-primary"
        style={{
          padding: '12px 24px',
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        Try Again
      </button>
    </div>
  );
}
