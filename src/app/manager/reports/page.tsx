'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRequireAuth } from '@/contexts/AuthContext';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import Breadcrumbs from '@/components/Breadcrumbs';
import { FaChartBar, FaUsers, FaClock, FaDollarSign, FaDownload } from 'react-icons/fa';

interface ReportData {
  totalWorkOrders: number;
  completedWorkOrders: number;
  avgCompletionTime: string;
  totalRevenue: number;
  techPerformance: { name: string; completed: number; avgTime: string }[];
}

export default function ManagerReportsPage() {
  const { user, isLoading } = useRequireAuth(['manager']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - parseInt(dateRange) * 86400000).toISOString();
      const res = await fetch(`/api/analytics?startDate=${startDate}&endDate=${endDate}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const json = await res.json();
        setData({
          totalWorkOrders: json.totalWorkOrders ?? 0,
          completedWorkOrders: json.completedWorkOrders ?? 0,
          avgCompletionTime: json.avgCompletionTime ?? 'N/A',
          totalRevenue: json.totalRevenue ?? 0,
          techPerformance: json.techPerformance ?? [],
        });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    if (!user) return;

    fetchReports();
    const interval = setInterval(fetchReports, 60 * 1000);

    return () => clearInterval(interval);
  }, [user, fetchReports]);

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  const cards = [
    { icon: <FaChartBar />, label: 'Total Work Orders', value: data?.totalWorkOrders ?? 0, color: '#e5332a' },
    { icon: <FaUsers />, label: 'Completed', value: data?.completedWorkOrders ?? 0, color: '#22c55e' },
    { icon: <FaDollarSign />, label: 'Revenue', value: `$${(data?.totalRevenue ?? 0).toLocaleString()}`, color: '#f59e0b' },
    { icon: <FaClock />, label: 'Avg Completion', value: data?.avgCompletionTime ?? 'N/A', color: '#f97316' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="manager" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(o => !o)} showMenuButton />
        <main style={{ flex: 1, padding: 24, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <Breadcrumbs />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 24px', flexWrap: 'wrap', gap: 12 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb' }}>Performance Reports</h1>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={dateRange} onChange={e => setDateRange(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.1)', fontSize: 14 }}>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
              <a
                href={`/api/analytics/export?format=csv&startDate=${new Date(Date.now() - parseInt(dateRange) * 86400000).toISOString()}&endDate=${new Date().toISOString()}`}
                download
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: '#e5332a', color: '#fff', fontSize: 13, textDecoration: 'none', cursor: 'pointer' }}
              >
                <FaDownload /> Export CSV
              </a>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 40 }}>Loading...</div>
          ) : (
            <>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
                {cards.map((c, i) => (
                  <div key={i} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${c.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.color, fontSize: 18 }}>{c.icon}</div>
                    <div>
                      <div style={{ color: '#6b7280', fontSize: 13 }}>{c.label}</div>
                      <div style={{ color: '#e5e7eb', fontSize: 22, fontWeight: 700 }}>{c.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tech Performance */}
              {(data?.techPerformance?.length ?? 0) > 0 && (
                <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <h2 style={{ color: '#e5e7eb', fontSize: 18, fontWeight: 600 }}>Technician Performance</h2>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <th style={{ textAlign: 'left', padding: '12px 20px', color: '#6b7280', fontSize: 13, fontWeight: 500 }}>Technician</th>
                        <th style={{ textAlign: 'left', padding: '12px 20px', color: '#6b7280', fontSize: 13, fontWeight: 500 }}>Completed</th>
                        <th style={{ textAlign: 'left', padding: '12px 20px', color: '#6b7280', fontSize: 13, fontWeight: 500 }}>Avg Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data!.techPerformance.map((t, i) => (
                        <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '12px 20px', color: '#e5e7eb', fontSize: 14 }}>{t.name}</td>
                          <td style={{ padding: '12px 20px', color: '#9aa3b2', fontSize: 14 }}>{t.completed}</td>
                          <td style={{ padding: '12px 20px', color: '#9aa3b2', fontSize: 14 }}>{t.avgTime}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

