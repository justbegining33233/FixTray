'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaUser } from 'react-icons/fa';

interface Summary {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  retentionRate: number;
  avgJobsPerCustomer: string;
  periodDays: number;
}

interface TopCustomer {
  id: string;
  name: string;
  email: string;
  jobCount: number;
  totalSpent: number;
  lastVisit: string;
}

interface AcquisitionPoint {
  month: string;
  count: number;
}

const PERIODS = [
  { label: '30 Days', value: 30 },
  { label: '90 Days', value: 90 },
  { label: '6 Months', value: 180 },
  { label: '1 Year', value: 365 },
];

export default function CustomerReportsPage() {
  const { user, isLoading } = useRequireAuth(['shop']);
  const [shopId, setShopId] = useState('');
  const [days, setDays] = useState(90);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [acquisitionChart, setAcquisitionChart] = useState<AcquisitionPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    const sid = localStorage.getItem('shopId') || user?.id || '';
    setShopId(sid);
  }, [user]);

  useEffect(() => {
    if (shopId) fetchReport();
  }, [shopId, days]);

  const fetchReport = async () => {
    setLoading(true);
    setFetchError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/shop/customer-reports?shopId=${shopId}&days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setSummary(data.summary);
        setTopCustomers(data.topCustomers);
        setAcquisitionChart(data.acquisitionChart);
      } else {
        setFetchError(data.error || 'Failed to load report');
      }
    } catch (err: any) {
      setFetchError(err?.message || 'Failed to load report');
    } finally { setLoading(false); }
  };

  const maxAcq = Math.max(...acquisitionChart.map(p => p.count), 1);

  if (isLoading) return <div style={{ minHeight: "100vh", background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh", background: 'transparent' }}>
      <div style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(229,51,42,0.3)', padding: '16px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/shop/home" style={{ color: '#e5332a', fontSize: 22, fontWeight: 900, textDecoration: 'none' }}>FixTray</Link>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb' }}><FaUser style={{marginRight:4}} /> Customer Reports</h1>
          <Link href="/shop/analytics" style={{ color: '#9aa3b2', fontSize: 13, textDecoration: 'none' }}><FaArrowLeft style={{marginRight:4}} /> Revenue Reports</Link>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px' }}>
        {/* Period selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setDays(p.value)} style={{ padding: '8px 18px', borderRadius: 20, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: days === p.value ? '#e5332a' : 'rgba(255,255,255,0.08)', color: days === p.value ? '#fff' : '#9aa3b2' }}>
              {p.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 80 }}>Loading report...</div>
        ) : fetchError ? (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '16px 20px', color: '#f87171', marginBottom: 24 }}>{fetchError}</div>
        ) : (
          <>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 28 }}>
              {[
                { label: 'Total Customers', value: summary?.totalCustomers, color: '#e5332a' },
                { label: `New (${days}d)`, value: summary?.newCustomers, color: '#22c55e' },
                { label: 'Returning', value: summary?.returningCustomers, color: '#f59e0b' },
                { label: 'Retention Rate', value: `${summary?.retentionRate ?? ' - '}%`, color: '#a855f7' },
                { label: 'Avg Jobs/Customer', value: summary?.avgJobsPerCustomer, color: '#06b6d4' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '20px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 900, color }}>{value}</div>
                  <div style={{ fontSize: 12, color: '#9aa3b2', marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Acquisition chart */}
            {acquisitionChart.length > 0 && (
              <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 24, marginBottom: 28 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#e5e7eb', marginBottom: 20 }}>New Customer Acquisition (Monthly)</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140 }}>
                  {acquisitionChart.map(pt => (
                    <div key={pt.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{ fontSize: 11, color: '#9aa3b2' }}>{pt.count}</div>
                      <div style={{ width: '100%', borderRadius: '4px 4px 0 0', background: 'linear-gradient(to top, #e5332a, #ff6b64)', height: `${Math.max((pt.count / maxAcq) * 100, 4)}%`, minHeight: 4 }} />
                      <div style={{ fontSize: 10, color: '#6b7280', transform: 'rotate(-30deg)', transformOrigin: 'center', whiteSpace: 'nowrap' }}>
                        {pt.month.slice(5)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top customers table */}
            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#e5e7eb' }}>Top Customers by Jobs</div>
              </div>
              {topCustomers.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#9aa3b2' }}>No customer data yet</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                      {['#', 'Customer', 'Email', 'Jobs', 'Total Spent', 'Last Visit'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#9aa3b2', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topCustomers.map((c, i) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '12px 16px', color: '#9aa3b2', fontSize: 13 }}>{i + 1}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: '#e5e7eb', fontSize: 14 }}>{c.name}</div>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#9aa3b2', fontSize: 13 }}>{c.email}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'inline-block', background: 'rgba(229,51,42,0.15)', color: '#ff6b64', borderRadius: 12, padding: '2px 10px', fontSize: 13, fontWeight: 600 }}>{c.jobCount}</div>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#22c55e', fontSize: 14, fontWeight: 600 }}>
                          ${c.totalSpent.toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#9aa3b2', fontSize: 13 }}>
                          {new Date(c.lastVisit).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

