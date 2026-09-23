'use client';

import { useEffect, useState } from 'react';
import { FaCreditCard } from 'react-icons/fa';
import {
  connectActionLabel,
  connectStatusDetail,
  stripeConnectControlAvailable,
  type ConnectReturnOrigin,
  type ShopConnectPublicStatus,
  type ShopConnectUiState,
} from '@/lib/stripeConnectOnboarding';

const BADGE: Record<ShopConnectUiState, { color: string; border: string; background: string }> = {
  ready: { color: '#86efac', border: '#22c55e', background: 'rgba(34,197,94,0.18)' },
  finish_onboarding: { color: '#fde68a', border: '#f59e0b', background: 'rgba(245,158,11,0.16)' },
  not_connected: { color: '#e5e7eb', border: '#9ca3af', background: 'rgba(156,163,175,0.16)' },
  platform_unconfigured: { color: '#fca5a5', border: '#ef4444', background: 'rgba(239,68,68,0.16)' },
};

export default function ShopStripeConnectCard({ origin }: { origin: ConnectReturnOrigin }) {
  const [status, setStatus] = useState<ShopConnectPublicStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [returnNotice, setReturnNotice] = useState('');

  const load = async (keepError = false) => {
    setLoading(true);
    if (!keepError) setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/stripe/connect/status', {
        cache: 'no-store',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(null);
        setError(typeof data.error === 'string' ? data.error : 'Could not load Stripe Connect.');
        return;
      }
      setStatus(data as ShopConnectPublicStatus);
    } catch {
      setStatus(null);
      setError('Could not load Stripe Connect.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const flag = new URLSearchParams(window.location.search).get('stripe_connect');
    if (flag === 'error') {
      setReturnNotice('Stripe sent you back before onboarding finished. Resume to keep going.');
    }
    load();
  }, []);

  const state: ShopConnectUiState = status?.state ?? 'not_connected';
  const platformConfigured = status?.platformConfigured === true;
  const canStart = stripeConnectControlAvailable(platformConfigured);
  const badge = BADGE[state];
  const busy = loading || starting;

  const start = async () => {
    if (!canStart || busy) return;
    setStarting(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/stripe/connect?from=${encodeURIComponent(origin)}`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.url !== 'string' || !data.url) {
        setError(typeof data.error === 'string' ? data.error : 'Failed to start Stripe Connect.');
        setStarting(false);
        await load(true);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('Failed to start Stripe Connect.');
      setStarting(false);
    }
  };

  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(99,91,255,0.45)', borderRadius: 14, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 44, height: 44, background: 'rgba(99,91,255,0.18)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, border: '1px solid rgba(99,91,255,0.35)', color: '#a5b4fc' }}>
            <FaCreditCard />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#e5e7eb' }}>Stripe payouts</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Connect Express account</div>
          </div>
        </div>
        <span
          aria-label={loading ? 'Checking Stripe Connect' : `Stripe ${status?.label || 'Not connected'}`}
          style={{
            background: loading ? 'rgba(107,114,128,0.2)' : badge.background,
            color: loading ? '#9ca3af' : badge.color,
            border: `1px solid ${loading ? '#6b7280' : badge.border}`,
            borderRadius: 20,
            padding: '4px 14px',
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? 'Checking…' : (status?.label || 'Not connected')}
        </span>
      </div>

      <p style={{ color: '#9ca3af', fontSize: 13, margin: '0 0 12px', lineHeight: 1.5 }}>
        {loading ? 'Checking whether this shop can receive payouts.' : connectStatusDetail(state)}
      </p>
      {status?.state === 'ready' ? (
        <p style={{ color: '#86efac', fontSize: 13, margin: '0 0 12px', lineHeight: 1.5 }}>Ready</p>
      ) : null}
      {returnNotice ? (
        <p style={{ color: '#fde68a', fontSize: 13, margin: '0 0 12px', lineHeight: 1.5 }}>{returnNotice}</p>
      ) : null}
      {error ? (
        <p style={{ color: '#fca5a5', fontSize: 13, margin: '0 0 12px', lineHeight: 1.5 }}>{error}</p>
      ) : null}

      <button
        type="button"
        onClick={start}
        disabled={!canStart || busy}
        aria-disabled={!canStart || busy}
        aria-label={
          loading
            ? 'Checking Stripe Connect'
            : !status
              ? 'Stripe Connect status could not be loaded'
              : canStart
                ? connectActionLabel(state)
                : 'Stripe Connect is unavailable until platform Stripe keys are configured'
        }
        style={{
          width: '100%',
          background: canStart && !busy ? '#635BFF' : '#1f2937',
          color: canStart && !busy ? '#fff' : '#6b7280',
          border: 'none',
          borderRadius: 8,
          padding: '10px 0',
          fontSize: 13,
          fontWeight: 700,
          cursor: canStart && !busy ? 'pointer' : 'not-allowed',
        }}
      >
        {starting ? 'Opening Stripe…' : connectActionLabel(state)}
      </button>
    </div>
  );
}
