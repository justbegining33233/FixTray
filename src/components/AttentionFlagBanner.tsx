'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { usePhrase } from '@/lib/usePhrase';

type FlagRow = {
  id: string;
  title: string;
  message: string;
  workOrderId?: string | null;
  flagLabel: string;
  createdAt: string;
};

export function FlagMark({ label }: { label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: '#e5332a',
        color: '#fff',
        borderRadius: 999,
        padding: '2px 8px',
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        flexShrink: 0,
      }}
    >
      <span aria-hidden>⚑</span>
      {label}
    </span>
  );
}

export default function AttentionFlagBanner() {
  const say = usePhrase();
  const router = useRouter();
  const [flags, setFlags] = useState<FlagRow[]>([]);

  const load = useCallback(async () => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('userRole') || '';
    if (!token || !['shop', 'manager', 'tech'].includes(role)) {
      setFlags([]);
      return;
    }
    try {
      const res = await fetch('/api/notifications/flags', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setFlags([]);
        return;
      }
      const data = await res.json();
      const rows = Array.isArray(data?.flags) ? data.flags : [];
      setFlags(rows.filter((row: FlagRow) => row && row.id && row.title));
    } catch {
      setFlags([]);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  const markLookedAt = async (id: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const previous = flags;
    setFlags((current) => current.filter((flag) => flag.id !== id));
    try {
      const res = await fetch('/api/notifications/flags', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) setFlags(previous);
    } catch {
      setFlags(previous);
    }
  };

  if (flags.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 68,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(560px, calc(100% - 20px))',
        zIndex: 4000,
        display: 'grid',
        gap: 8,
      }}
    >
      {flags.slice(0, 3).map((flag) => (
        <div
          key={flag.id}
          style={{
            background: '#1a0b0b',
            border: '1px solid rgba(229,51,42,0.65)',
            borderRadius: 12,
            padding: '10px 12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            color: '#fee2e2',
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <FlagMark label={say('Flag')} />
            <strong style={{ fontSize: 14 }}>{say(flag.title)}</strong>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#fecaca' }}>
            {say(flag.message)}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {flag.workOrderId ? (
              <button
                type="button"
                onClick={() => router.push(`/workorders/${flag.workOrderId}` as Route)}
                style={{ background: '#e5332a', color: '#fff', border: 0, borderRadius: 8, padding: '6px 10px', fontWeight: 700, cursor: 'pointer' }}
              >
                {say('Open job')}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => { void markLookedAt(flag.id); }}
              style={{ background: 'transparent', color: '#fecaca', border: '1px solid rgba(254,202,202,0.4)', borderRadius: 8, padding: '6px 10px', fontWeight: 700, cursor: 'pointer' }}
            >
              {say('Mark looked at')}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
