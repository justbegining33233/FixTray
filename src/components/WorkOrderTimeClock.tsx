'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FaClock, FaPlay, FaPause, FaStop, FaCheck } from 'react-icons/fa';

interface TimeEntry {
  id: string;
  workOrderId: string;
  techId: string;
  clockIn: string;
  clockOut?: string | null;
  hoursSpent?: number;
  notes?: string;
  status: string;
  tech?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface WorkOrderTimeClockProps {
  workOrderId: string;
  techId: string;
  techName: string;
  onEntryCreated?: () => void;
}

export function WorkOrderTimeClock({
  workOrderId,
  techId,
  techName,
  onEntryCreated,
}: WorkOrderTimeClockProps) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [notes, setNotes] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load time entries for this work order
  const loadEntries = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/workorders/${workOrderId}/time-tracking`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setEntries(data.timeEntries || []);

        // Set active entry if exists
        const active = data.timeEntries?.find((e: TimeEntry) => !e.clockOut);
        setActiveEntry(active || null);
      }
    } catch (error) {
      // Silently handle error - don't block UI
      setMessage({ type: 'error', text: 'Failed to load time entries' });
    }
  };

  useEffect(() => {
    loadEntries();
  }, [workOrderId]);

  // Update elapsed time for active entry
  useEffect(() => {
    if (!activeEntry) {
      setElapsedTime('00:00:00');
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const update = () => {
      const clockInTime = new Date(activeEntry.clockIn).getTime();
      const elapsed = Date.now() - clockInTime;
      const hours = Math.floor(elapsed / 3600000);
      const minutes = Math.floor((elapsed % 3600000) / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      setElapsedTime(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    update();
    timerRef.current = setInterval(update, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeEntry]);

  const handleClockIn = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/workorders/${workOrderId}/time-tracking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'clock-in',
          techId,
          notes: notes || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveEntry(data.entry);
        setMessage({ type: 'success', text: `${techName} clocked in to job` });
        setNotes('');
        await loadEntries();
        onEntryCreated?.();
      } else {
        const error = await res.json();
        setMessage({ type: 'error', text: error.error || 'Failed to clock in' });
      }
    } catch (error) {
      console.error('Clock in error:', error);
      setMessage({ type: 'error', text: 'Error clocking in' });
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/workorders/${workOrderId}/time-tracking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'clock-out',
          techId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveEntry(null);
        setElapsedTime('00:00:00');
        setMessage({
          type: 'success',
          text: `${techName} clocked out. Time spent: ${data.entry.hoursSpent?.toFixed(2)}h`,
        });
        await loadEntries();
        onEntryCreated?.();
      } else {
        const error = await res.json();
        setMessage({ type: 'error', text: error.error || 'Failed to clock out' });
      }
    } catch (error) {
      console.error('Clock out error:', error);
      setMessage({ type: 'error', text: 'Error clocking out' });
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/workorders/${workOrderId}/time-tracking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'pause',
          techId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveEntry(data.entry);
        setMessage({ type: 'success', text: 'Job tracking paused' });
      } else {
        setMessage({ type: 'error', text: 'Failed to pause tracking' });
      }
    } catch (error) {
      console.error('Pause error:', error);
      setMessage({ type: 'error', text: 'Error pausing tracking' });
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async () => {
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/workorders/${workOrderId}/time-tracking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'resume',
          techId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveEntry(data.entry);
        setMessage({ type: 'success', text: 'Job tracking resumed' });
      } else {
        setMessage({ type: 'error', text: 'Failed to resume tracking' });
      }
    } catch (error) {
      console.error('Resume error:', error);
      setMessage({ type: 'error', text: 'Error resuming tracking' });
    } finally {
      setLoading(false);
    }
  };

  const totalHours = entries
    .filter(e => e.hoursSpent !== null)
    .reduce((sum, e) => sum + (e.hoursSpent || 0), 0);

  return (
    <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', padding: 20, background: 'rgba(0,0,0,0.3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 8 }}>
        <FaClock style={{ color: '#e5332a', fontSize: 18 }} />
        <h3 style={{ margin: 0, color: '#e5e7eb', fontSize: 16, fontWeight: 700 }}>
          Job Time Tracking
        </h3>
      </div>

      {/* Total time spent */}
      <div style={{ marginBottom: 16, padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
        <div style={{ fontSize: 12, color: '#9aa3b2', marginBottom: 4 }}>Total Time on This Job</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#22c55e' }}>
          {totalHours.toFixed(2)}h
        </div>
      </div>

      {/* Active timer or clock-in area */}
      {activeEntry ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ padding: 12, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#9aa3b2', marginBottom: 4 }}>Currently Clocked In</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#4ade80', fontFamily: 'monospace' }}>
              {elapsedTime}
            </div>
            <div style={{ fontSize: 12, color: '#9aa3b2', marginTop: 6 }}>
              Started: {new Date(activeEntry.clockIn).toLocaleTimeString()}
            </div>
            {activeEntry.status === 'paused' && (
              <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4 }}>
                ⏸ Tracking Paused
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {activeEntry.status === 'active' ? (
              <button
                onClick={handlePause}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #f59e0b',
                  background: 'rgba(245,158,11,0.1)',
                  color: '#f59e0b',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <FaPause /> Pause Job
              </button>
            ) : (
              <button
                onClick={handleResume}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #22c55e',
                  background: 'rgba(34,197,94,0.1)',
                  color: '#22c55e',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <FaPlay /> Resume Job
              </button>
            )}

            <button
              onClick={handleClockOut}
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #e5332a',
                background: 'rgba(229,51,42,0.1)',
                color: '#e5332a',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <FaStop /> Clock Out
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#9aa3b2', marginBottom: 6 }}>
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g., Replaced alternator, diagnosed transmission issue"
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.3)',
                color: '#e5e7eb',
                fontFamily: 'inherit',
                fontSize: 13,
                resize: 'vertical',
                minHeight: 60,
              }}
            />
          </div>

          <button
            onClick={handleClockIn}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#e5332a',
              color: 'white',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontSize: 14,
            }}
          >
            <FaPlay /> Clock In to Job
          </button>
        </div>
      )}

      {/* Message */}
      {message && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: message.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(229,51,42,0.15)',
            border: `1px solid ${message.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(229,51,42,0.3)'}`,
            color: message.type === 'success' ? '#4ade80' : '#fca5a5',
            fontSize: 13,
          }}
        >
          {message.text}
        </div>
      )}

      {/* Time entries history */}
      {entries.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 12, color: '#9aa3b2', fontWeight: 600, marginBottom: 10 }}>
            Job Time History ({entries.length} entries)
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entries.slice(0, 5).map(entry => (
              <div
                key={entry.id}
                style={{
                  padding: 10,
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 6,
                  fontSize: 12,
                  color: '#e5e7eb',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div>
                    {new Date(entry.clockIn).toLocaleTimeString()} -{' '}
                    {entry.clockOut ? new Date(entry.clockOut).toLocaleTimeString() : 'Active'}
                  </div>
                  <div style={{ fontWeight: 700, color: '#22c55e' }}>
                    {entry.hoursSpent?.toFixed(2)}h
                  </div>
                </div>
                {entry.notes && (
                  <div style={{ color: '#9aa3b2', fontSize: 11 }}>Note: {entry.notes}</div>
                )}
              </div>
            ))}
          </div>

          {entries.length > 5 && (
            <div style={{ marginTop: 8, fontSize: 11, color: '#9aa3b2', textAlign: 'center' }}>
              +{entries.length - 5} more entries
            </div>
          )}
        </div>
      )}
    </div>
  );
}
