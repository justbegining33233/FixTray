'use client';

import { useEffect, useState } from 'react';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaChartBar, FaTrophy, FaClock, FaCheckCircle, FaArrowUp } from 'react-icons/fa';

interface TechPerformance {
  id: string;
  name: string;
  email: string;
  shop: string;
  jobsCompleted: number;
  totalHours: number;
  avgTimePerJob: number;
  completionRate: number;
  customerRating: number;
  revenue: number;
  overallScore: number;
}

interface PerformanceStats {
  topTech: TechPerformance | null;
  averageCompletionRate: number;
  averageRating: number;
  averageRevenue: number;
  totalJobsThisMonth: number;
}

export default function AdminPerformancePage() {
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);
  const [techs, setTechs] = useState<TechPerformance[]>([]);
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sortBy, setSortBy] = useState<'revenue' | 'jobs' | 'rating' | 'score'>('revenue');
  const [timeRange, setTimeRange] = useState<'week' | 'month' | '90days'>('month');

  useEffect(() => {
    if (!user) return;
    loadPerformance();
  }, [user, timeRange]);

  const loadPerformance = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/performance?range=${timeRange}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch performance data');
      const data = await res.json();
      
      setTechs(data.techs || []);
      setStats(data.stats || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load performance data');
    } finally {
      setLoading(false);
    }
  };

  const sortedTechs = [...techs].sort((a, b) => {
    switch (sortBy) {
      case 'revenue':
        return b.revenue - a.revenue;
      case 'jobs':
        return b.jobsCompleted - a.jobsCompleted;
      case 'rating':
        return b.customerRating - a.customerRating;
      case 'score':
        return b.overallScore - a.overallScore;
      default:
        return 0;
    }
  });

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="admin" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton />
        <main style={{ flex: 1, padding: '24px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: '#e5e7eb', margin: '0 0 8px' }}>
              <FaChartBar style={{ marginRight: 12, verticalAlign: 'middle' }} />
              Team Performance Analytics
            </h1>
            <p style={{ color: '#9ca3af', margin: 0, fontSize: 14 }}>Monitor technician performance metrics</p>
          </div>

          {error && (
            <div style={{ background: 'rgba(229,51,42,0.15)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 12, padding: 16, marginBottom: 24, color: '#fca5a5' }}>
              {error}
            </div>
          )}

          {/* Time Range Selector */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
            {(['week', 'month', '90days'] as const).map(range => (
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
                  transition: 'all 0.2s',
                }}
              >
                {range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : 'Last 90 Days'}
              </button>
            ))}
          </div>

          {/* Stats Grid */}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
              {[
                { label: 'Top Performer', value: stats.topTech?.name || 'N/A', icon: <FaTrophy />, color: '#fbbf24' },
                { label: 'Avg Completion', value: `${stats.averageCompletionRate.toFixed(1)}%`, icon: <FaCheckCircle />, color: '#22c55e' },
                { label: 'Avg Rating', value: `${stats.averageRating.toFixed(1)} ⭐`, icon: <FaArrowUp />, color: '#f59e0b' },
                { label: 'Jobs This Month', value: stats.totalJobsThisMonth, icon: <FaChartBar />, color: '#3b82f6' },
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
          )}

          {/* Sort Controls */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 12, color: '#9ca3af', display: 'block', marginBottom: 8 }}>Sort by</label>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.3)',
                color: '#e5e7eb',
                fontSize: 13,
              }}
            >
              <option value="revenue">Total Revenue</option>
              <option value="jobs">Jobs Completed</option>
              <option value="rating">Customer Rating</option>
              <option value="score">Overall Score</option>
            </select>
          </div>

          {/* Techs Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading performance data...</div>
          ) : techs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af' }}>
              No performance data available
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>Technician</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>Shop</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>Jobs</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>Avg Time/Job</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>Completion Rate</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>Rating</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>Revenue</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTechs.map((tech, idx) => (
                    <tr key={tech.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '16px', color: '#e5e7eb', fontWeight: 500 }}>
                        <div>{idx + 1}. {tech.name}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{tech.email}</div>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>{tech.shop}</td>
                      <td style={{ padding: '16px', textAlign: 'center', color: '#e5e7eb', fontWeight: 600 }}>{tech.jobsCompleted}</td>
                      <td style={{ padding: '16px', textAlign: 'center', color: '#9ca3af' }}>
                        <FaClock style={{ marginRight: 4, verticalAlign: 'middle' }} />
                        {tech.avgTimePerJob.toFixed(1)}h
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <div style={{
                          background: 'rgba(34,197,94,0.15)',
                          color: '#22c55e',
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          display: 'inline-block',
                        }}>
                          {tech.completionRate.toFixed(1)}%
                        </div>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center', color: '#fbbf24', fontWeight: 600 }}>
                        {tech.customerRating.toFixed(1)} ⭐
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center', color: '#ec4899', fontWeight: 600 }}>
                        ${(tech.revenue / 1000).toFixed(1)}K
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <div style={{
                          background: 'rgba(59,130,246,0.15)',
                          color: '#3b82f6',
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          display: 'inline-block',
                        }}>
                          {tech.overallScore.toFixed(0)}/100
                        </div>
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
