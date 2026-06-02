'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRequireAuth } from '@/contexts/AuthContext';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import Breadcrumbs from '@/components/Breadcrumbs';
import { FaCalendarAlt, FaUser, FaClock } from 'react-icons/fa';

interface ScheduleEntry {
  id: string;
  techName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
}

export default function ManagerSchedulePage() {
  const { user, isLoading } = useRequireAuth(['manager']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);

  const getWeekDates = useCallback(() => {
    const today = new Date();
    today.setDate(today.getDate() + weekOffset * 7);
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [weekOffset]);

  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/shop/team', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const team = await res.json();
        const entries: ScheduleEntry[] = (Array.isArray(team) ? team : team.technicians ?? []).map(
          (t: { id: string; name?: string; firstName?: string; lastName?: string }) => ({
            id: t.id,
            techName: t.name || `${t.firstName || ''} ${t.lastName || ''}`.trim() || 'Technician',
            date: new Date().toISOString().split('T')[0],
            startTime: '08:00',
            endTime: '17:00',
            status: 'scheduled',
          })
        );
        setSchedules(entries);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user) fetchSchedules(); }, [user, fetchSchedules]);

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  const weekDates = getWeekDates();
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="manager" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(o => !o)} showMenuButton />
        <main style={{ flex: 1, padding: 24, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <Breadcrumbs />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 24px', flexWrap: 'wrap', gap: 12 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb' }}>Team Schedule</h1>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setWeekOffset(w => w - 1)} style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', color: '#9aa3b2', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: 14 }}>&larr; Prev</button>
              <button onClick={() => setWeekOffset(0)} style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', color: '#9aa3b2', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: 14 }}>Today</button>
              <button onClick={() => setWeekOffset(w => w + 1)} style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', color: '#9aa3b2', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: 14 }}>Next &rarr;</button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 40 }}>Loading...</div>
          ) : (
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
              {/* Header row */}
              <div style={{ display: 'grid', gridTemplateColumns: '180px repeat(7, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ padding: '12px 16px', color: '#6b7280', fontSize: 13, fontWeight: 500 }}>Technician</div>
                {weekDates.map((d, i) => (
                  <div key={i} style={{ padding: '12px 8px', textAlign: 'center' }}>
                    <div style={{ color: '#6b7280', fontSize: 11 }}>{dayNames[i]}</div>
                    <div style={{ color: '#e5e7eb', fontSize: 14, fontWeight: 600 }}>{d.getDate()}</div>
                  </div>
                ))}
              </div>
              {schedules.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#6b7280', padding: 40 }}>
                  <FaCalendarAlt style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }} />
                  <p>No team members found</p>
                </div>
              ) : (
                schedules.map(s => (
                  <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '180px repeat(7, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FaUser style={{ color: '#6b7280', fontSize: 14 }} />
                      <span style={{ color: '#e5e7eb', fontSize: 14 }}>{s.techName}</span>
                    </div>
                    {weekDates.map((d, i) => {
                      const isToday = new Date().toDateString() === d.toDateString();
                      return (
                        <div key={i} style={{ padding: '12px 8px', textAlign: 'center', background: isToday ? 'rgba(229,51,42,0.08)' : 'transparent' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            <FaClock style={{ color: '#6b7280', fontSize: 10 }} />
                            <span style={{ color: '#9aa3b2', fontSize: 12 }}>{s.startTime}-{s.endTime}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}


