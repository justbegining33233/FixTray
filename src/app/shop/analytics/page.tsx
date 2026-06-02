'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaCheckCircle, FaDollarSign, FaExclamationTriangle, FaStopwatch, FaUsers } from 'react-icons/fa';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function AnalyticsPage() {
  useRequireAuth(['shop']);
  const router = useRouter();
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState('');
  const [shopId, setShopId] = useState('');
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    const id = localStorage.getItem('shopId');

    setShopId(id || '');
    fetchAnalytics(id || '');
    const interval = setInterval(() => fetchAnalytics(id || ''), 60 * 1000);

    return () => clearInterval(interval);
  }, [router, dateRange.start, dateRange.end]);

  const fetchAnalytics = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `/api/analytics?shopId=${id}&startDate=${dateRange.start}&endDate=${dateRange.end}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      } else {
        setAnalyticsError('Failed to load analytics data. Please try again.');
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setAnalyticsError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: 'transparent', padding: '40px 20px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', color: '#fff', textAlign: 'center' }}>
          Loading analytics...
        </div>
      </div>
    );
  }

  if (analyticsError) {
    return (
      <div style={{ minHeight: '100vh', background: 'transparent', padding: '40px 20px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', textAlign: 'center', paddingTop: 80 }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}><FaExclamationTriangle style={{marginRight:4}} /></div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb', marginBottom: 8 }}>Unable to Load Analytics</div>
          <div style={{ color: '#9ca3af', fontSize: 14, marginBottom: 24 }}>{analyticsError}</div>
          <button onClick={() => { setAnalyticsError(''); fetchAnalytics(shopId); }}
            style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: 'transparent', padding: '40px 20px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ color: '#fff', fontSize: 32, margin: 0 }}>Analytics Dashboard</h1>
          <p style={{ color: '#9aa3b2', margin: '8px 0 0 0' }}>Business insights and performance metrics</p>
        </div>

        {/* Date Range Selector */}
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 20, marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
            <div>
              <label style={{ color: '#9aa3b2', display: 'block', marginBottom: 8, fontSize: 13 }}>Start Date</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: '#fff',
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ color: '#9aa3b2', display: 'block', marginBottom: 8, fontSize: 13 }}>End Date</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: '#fff',
                  fontSize: 14,
                }}
              />
            </div>
            <button
              onClick={() => fetchAnalytics(shopId)}
              style={{
                background: '#e5332a',
                color: '#fff',
                border: 'none',
                padding: '10px 24px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Update
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        {analytics?.summary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20, marginBottom: 32 }}>
            <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}><FaDollarSign style={{marginRight:4}} /></div>
              <div style={{ color: '#9aa3b2', fontSize: 13, marginBottom: 4 }}>Total Revenue</div>
              <div style={{ color: '#22c55e', fontSize: 28, fontWeight: 700 }}>
                ${analytics.summary.totalRevenue.toFixed(2)}
              </div>
            </div>

            <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}><FaCheckCircle style={{marginRight:4}} /></div>
              <div style={{ color: '#9aa3b2', fontSize: 13, marginBottom: 4 }}>Completed Jobs</div>
              <div style={{ color: '#e5332a', fontSize: 28, fontWeight: 700 }}>
                {analytics.summary.completedJobs}
              </div>
            </div>

            <div style={{ background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}><FaStopwatch style={{marginRight:4}} /></div>
              <div style={{ color: '#9aa3b2', fontSize: 13, marginBottom: 4 }}>Avg Completion Time</div>
              <div style={{ color: '#a855f7', fontSize: 28, fontWeight: 700 }}>
                {analytics.summary.avgCompletionTime}h
              </div>
            </div>

            <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}><FaUsers style={{marginRight:4}} /></div>
              <div style={{ color: '#9aa3b2', fontSize: 13, marginBottom: 4 }}>Unique Customers</div>
              <div style={{ color: '#eab308', fontSize: 28, fontWeight: 700 }}>
                {analytics.summary.uniqueCustomers}
              </div>
            </div>
          </div>
        )}

        {/* Revenue Chart */}
        {analytics?.charts?.revenue && analytics.charts.revenue.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <h3 style={{ color: '#e5e7eb', marginBottom: 20 }}>Revenue Over Time</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.charts.revenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" stroke="#9aa3b2" />
                <YAxis stroke="#9aa3b2" />
                <Tooltip
                  contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  labelStyle={{ color: '#e5e7eb' }}
                />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} name="Revenue ($)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Completion Time Chart */}
        {analytics?.charts?.completion && analytics.charts.completion.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <h3 style={{ color: '#e5e7eb', marginBottom: 20 }}>Average Completion Time</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.charts.completion}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" stroke="#9aa3b2" />
                <YAxis stroke="#9aa3b2" />
                <Tooltip
                  contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  labelStyle={{ color: '#e5e7eb' }}
                />
                <Legend />
                <Line type="monotone" dataKey="hours" stroke="#e5332a" strokeWidth={2} name="Hours" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tech Performance */}
        {analytics?.charts?.techPerformance && analytics.charts.techPerformance.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 24 }}>
            <h3 style={{ color: '#e5e7eb', marginBottom: 20 }}>Tech Performance</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.charts.techPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="name" stroke="#9aa3b2" />
                <YAxis stroke="#9aa3b2" />
                <Tooltip
                  contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  labelStyle={{ color: '#e5e7eb' }}
                />
                <Legend />
                <Bar dataKey="completed" fill="#e5332a" name="Jobs Completed" />
                <Bar dataKey="revenue" fill="#22c55e" name="Revenue ($)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

