'use client';
import { usePhrase } from '@/lib/usePhrase';
import { FaArrowLeft } from 'react-icons/fa';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import { useRequireAuth } from '@/contexts/AuthContext';
import { formatSlaCompliance, slaComplianceRate } from '@/lib/slaMetrics';

interface TechStat {
  techId: string;
  name: string;
  totalJobs: number;
  onTime: number;
  late: number;
  revenue: number;
  avgHours: number;
  slaComplianceRate: number | null;
}

interface SLAData {
  complianceRate: number | null;
  avgCompletionHours: number;
  totalCompleted: number;
  onTime: number;
  late: number;
  statusBreakdown: Record<string, number>;
  techPerformance: TechStat[];
}

export default function SLAAnalyticsPage() {
  const say = usePhrase();
  const { user, isLoading } = useRequireAuth(['shop']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [data, setData] = useState<SLAData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (!user) return;
    fetchSLA();
    const interval = setInterval(fetchSLA, 60 * 1000);

    return () => clearInterval(interval);
  }, [user, days]);

  const normalize = (raw: any): SLAData => {
    const overview = raw?.overview ?? raw ?? {};
    const techRows = Array.isArray(raw?.techPerformance) ? raw.techPerformance : [];
    const techPerformance: TechStat[] = techRows.map((t: any) => {
      const totalJobs = Number(t.totalJobs ?? t.completedJobs ?? 0);
      const withDueDate = Number(t.withDueDate ?? 0);
      const onTime = Number(t.onTime ?? 0);
      const rate = t.slaComplianceRate === null || t.slaComplianceRate === undefined
        ? slaComplianceRate(onTime, withDueDate)
        : (typeof t.slaComplianceRate === 'number' ? t.slaComplianceRate : null);
      return {
        techId: String(t.techId ?? ''),
        name: String(t.name ?? 'Unknown'),
        totalJobs,
        onTime,
        late: Math.max(0, withDueDate - onTime),
        revenue: Number(t.revenue ?? 0),
        avgHours: Number(t.avgHours ?? t.avgCompletionHours ?? 0),
        slaComplianceRate: withDueDate <= 0 ? null : rate,
      };
    });

    const onTime = Number(overview.onTime ?? overview.onTimeCount ?? 0);
    const late = Number(overview.late ?? overview.lateCount ?? 0);
    const explicitRate = overview.slaComplianceRate ?? overview.complianceRate;
    const complianceRate = (onTime + late) <= 0
      ? null
      : (typeof explicitRate === 'number' ? explicitRate : slaComplianceRate(onTime, onTime + late));
    return {
      complianceRate,
      avgCompletionHours: Number(overview.avgCompletionHours ?? 0),
      totalCompleted: Number(overview.totalCompleted ?? overview.completedWorkOrders ?? 0),
      onTime,
      late,
      statusBreakdown: raw?.statusBreakdown ?? {},
      techPerformance,
    };
  };

  const fetchSLA = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/analytics/sla?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setData(normalize(json));
      }
    } catch (e) {
      console.error('Failed to fetch SLA data:', e);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>{say("Loading...")}</div>;
  if (!user) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="shop" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton />
        <main style={{ flex: 1, padding: '24px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <Link href="/shop/analytics" style={{ color: '#ff6b64', textDecoration: 'none', fontSize: 14 }}><FaArrowLeft style={{marginRight:4}} /> {say("Reports")}</Link>
              <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginTop: 4 }}>{say("SLA & Performance Metrics")}</h1>
              <p style={{ color: '#9ca3af', fontSize: 14 }}>{say("Track service level compliance and team efficiency")}</p>
            </div>
            <select
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              style={{ background: '#1e293b', color: '#e5e7eb', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', fontSize: 14 }}
            >
              <option value={7}>{say("Last 7 days")}</option>
              <option value={14}>{say("Last 14 days")}</option>
              <option value={30}>{say("Last 30 days")}</option>
              <option value={60}>{say("Last 60 days")}</option>
              <option value={90}>{say("Last 90 days")}</option>
            </select>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>{say("Loading SLA data...")}</div>
          ) : !data ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>{say("No data available")}</div>
          ) : (
            <>
              {/* KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
                <div style={{ background: '#1e293b', borderRadius: 12, padding: 20, border: '1px solid #334155' }}>
                  <div style={{ color: '#9ca3af', fontSize: 13, marginBottom: 4 }}>{say("SLA Compliance")}</div>
                  <div style={{ color: data.complianceRate == null ? '#9ca3af' : data.complianceRate >= 80 ? '#22c55e' : data.complianceRate >= 60 ? '#eab308' : '#ef4444', fontSize: 32, fontWeight: 700 }}>
                    {formatSlaCompliance(data.complianceRate)}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>{data.complianceRate == null ? say("No completed jobs with a due date") : `${data.onTime} on-time / ${data.totalCompleted} completed`}</div>
                </div>
                <div style={{ background: '#1e293b', borderRadius: 12, padding: 20, border: '1px solid #334155' }}>
                  <div style={{ color: '#9ca3af', fontSize: 13, marginBottom: 4 }}>{say("Avg. Completion Time")}</div>
                  <div style={{ color: '#ff6b64', fontSize: 32, fontWeight: 700 }}>{data.avgCompletionHours.toFixed(1)}h</div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>{say("Average hours per job")}</div>
                </div>
                <div style={{ background: '#1e293b', borderRadius: 12, padding: 20, border: '1px solid #334155' }}>
                  <div style={{ color: '#9ca3af', fontSize: 13, marginBottom: 4 }}>{say("On Time")}</div>
                  <div style={{ color: '#22c55e', fontSize: 32, fontWeight: 700 }}>{say(data.onTime)}</div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>{say("Jobs completed on schedule")}</div>
                </div>
                <div style={{ background: '#1e293b', borderRadius: 12, padding: 20, border: '1px solid #334155' }}>
                  <div style={{ color: '#9ca3af', fontSize: 13, marginBottom: 4 }}>{say("Late")}</div>
                  <div style={{ color: '#ef4444', fontSize: 32, fontWeight: 700 }}>{say(data.late)}</div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>{say("Jobs past due date")}</div>
                </div>
              </div>

              {/* Status Breakdown */}
              <div style={{ background: '#1e293b', borderRadius: 12, padding: 24, border: '1px solid #334155', marginBottom: 32 }}>
                <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 600, marginBottom: 16 }}>{say("Status Breakdown")}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                  {Object.entries(data.statusBreakdown).map(([status, count]) => (
                    <div key={status} style={{ background: '#000000', borderRadius: 8, padding: 16, textAlign: 'center' }}>
                      <div style={{ color: '#9ca3af', fontSize: 12, textTransform: 'capitalize', marginBottom: 4 }}>{status.replace(/_/g, ' ')}</div>
                      <div style={{ color: '#e5e7eb', fontSize: 24, fontWeight: 700 }}>{say(count)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Per-Tech Table */}
              <div style={{ background: '#1e293b', borderRadius: 12, padding: 24, border: '1px solid #334155' }}>
                <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 600, marginBottom: 16 }}>{say("Technician Performance")}</h2>
                {data.techPerformance.length === 0 ? (
                  <p style={{ color: '#6b7280' }}>{say("No technician data for this period")}</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #334155' }}>
                          <th style={{ textAlign: 'left', padding: '10px 12px', color: '#9ca3af', fontSize: 13, fontWeight: 500 }}>{say("Technician")}</th>
                          <th style={{ textAlign: 'center', padding: '10px 12px', color: '#9ca3af', fontSize: 13, fontWeight: 500 }}>{say("Jobs")}</th>
                          <th style={{ textAlign: 'center', padding: '10px 12px', color: '#9ca3af', fontSize: 13, fontWeight: 500 }}>{say("On Time")}</th>
                          <th style={{ textAlign: 'center', padding: '10px 12px', color: '#9ca3af', fontSize: 13, fontWeight: 500 }}>{say("Late")}</th>
                          <th style={{ textAlign: 'center', padding: '10px 12px', color: '#9ca3af', fontSize: 13, fontWeight: 500 }}>{say("Compliance")}</th>
                          <th style={{ textAlign: 'right', padding: '10px 12px', color: '#9ca3af', fontSize: 13, fontWeight: 500 }}>{say("Revenue")}</th>
                          <th style={{ textAlign: 'right', padding: '10px 12px', color: '#9ca3af', fontSize: 13, fontWeight: 500 }}>{say("Avg Hours")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.techPerformance.map(tech => {
                          const compliance = tech.slaComplianceRate;
                          return (
                            <tr key={tech.techId} style={{ borderBottom: '1px solid #1e293b' }}>
                              <td style={{ padding: '10px 12px', color: '#e5e7eb', fontSize: 14 }}>{say(tech.name)}</td>
                              <td style={{ padding: '10px 12px', color: '#e5e7eb', fontSize: 14, textAlign: 'center' }}>{say(tech.totalJobs)}</td>
                              <td style={{ padding: '10px 12px', color: '#22c55e', fontSize: 14, textAlign: 'center' }}>{say(tech.onTime)}</td>
                              <td style={{ padding: '10px 12px', color: '#ef4444', fontSize: 14, textAlign: 'center' }}>{say(tech.late)}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <span style={{
                                  padding: '2px 8px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                                  background: compliance == null ? '#1f2937' : compliance >= 80 ? '#052e16' : compliance >= 60 ? '#422006' : '#450a0a',
                                  color: compliance == null ? '#9ca3af' : compliance >= 80 ? '#22c55e' : compliance >= 60 ? '#eab308' : '#ef4444',
                                }}>{formatSlaCompliance(compliance)}</span>
                              </td>
                              <td style={{ padding: '10px 12px', color: '#e5e7eb', fontSize: 14, textAlign: 'right' }}>${tech.revenue.toFixed(2)}</td>
                              <td style={{ padding: '10px 12px', color: '#e5e7eb', fontSize: 14, textAlign: 'right' }}>{tech.avgHours.toFixed(1)}h</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}


