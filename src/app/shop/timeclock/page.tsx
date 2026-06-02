'use client';

import { useEffect, useMemo, useState } from 'react';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useRequireAuth } from '@/contexts/AuthContext';
import TimeClock from '@/components/TimeClock';

interface TimeEntry {
  id: string;
  techId: string;
  clockIn: string;
  clockOut?: string | null;
  hoursWorked?: number;
  tech?: {
    firstName?: string;
    lastName?: string;
    role?: string;
  };
}

export default function ShopTimeClockPage() {
  const { user, isLoading } = useRequireAuth(['shop']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [periodLabel, setPeriodLabel] = useState('Weekly');
  const [periodHours, setPeriodHours] = useState(0);
  const [shopEntries, setShopEntries] = useState<TimeEntry[]>([]);
  const [shopEntriesLoading, setShopEntriesLoading] = useState(false);

  const periodDays = useMemo(() => (periodLabel.toLowerCase().includes('bi') ? 14 : 7), [periodLabel]);

  const getMonday = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  };

  const getEntryHours = (entry: TimeEntry) => {
    if (typeof entry.hoursWorked === 'number' && Number.isFinite(entry.hoursWorked)) {
      return entry.hoursWorked;
    }
    const clockIn = new Date(entry.clockIn).getTime();
    const clockOut = entry.clockOut ? new Date(entry.clockOut).getTime() : Date.now();
    return Math.max(0, (clockOut - clockIn) / (1000 * 60 * 60));
  };

  const weekAnalytics = useMemo(() => {
    const now = new Date();
    const thisMonday = getMonday(now);
    const thisWeekDays = Array.from({ length: 7 }, (_, index) => {
      const d = new Date(thisMonday);
      d.setDate(thisMonday.getDate() + index);
      return d;
    });

    const prevMonday = new Date(thisMonday);
    prevMonday.setDate(thisMonday.getDate() - 7);
    const prevSundayEnd = new Date(thisMonday);
    prevSundayEnd.setMilliseconds(-1);

    const dayHours = thisWeekDays.map((day) => {
      const start = new Date(day);
      start.setHours(0, 0, 0, 0);
      const end = new Date(day);
      end.setHours(23, 59, 59, 999);
      const total = shopEntries
        .filter((entry) => {
          const ci = new Date(entry.clockIn).getTime();
          return ci >= start.getTime() && ci <= end.getTime();
        })
        .reduce((sum, entry) => sum + getEntryHours(entry), 0);
      return { day, total };
    });

    const previousWeekHours = shopEntries
      .filter((entry) => {
        const ci = new Date(entry.clockIn).getTime();
        return ci >= prevMonday.getTime() && ci <= prevSundayEnd.getTime();
      })
      .reduce((sum, entry) => sum + getEntryHours(entry), 0);

    return {
      thisWeekDays: dayHours,
      previousWeekHours,
      previousWeekLabel: `${prevMonday.toLocaleDateString()} - ${new Date(prevSundayEnd).toLocaleDateString()}`,
    };
  }, [shopEntries]);

  useEffect(() => {
    const loadHours = async () => {
      if (!user) return;
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const periodsRes = await fetch('/api/payroll/pay-periods', { headers: { Authorization: `Bearer ${token}` } });
        if (periodsRes.ok) {
          const periods = await periodsRes.json();
          const active = Array.isArray(periods) ? periods.find((p: any) => p?.status === 'open') || periods[0] : null;
          const type = String(active?.periodType || 'weekly').toLowerCase();
          if (type.includes('bi')) {
            setPeriodLabel('Biweekly');
          } else {
            setPeriodLabel('Weekly');
          }
        }

        const now = new Date();
        const start = new Date(now);
        start.setDate(now.getDate() - (periodDays - 1));
        const end = new Date(now);

        const timeRes = await fetch(
          `/api/time-tracking?techId=${user.id}&startDate=${start.toISOString()}&endDate=${end.toISOString()}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (timeRes.ok) {
          const data = await timeRes.json();
          const entries: TimeEntry[] = Array.isArray(data?.timeEntries) ? data.timeEntries : [];
          const total = entries.reduce((sum, entry) => sum + Number(entry.hoursWorked || 0), 0);
          setPeriodHours(Math.round(total * 10) / 10);
        }
      } catch {
        // Keep page usable even if the summary fetch fails.
      }
    };

    loadHours();
  }, [periodDays, user]);

  useEffect(() => {
    const loadShopEntries = async () => {
      if (!user) return;
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        setShopEntriesLoading(true);
        const shopId = user.shopId || user.id;
        const res = await fetch(`/api/time-tracking?shopId=${shopId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) return;
        const data = await res.json();
        const entries = Array.isArray(data?.timeEntries) ? data.timeEntries : [];
        setShopEntries(entries);
      } catch {
        // Keep timeclock usable even if shop entries fail to load.
      } finally {
        setShopEntriesLoading(false);
      }
    };

    loadShopEntries();
  }, [user]);

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="shop" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(o => !o)} showMenuButton />
        <main style={{ flex: 1, padding: 24, maxWidth: 900, margin: '0 auto', width: '100%' }}>
          <Breadcrumbs />
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', margin: '16px 0 24px' }}>Time Clock</h1>

          <div style={{ marginBottom: 16, background: '#121212', border: '1px solid rgba(229,51,42,0.35)', borderRadius: 10, padding: '12px 16px', color: '#e5e7eb' }}>
            <div style={{ fontSize: 12, color: '#fca5a5', textTransform: 'uppercase', letterSpacing: 0.8 }}>Shop Team Clock-Ins</div>
            <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2 }}>{shopEntriesLoading ? 'Loading...' : `${shopEntries.length} total records`}</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>All employee clock-in/clock-out entries for this shop.</div>
          </div>

          <div style={{ marginBottom: 16, background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '12px 16px', color: '#e5e7eb' }}>
            <div style={{ fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8 }}>{periodLabel} Hours</div>
            <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2 }}>{periodHours.toFixed(1)}h</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Based on your current {periodLabel.toLowerCase()} payroll cycle.</div>
          </div>

          <div style={{ marginBottom: 16, background: '#111827', border: '1px solid #374151', borderRadius: 10, padding: '12px 16px', color: '#e5e7eb' }}>
            <div style={{ fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Monday - Sunday Hours Calendar</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
              {weekAnalytics.thisWeekDays.map(({ day, total }) => (
                <div key={day.toISOString()} style={{ background: '#0b1220', border: '1px solid #273244', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 12, color: '#9aa3b2', fontWeight: 700 }}>{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{day.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}</div>
                  <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800, color: '#22c55e' }}>{total.toFixed(1)}h</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16, background: '#1f1311', border: '1px solid rgba(229,51,42,0.35)', borderRadius: 10, padding: '12px 16px', color: '#e5e7eb' }}>
            <div style={{ fontSize: 12, color: '#fca5a5', textTransform: 'uppercase', letterSpacing: 0.8 }}>Last Week Hours</div>
            <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2 }}>{weekAnalytics.previousWeekHours.toFixed(1)}h</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{weekAnalytics.previousWeekLabel}</div>
          </div>

          <div style={{ marginBottom: 16, background: '#0f172a', border: '1px solid #334155', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155', color: '#e5e7eb', fontWeight: 700 }}>Employee Clock-In Times</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead>
                  <tr style={{ background: '#111827' }}>
                    <th style={{ textAlign: 'left', color: '#9ca3af', fontSize: 12, padding: '10px 12px' }}>Employee</th>
                    <th style={{ textAlign: 'left', color: '#9ca3af', fontSize: 12, padding: '10px 12px' }}>Clock In</th>
                    <th style={{ textAlign: 'left', color: '#9ca3af', fontSize: 12, padding: '10px 12px' }}>Clock Out</th>
                    <th style={{ textAlign: 'right', color: '#9ca3af', fontSize: 12, padding: '10px 12px' }}>Hours</th>
                    <th style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: '10px 12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shopEntriesLoading && (
                    <tr>
                      <td colSpan={5} style={{ color: '#94a3b8', fontSize: 13, padding: '14px 12px', textAlign: 'center' }}>Loading clock-ins...</td>
                    </tr>
                  )}
                  {!shopEntriesLoading && shopEntries.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ color: '#94a3b8', fontSize: 13, padding: '14px 12px', textAlign: 'center' }}>No clock-in records found for this shop.</td>
                    </tr>
                  )}
                  {!shopEntriesLoading && shopEntries.map((entry) => {
                    const employeeName = `${entry.tech?.firstName || ''} ${entry.tech?.lastName || ''}`.trim() || 'Unknown Employee';
                    const active = !entry.clockOut;
                    return (
                      <tr key={entry.id} style={{ borderTop: '1px solid #1f2937' }}>
                        <td style={{ color: '#e5e7eb', fontSize: 13, padding: '10px 12px' }}>{employeeName}</td>
                        <td style={{ color: '#cbd5e1', fontSize: 13, padding: '10px 12px' }}>{new Date(entry.clockIn).toLocaleString()}</td>
                        <td style={{ color: '#cbd5e1', fontSize: 13, padding: '10px 12px' }}>{entry.clockOut ? new Date(entry.clockOut).toLocaleString() : 'Still clocked in'}</td>
                        <td style={{ color: '#22c55e', fontSize: 13, padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{getEntryHours(entry).toFixed(2)}h</td>
                        <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                          <span style={{
                            display: 'inline-block',
                            borderRadius: 999,
                            padding: '2px 10px',
                            fontSize: 11,
                            fontWeight: 700,
                            color: active ? '#4ade80' : '#fca5a5',
                            background: active ? 'rgba(34,197,94,0.18)' : 'rgba(229,51,42,0.16)',
                            border: active ? '1px solid rgba(34,197,94,0.35)' : '1px solid rgba(229,51,42,0.35)',
                          }}>
                            {active ? 'CLOCKED IN' : 'CLOCKED OUT'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <TimeClock techId={user.id} shopId={user.shopId || user.id} techName={user.name || 'Shop Owner'} />
        </main>
      </div>
    </div>
  );
}

