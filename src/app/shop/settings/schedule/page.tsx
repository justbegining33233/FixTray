'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useRequireAuth from '@/lib/useRequireAuth';
import { FaArrowLeft, FaBan, FaCalendarAlt, FaClock, FaSave, FaWrench } from 'react-icons/fa';

interface Schedule {
  id?: string;
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

interface BlockedDate {
  id: string;
  date: string;
  reason: string | null;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ScheduleSettingsPage() {
  useRequireAuth(['shop']);
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [capacity, setCapacity] = useState(1);
  const [slotDuration, setSlotDuration] = useState(30);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [newBlockedDate, setNewBlockedDate] = useState('');
  const [newBlockedReason, setNewBlockedReason] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/shop/schedule', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCapacity(data.capacity || 1);
        setSlotDuration(data.slotDuration || 30);
        setSchedules(data.schedules || []);
        setBlockedDates(data.blockedDates || []);
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleChange = (dayOfWeek: number, field: keyof Schedule, value: boolean | string) => {
    setSchedules(prev => prev.map(s => 
      s.dayOfWeek === dayOfWeek ? { ...s, [field]: value } : s
    ));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/shop/schedule', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ capacity, slotDuration, schedules })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Schedule saved successfully!' });
      } else {
        setMessage({ type: 'error', text: 'Failed to save schedule' });
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      setMessage({ type: 'error', text: 'Error saving schedule' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleAddBlockedDate = async () => {
    if (!newBlockedDate) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/shop/schedule/blockedDates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ date: newBlockedDate, reason: newBlockedReason })
      });

      if (res.ok) {
        const data = await res.json();
        setBlockedDates(prev => [...prev, data].sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        ));
        setNewBlockedDate('');
        setNewBlockedReason('');
        setMessage({ type: 'success', text: 'Blocked date added!' });
      } else {
        const error = await res.json();
        setMessage({ type: 'error', text: error.error || 'Failed to add blocked date' });
      }
    } catch (error) {
      console.error('Error adding blocked date:', error);
      setMessage({ type: 'error', text: 'Error adding blocked date' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleRemoveBlockedDate = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/shop/schedule/blockedDates?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setBlockedDates(prev => prev.filter(d => d.id !== id));
        setMessage({ type: 'success', text: 'Blocked date removed!' });
      }
    } catch (error) {
      console.error('Error removing blocked date:', error);
    }
    setTimeout(() => setMessage(null), 3000);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'transparent', padding: 24 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', color: 'white', textAlign: 'center', paddingTop: 100 }}>
          Loading schedule settings...
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', padding: 24 }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <button
            onClick={() => router.back()}
            style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8,
              padding: '8px 16px', color: 'white', cursor: 'pointer'
            }}
          >
            <FaArrowLeft style={{marginRight:4}} /> Back
          </button>
          <div>
            <h1 style={{ color: 'white', fontSize: 28, fontWeight: 700, margin: 0 }}><FaCalendarAlt style={{marginRight:4}} /> Schedule Settings</h1>
            <p style={{ color: '#9aa3b2', fontSize: 14, margin: '4px 0 0' }}>Manage your business hours, capacity, and blocked dates</p>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div style={{
            padding: 16, borderRadius: 8, marginBottom: 24,
            background: message.type === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
            border: `1px solid ${message.type === 'success' ? '#22c55e' : '#ef4444'}`,
            color: message.type === 'success' ? '#22c55e' : '#ef4444'
          }}>
            {message.text}
          </div>
        )}

        {/* Capacity Settings */}
        <div style={{
          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12, padding: 24, marginBottom: 24
        }}>
          <h2 style={{ color: 'white', fontSize: 20, fontWeight: 600, marginBottom: 20 }}><FaWrench style={{marginRight:4}} /> Capacity Settings</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <label style={{ display: 'block', color: '#9aa3b2', fontSize: 14, marginBottom: 8 }}>
                Number of Bays/Simultaneous Appointments
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value) || 1)}
                style={{
                  width: '100%', padding: 12, background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
                  color: 'white', fontSize: 16
                }}
              />
              <p style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
                How many appointments can you handle at the same time?
              </p>
            </div>

            <div>
              <label style={{ display: 'block', color: '#9aa3b2', fontSize: 14, marginBottom: 8 }}>
                Time Slot Duration (minutes)
              </label>
              <select
                value={slotDuration}
                onChange={(e) => setSlotDuration(parseInt(e.target.value))}
                style={{
                  width: '100%', padding: 12, background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
                  color: 'white', fontSize: 16
                }}
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
              <p style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
                How long is each appointment slot?
              </p>
            </div>
          </div>
        </div>

        {/* Business Hours */}
        <div style={{
          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12, padding: 24, marginBottom: 24
        }}>
          <h2 style={{ color: 'white', fontSize: 20, fontWeight: 600, marginBottom: 20 }}><FaClock style={{marginRight:4}} /> Business Hours</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {schedules.map(schedule => (
              <div
                key={schedule.dayOfWeek}
                style={{
                  display: 'grid', gridTemplateColumns: '150px 80px 1fr 1fr',
                  gap: 16, alignItems: 'center', padding: 12,
                  background: 'rgba(255,255,255,0.05)', borderRadius: 8
                }}
              >
                <span style={{ color: 'white', fontWeight: 500 }}>{DAYS[schedule.dayOfWeek]}</span>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={schedule.isOpen}
                    onChange={(e) => handleScheduleChange(schedule.dayOfWeek, 'isOpen', e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <span style={{ color: schedule.isOpen ? '#22c55e' : '#ef4444', fontSize: 13 }}>
                    {schedule.isOpen ? 'Open' : 'Closed'}
                  </span>
                </label>

                {schedule.isOpen ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#9aa3b2', fontSize: 13 }}>Open:</span>
                      <input
                        type="time"
                        value={schedule.openTime}
                        onChange={(e) => handleScheduleChange(schedule.dayOfWeek, 'openTime', e.target.value)}
                        style={{
                          padding: 8, background: 'rgba(255,255,255,0.1)',
                          border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6,
                          color: 'white', fontSize: 14
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#9aa3b2', fontSize: 13 }}>Close:</span>
                      <input
                        type="time"
                        value={schedule.closeTime}
                        onChange={(e) => handleScheduleChange(schedule.dayOfWeek, 'closeTime', e.target.value)}
                        style={{
                          padding: 8, background: 'rgba(255,255,255,0.1)',
                          border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6,
                          color: 'white', fontSize: 14
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <span style={{ color: '#6b7280', fontSize: 13, gridColumn: 'span 2' }}>
                    Shop is closed on this day
                  </span>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              marginTop: 20, padding: '12px 24px',
              background: saving ? '#6b7280' : 'linear-gradient(135deg, #e5332a 0%, #ff6b6b 100%)',
              border: 'none', borderRadius: 8, color: 'white',
              fontSize: 15, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
              width: '100%'
            }}
          >
            {saving ? 'Saving...' : <><FaSave style={{marginRight:4}} /> Save Schedule Settings</>}
          </button>
        </div>

        {/* Blocked Dates */}
        <div style={{
          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12, padding: 24
        }}>
          <h2 style={{ color: 'white', fontSize: 20, fontWeight: 600, marginBottom: 20 }}><FaBan style={{marginRight:4}} /> Blocked Dates</h2>
          <p style={{ color: '#9aa3b2', fontSize: 14, marginBottom: 20 }}>
            Add dates when your shop will be closed (holidays, vacations, maintenance, etc.)
          </p>
          
          {/* Add new blocked date */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <input
              type="date"
              value={newBlockedDate}
              onChange={(e) => setNewBlockedDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              style={{
                padding: 12, background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
                color: 'white', fontSize: 14, flex: '1 1 150px'
              }}
            />
            <input
              type="text"
              placeholder="Reason (optional)"
              value={newBlockedReason}
              onChange={(e) => setNewBlockedReason(e.target.value)}
              style={{
                padding: 12, background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
                color: 'white', fontSize: 14, flex: '2 1 200px'
              }}
            />
            <button
              onClick={handleAddBlockedDate}
              disabled={!newBlockedDate}
              style={{
                padding: '12px 20px', background: newBlockedDate ? '#e5332a' : '#4b5563',
                border: 'none', borderRadius: 8, color: 'white',
                fontSize: 14, fontWeight: 600, cursor: newBlockedDate ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap'
              }}
            >
              + Add Date
            </button>
          </div>

          {/* List of blocked dates */}
          {blockedDates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#6b7280' }}>
              No blocked dates. Your shop is available on all scheduled days.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {blockedDates.map(blocked => (
                <div
                  key={blocked.id}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: 12, background: 'rgba(239,68,68,0.1)', borderRadius: 8,
                    border: '1px solid rgba(239,68,68,0.2)'
                  }}
                >
                  <div>
                    <span style={{ color: 'white', fontWeight: 500 }}>
                      {new Date(blocked.date).toLocaleDateString('en-US', { 
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                      })}
                    </span>
                    {blocked.reason && (
                      <span style={{ color: '#9aa3b2', marginLeft: 12, fontSize: 13 }}>
                         -  {blocked.reason}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveBlockedDate(blocked.id)}
                    style={{
                      background: 'rgba(239,68,68,0.2)', border: 'none',
                      borderRadius: 6, padding: '6px 12px', color: '#ef4444',
                      fontSize: 13, cursor: 'pointer'
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

