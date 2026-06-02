"use client";

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaChartBar, FaDownload } from 'react-icons/fa';

interface MonthData { month: string; revenue: number; jobs: number; }
interface ServiceData { service: string; jobs: number; revenue: number; }
interface TechData { name: string; jobs: number; revenue: number; }
interface ReportData {
  totalRevenue: number;
  totalJobs: number;
  completedJobs: number;
  pendingJobs: number;
  avgJobValue: number;
  topServices: ServiceData[];
  revenueByMonth: MonthData[];
  techPerformance: TechData[];
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

export default function ShopReportsPage() {
  const { user, isLoading } = useRequireAuth(['shop']);
  const [userRole, setUserRole] = useState('');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [shopId, setShopId] = useState('');


  useEffect(() => {
    if (user?.role) setUserRole(user.role);
    const sid = localStorage.getItem('shopId') || '';
    setShopId(sid);
  }, [user]);

  const fetchReport = useCallback(async (sid: string, year: number, month: number) => {
    if (!sid) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/reports?shopId=${sid}&year=${year}&month=${month}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setReport(data.report);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (shopId) fetchReport(shopId, selectedYear, selectedMonth);
  }, [shopId, selectedYear, selectedMonth, fetchReport]);

  const handleExport = () => {
    if (!report) return;
    const rows: string[] = [
      'FixTray Shop Report',
      `Year,${selectedYear}`,
      `Month,${MONTH_NAMES[selectedMonth - 1]}`,
      '',
      'Summary',
      `Total Revenue,$${report.totalRevenue.toFixed(2)}`,
      `Total Jobs,${report.totalJobs}`,
      `Completed Jobs,${report.completedJobs}`,
      `Pending Jobs,${report.pendingJobs}`,
      `Avg Job Value,$${report.avgJobValue.toFixed(2)}`,
      '',
      'Revenue by Month',
      'Month,Revenue,Jobs',
      ...report.revenueByMonth.map(m => `${m.month},${m.revenue},${m.jobs}`),
      '',
      'Top Services',
      'Service,Jobs,Revenue',
      ...report.topServices.map(s => `${s.service},${s.jobs},$${s.revenue}`),
      '',
      'Tech Performance',
      'Tech,Jobs,Revenue',
      ...report.techPerformance.map(t => `${t.name},${t.jobs},$${t.revenue}`),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${selectedYear}-${String(selectedMonth).padStart(2,'0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getDashboardLink = () => {
    const isShopAdmin = (user as any)?.isShopAdmin;
    if (userRole === 'shop') return isShopAdmin ? '/shop/admin' : '/shop/home';
    if (userRole === 'manager') return '/manager/dashboard';
    if (userRole === 'tech') return '/tech/home';
    return '/dashboard';
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb', fontSize: 18 }}>
        Loading...
      </div>
    );
  }
  if (!user) return null;

  const yearOptions: number[] = [];
  for (let y = currentYear; y >= 2024; y--) yearOptions.push(y);

  const maxRevenue = report ? Math.max(...report.revenueByMonth.map(m => m.revenue), 1) : 1;

  return (
    <div style={{ minHeight: '100vh', background: 'transparent' }}>
      {/* Header */}
      <div style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(245,158,11,0.3)', padding: '20px 32px' }}>
        <div style={{ maxWidth: 1600, margin: '0 auto' }}>
          <Link href={getDashboardLink() as Route} style={{ color: '#3b82f6', textDecoration: 'none', fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'inline-block' }}>
            <FaArrowLeft style={{marginRight:4}} /> Back to Dashboard
          </Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', marginBottom: 8 }}><FaChartBar style={{marginRight:4}} /> Reports & Analytics</h1>
              <p style={{ fontSize: 14, color: '#9aa3b2' }}>Live data from your shop's work orders and payments</p>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} style={{ padding: '10px 16px', background: 'rgba(0,0,0,0.4)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ padding: '10px 16px', background: 'rgba(0,0,0,0.4)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <button onClick={handleExport} disabled={!report} style={{ padding: '10px 20px', background: '#22c55e', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: report ? 'pointer' : 'not-allowed', opacity: report ? 1 : 0.5 }}>
                <FaDownload style={{marginRight:4}} /> Export CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1600, margin: '0 auto', padding: 32 }}>
        {loading && (
          <div style={{ textAlign: 'center', color: '#9aa3b2', fontSize: 16, padding: 48 }}>Loading report data...</div>
        )}

        {!loading && !report && (
          <div style={{ textAlign: 'center', color: '#9aa3b2', fontSize: 16, padding: 48 }}>No data available for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}.</div>
        )}

        {!loading && report && (
          <>
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 32 }}>
              <SummaryCard label="Total Revenue" value={`$${report.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} color="#22c55e" border="rgba(34,197,94,0.3)" sub={`${report.totalJobs} total jobs`} />
              <SummaryCard label="Completed Jobs" value={report.completedJobs} color="#3b82f6" border="rgba(59,130,246,0.3)" sub={`${report.pendingJobs} still pending`} />
              <SummaryCard label="Avg Job Value" value={`$${report.avgJobValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} color="#f59e0b" border="rgba(245,158,11,0.3)" sub="per completed job" />
              <SummaryCard label="Completion Rate" value={report.totalJobs > 0 ? `${Math.round((report.completedJobs / report.totalJobs) * 100)}%` : ' - '} color="#8b5cf6" border="rgba(139,92,246,0.3)" sub={`${report.totalJobs} total jobs`} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 24 }}>
              {/* Revenue Trend */}
              <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb', marginBottom: 20 }}>Revenue Trend  -  {selectedYear}</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {report.revenueByMonth.map((mo, idx) => {
                    const pct = (mo.revenue / maxRevenue) * 100;
                    const isSelected = idx + 1 === selectedMonth;
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 40, fontSize: 12, color: isSelected ? '#f59e0b' : '#9aa3b2', fontWeight: isSelected ? 700 : 500 }}>{mo.month}</div>
                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 8, height: 36, position: 'relative', overflow: 'hidden' }}>
                          <div style={{ background: isSelected ? 'linear-gradient(90deg, #f59e0b, #d97706)' : 'linear-gradient(90deg, #22c55e, #16a34a)', height: '100%', width: `${pct}%`, borderRadius: 8, minWidth: mo.revenue > 0 ? 4 : 0 }} />
                          {mo.revenue > 0 && (
                            <div style={{ position: 'absolute', top: '50%', left: 12, transform: 'translateY(-50%)', fontSize: 13, fontWeight: 700, color: 'white' }}>
                              ${mo.revenue.toLocaleString()}
                            </div>
                          )}
                        </div>
                        <div style={{ width: 64, fontSize: 12, color: '#9aa3b2', textAlign: 'right' }}>{mo.jobs} jobs</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top Services */}
              <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb', marginBottom: 20 }}>Top Services</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {report.topServices.length === 0 && (
                    <div style={{ color: '#6b7280', fontSize: 14 }}>No service data for this period.</div>
                  )}
                  {report.topServices.map((svc, idx) => (
                    <div key={idx} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#e5e7eb' }}>{svc.service}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#22c55e' }}>${svc.revenue.toLocaleString()}</div>
                      </div>
                      <div style={{ fontSize: 12, color: '#9aa3b2' }}>{svc.jobs} jobs</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tech Performance */}
            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb', marginBottom: 20 }}>Technician Performance  -  {MONTH_NAMES[selectedMonth - 1]} {selectedYear}</h2>
              {report.techPerformance.length === 0 ? (
                <div style={{ color: '#6b7280', fontSize: 14 }}>No technician data for this period.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                    <thead>
                      <tr style={{ textAlign: 'left' }}>
                        <th style={{ padding: '8px 16px', color: '#9aa3b2', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Technician</th>
                        <th style={{ padding: '8px 16px', color: '#9aa3b2', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Jobs</th>
                        <th style={{ padding: '8px 16px', color: '#9aa3b2', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.techPerformance.map((tech, idx) => (
                        <tr key={idx} style={{ background: 'rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '12px 16px', color: '#e5e7eb', fontWeight: 700 }}>{tech.name}</td>
                          <td style={{ padding: '12px 16px', color: '#9aa3b2' }}>{tech.jobs}</td>
                          <td style={{ padding: '12px 16px', color: '#22c55e', fontWeight: 700 }}>${tech.revenue.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color, border, sub }: { label: string; value: string | number; color: string; border: string; sub: string }) {
  return (
    <div style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${border}`, borderRadius: 12, padding: 24 }}>
      <div style={{ fontSize: 13, color: '#9aa3b2', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 700, color, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{sub}</div>
    </div>
  );
}
