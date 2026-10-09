'use client';

import { useCallback, useEffect, useState } from 'react';
import useRequireAuth from '@/lib/useRequireAuth';

interface ClockPerson {
  personId: string;
  name?: string;
  role?: string;
  minutes: number;
}

interface WorkRow {
  id: string;
  personId: string;
  workOrderId: string;
  minutes: number;
}

interface StaffRow {
  id: string;
  personId: string;
  name?: string;
  clockIn?: string;
  minutes: number;
}

interface ClockPayload {
  scope: 'self' | 'shop';
  people: ClockPerson[];
  totalMinutes: number;
  totalHoursLabel: string;
  shopTotalMinutes: number | null;
  workMinutes: number;
  work: WorkRow[];
  staffEntries?: StaffRow[];
}

function hours(minutes: number): string {
  const whole = Math.floor(Math.abs(minutes) / 60);
  const tenth = Math.round((Math.abs(minutes) % 60) / 6) % 10;
  const carry = Math.floor(Math.round((Math.abs(minutes) % 60) / 6) / 10);
  return `${whole + carry}.${tenth}`;
}

export default function StaffClocksScreen({ role }: { role: 'shop' | 'manager' | 'tech' }) {
  const { user, isLoading } = useRequireAuth([role]);
  const [clocks, setClocks] = useState<ClockPayload | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [entryId, setEntryId] = useState('');
  const [clock, setClock] = useState<'staff' | 'work'>('staff');
  const [minutes, setMinutes] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/shop/clocks', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || 'Could not load clocks');
      return;
    }
    setClocks(body);
  }, []);

  useEffect(() => {
    if (!user) return;
    load().catch(() => setError('Could not load clocks'));
  }, [user, load]);

  async function correct() {
    setError('');
    setNotice('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/shop/clocks', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clock, entryId, minutes: Number(minutes), reason }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error || 'Correction failed');
        return;
      }
      setReason('');
      setNotice('Clock correction saved.');
      await load();
    } catch {
      setError('Clock correction was not saved. The request did not finish.');
    }
  }

  if (isLoading || !user) return <div style={{ padding: 32, color: '#e5e7eb' }}>Loading...</div>;
  if (!clocks) return <div style={{ padding: 32, color: '#e5e7eb' }}>{error || 'Loading...'}</div>;

  return (
    <div style={{ minHeight: '100vh', color: '#e5e7eb', padding: 24, fontFamily: 'system-ui,sans-serif' }}>
      <h1 style={{ marginTop: 0 }}>{clocks.scope === 'shop' ? 'Staff clocks' : 'My clocks'}</h1>
      <p>Staff clock is paid time. Work clock is time on the ticket. Work hours do not change staff hours.</p>
      {error && <div role="alert" style={{ background: '#3b1214', border: '1px solid #fca5a5', color: '#fecaca', borderRadius: 10, padding: 12 }}>{error}</div>}
      {notice && <div role="status" style={{ background: '#12301c', border: '1px solid #86efac', color: '#bbf7d0', borderRadius: 10, padding: 12 }}>{notice}</div>}
      {clocks.people.map((person) => (
        <p key={person.personId}>{person.name || person.personId} ({person.role}): {hours(person.minutes)} hours</p>
      ))}
      <p>
        {clocks.scope === 'shop'
          ? `Staff total ${clocks.totalHoursLabel} hours (${clocks.shopTotalMinutes} minutes).`
          : `Your hours ${clocks.totalHoursLabel}. This is not the shop total.`}
      </p>
      <h2>Work clock</h2>
      <p>{hours(clocks.workMinutes)} hours on tickets.</p>
      {clocks.work.map((row) => (
        <p key={row.id}>{row.workOrderId}: {hours(row.minutes)} hours ({row.id})</p>
      ))}
      <h2>Correction</h2>
      <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 16, maxWidth: 560, display: 'grid', gap: 10 }}>
        <label style={{ display: 'grid', gap: 6, color: '#9aa3b2', fontSize: 13 }}>
          Clock
          <select value={clock} onChange={(event) => setClock(event.target.value === 'work' ? 'work' : 'staff')} style={{ background: '#111827', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, padding: '10px 12px' }}>
            <option value="staff">Staff clock</option>
            <option value="work">Work clock</option>
          </select>
        </label>
        <div style={{ color: '#9aa3b2', fontSize: 13 }}>Clock entry</div>
        {(clocks.staffEntries || []).length === 0 && clocks.work.length === 0 ? (
          <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 12, color: '#9aa3b2' }}>No clock entries to correct.</div>
        ) : (
          <div role="listbox" aria-label="Clock entries" style={{ display: 'grid', gap: 8 }}>
            {(clocks.staffEntries || []).map((row) => {
              const selected = entryId === row.id && clock === 'staff';
              const when = row.clockIn ? new Date(row.clockIn).toLocaleString() : 'Staff clock';
              return (
                <button
                  key={`staff-${row.id}`}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setEntryId(row.id);
                    setClock('staff');
                  }}
                  style={{
                    textAlign: 'left',
                    background: selected ? 'rgba(229,51,42,0.22)' : 'rgba(0,0,0,0.45)',
                    border: selected ? '1px solid rgba(229,51,42,0.55)' : '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10,
                    color: '#e5e7eb',
                    padding: 12,
                    cursor: 'pointer',
                  }}
                >
                  Staff · {row.name || row.personId} · {when} · {hours(row.minutes)} hours
                </button>
              );
            })}
            {clocks.work.map((row) => {
              const selected = entryId === row.id && clock === 'work';
              return (
                <button
                  key={`work-${row.id}`}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setEntryId(row.id);
                    setClock('work');
                  }}
                  style={{
                    textAlign: 'left',
                    background: selected ? 'rgba(229,51,42,0.22)' : 'rgba(0,0,0,0.45)',
                    border: selected ? '1px solid rgba(229,51,42,0.55)' : '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10,
                    color: '#e5e7eb',
                    padding: 12,
                    cursor: 'pointer',
                  }}
                >
                  Work · {row.workOrderId} · {hours(row.minutes)} hours
                </button>
              );
            })}
          </div>
        )}
        <input placeholder="Minutes" value={minutes} onChange={(event) => setMinutes(event.target.value)} style={{ background: '#111827', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, padding: '10px 12px' }} />
        <input placeholder="Reason" value={reason} onChange={(event) => setReason(event.target.value)} style={{ background: '#111827', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, padding: '10px 12px' }} />
        <button type="button" onClick={correct} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 14px', fontWeight: 700, cursor: 'pointer', justifySelf: 'start' }}>Save correction</button>
      </div>
    </div>
  );
}
