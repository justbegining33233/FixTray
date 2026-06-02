'use client';
import { FaArrowLeft } from 'react-icons/fa';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import { useRequireAuth } from '@/contexts/AuthContext';

interface TechPerf {
  techId: string;
  name: string;
  shopName: string;
  totalJobs: number;
  completedJobs: number;
  completionRate: number;
  slaComplianceRate: number;
  revenue: number;
  hoursWorked: number;
  revenuePerHour: number;
}

export default function EmployeePerformancePage() {
  const { user, isLoading } = useRequireAuth(['shop']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [techs, setTechs] = useState<TechPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [sortBy, setSortBy] = useState<'revenue' | 'completionRate' | 'slaComplianceRate' | 'revenuePerHour'>('revenue');

  useEffect(() => {
    if (!user) return;
    fetchPerf();
    const interval = setInterval(fetchPerf, 60 * 1000);

    return () => clearInterval(interval);
  }, [user, days]);

  const fetchPerf = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/analytics/employee-performance?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setTechs(json.techs || []);
      }
    } catch (e) {
      console.error('Failed to fetch performance data:', e);
    } finally {
      setLoading(false);
    }
  };

  const sorted = [...techs].sort((a, b) => b[sortBy] - a[sortBy]);

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="shop" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton />
        <main style={{ flex: 1, padding: '24px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <Link href="/shop/analytics" style={{ color: '#ff6b64', textDecoration: 'none', fontSize: 14 }}><FaArrowLeft style={{marginRight:4}} /> Reports</Link>
              <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginTop: 4 }}>Employee Performance</h1>
              <p style={{ color: '#9ca3af', fontSize: 14 }}>Cross-shop performance comparison</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={days} onChange={e => setDays(Number(e.target.value))}
                style={{ background: '#1e293b', color: '#e5e7eb', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', fontSize: 14 }}>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                style={{ background: '#1e293b', color: '#e5e7eb', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', fontSize: 14 }}>
                <option value="revenue">Sort: Revenue</option>
                <option value="completionRate">Sort: Completion %</option>
                <option value="slaComplianceRate">Sort: SLA %</option>
                <option value="revenuePerHour">Sort: $/Hour</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading performance data...</div>
          ) : sorted.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>No employee data for this period</div>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {sorted.map((tech, i) => (
                <div key={tech.techId} style={{ background: '#1e293b', borderRadius: 12, padding: 20, border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#6b7280', fontSize: 14, fontWeight: 700 }}>#{i + 1}</span>
                        <span style={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>{tech.name}</span>
                      </div>
                      <div style={{ color: '#9ca3af', fontSize: 13, marginTop: 2 }}>{tech.shopName}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#22c55e', fontSize: 22, fontWeight: 700 }}>${tech.revenue.toFixed(2)}</div>
                      <div style={{ color: '#6b7280', fontSize: 12 }}>Revenue</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
                    <div style={{ background: '#000000', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                      <div style={{ color: '#9ca3af', fontSize: 11 }}>Jobs</div>
                      <div style={{ color: '#e5e7eb', fontSize: 20, fontWeight: 700 }}>{tech.totalJobs}</div>
                    </div>
                    <div style={{ background: '#000000', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                      <div style={{ color: '#9ca3af', fontSize: 11 }}>Completed</div>
                      <div style={{ color: '#ff6b64', fontSize: 20, fontWeight: 700 }}>{tech.completionRate.toFixed(0)}%</div>
                    </div>
                    <div style={{ background: '#000000', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                      <div style={{ color: '#9ca3af', fontSize: 11 }}>SLA</div>
                      <div style={{ color: tech.slaComplianceRate >= 80 ? '#22c55e' : '#eab308', fontSize: 20, fontWeight: 700 }}>{tech.slaComplianceRate.toFixed(0)}%</div>
                    </div>
                    <div style={{ background: '#000000', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                      <div style={{ color: '#9ca3af', fontSize: 11 }}>Hours</div>
                      <div style={{ color: '#e5e7eb', fontSize: 20, fontWeight: 700 }}>{tech.hoursWorked.toFixed(1)}</div>
                    </div>
                    <div style={{ background: '#000000', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                      <div style={{ color: '#9ca3af', fontSize: 11 }}>$/Hour</div>
                      <div style={{ color: '#a78bfa', fontSize: 20, fontWeight: 700 }}>${tech.revenuePerHour.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}


