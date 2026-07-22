'use client';

import { useEffect, useState } from 'react';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaChartBar, FaUsers, FaArrowUp, FaArrowDown } from 'react-icons/fa';

interface TechStats {
  id: string;
  name: string;
  jobsCompleted: number;
  hoursWorked: number;
  avgTimePerJob: number;
  efficiency: number;
  earnings: number;
}

export default function ShopPerformancePage() {
  const { user, isLoading } = useRequireAuth(['shop', 'manager']);
  const [techs, setTechs] = useState<TechStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('month');

  useEffect(() => {
    if (!user) return;
    loadPerformance();
  }, [user, timeRange]);

  const loadPerformance = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/shop/team-performance?range=${timeRange}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTechs(data.techs || []);
      }
    } catch (error) {
      console.error('Failed to load performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  const totalJobs = techs.reduce((sum, t) => sum + t.jobsCompleted, 0);
  const totalEarnings = techs.reduce((sum, t) => sum + t.earnings, 0);
  const avgEfficiency = techs.reduce((sum, t) => sum + t.efficiency, 0) / techs.length || 0;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role={user?.role || 'shop'} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton />
        <main style={{ flex: 1, padding: '24px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', marginBottom: 32 }}>
            <FaChartBar style={{ marginRight: 12, verticalAlign: 'middle' }} />
            Team Performance
          </h1>

          {/* Time Range */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
            {(['week', 'month', 'quarter'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: timeRange === range ? '#e5332a' : 'rgba(0,0,0,0.3)',
                  color: timeRange === range ? 'white' : '#9ca3af',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                {range === 'week' ? 'Week' : range === 'month' ? 'Month' : 'Quarter'}
              </button>
            ))}
          </div>

          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
            {[
              { label: 'Total Jobs', value: totalJobs, icon: <FaChartBar />, color: '#3b82f6' },
              { label: 'Revenue', value: `$${totalEarnings.toFixed(0)}`, icon: <FaArrowUp />, color: '#ec4899' },
              { label: 'Avg Efficiency', value: `${avgEfficiency.toFixed(0)}%`, icon: <FaArrowUp />, color: '#22c55e' },
              { label: 'Team Size', value: techs.length, icon: <FaUsers />, color: '#f59e0b' },
            ].map((stat, i) => (
              <div key={i} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ color: stat.color, fontSize: 20 }}>{stat.icon}</span>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{stat.label}</div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Techs Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Loading team performance...</div>
          ) : techs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, background: 'rgba(0,0,0,0.3)', borderRadius: 12, color: '#9ca3af' }}>
              No performance data available
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>Technician</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>Jobs</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>Hours</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>Avg Time/Job</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>Efficiency</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>Earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {techs.map(tech => (
                    <tr key={tech.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '16px', color: '#e5e7eb', fontWeight: 500 }}>{tech.name}</td>
                      <td style={{ padding: '16px', textAlign: 'center', color: '#e5e7eb' }}>{tech.jobsCompleted}</td>
                      <td style={{ padding: '16px', textAlign: 'center', color: '#9ca3af' }}>{tech.hoursWorked.toFixed(1)}h</td>
                      <td style={{ padding: '16px', textAlign: 'center', color: '#9ca3af' }}>{tech.avgTimePerJob.toFixed(1)}h</td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <span style={{
                          background: tech.efficiency >= 80 ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                          color: tech.efficiency >= 80 ? '#22c55e' : '#f59e0b',
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                        }}>
                          {tech.efficiency.toFixed(0)}%
                        </span>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center', color: '#ec4899', fontWeight: 600 }}>
                        ${tech.earnings.toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
