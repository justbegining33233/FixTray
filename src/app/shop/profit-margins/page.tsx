'use client';
import { useState, useEffect } from 'react';
import useRequireAuth from '@/lib/useRequireAuth';
import { FaChartBar, FaChartLine, FaExclamationTriangle } from 'react-icons/fa';

interface MarginData {
  days: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  marginPct: number;
  workOrders: WOMargin[];
}
interface WOMargin {
  id: string;
  invoiceNumber?: string;
  vehicle?: string;
  customer?: string;
  revenue: number;
  partsCost: number;
  laborCost: number;
  totalCost: number;
  profit: number;
  margin: number;
  completedAt?: string;
}

function normalizeMargins(raw: any, days: number): MarginData {
  if (raw?.summary && Array.isArray(raw?.orders)) {
    const workOrders: WOMargin[] = raw.orders.map((o: any) => ({
      id: String(o.id),
      invoiceNumber: o.invoiceNumber,
      vehicle: o.vehicle,
      customer: o.customer,
      revenue: Number(o.revenue ?? 0),
      partsCost: Number(o.partsCost ?? 0),
      laborCost: Number(o.laborCost ?? 0),
      totalCost: Number(o.totalCost ?? 0),
      profit: Number(o.profit ?? o.grossProfit ?? 0),
      margin: Number(o.margin ?? 0),
      completedAt: o.completedAt,
    }));

    return {
      days,
      totalRevenue: Number(raw.summary.totalRevenue ?? 0),
      totalCost: Number(raw.summary.totalCost ?? 0),
      totalProfit: Number(raw.summary.totalProfit ?? 0),
      marginPct: Number(raw.summary.avgMargin ?? 0),
      workOrders,
    };
  }

  return {
    days: Number(raw?.days ?? days),
    totalRevenue: Number(raw?.totalRevenue ?? 0),
    totalCost: Number(raw?.totalCost ?? 0),
    totalProfit: Number(raw?.totalProfit ?? 0),
    marginPct: Number(raw?.marginPct ?? 0),
    workOrders: Array.isArray(raw?.workOrders) ? raw.workOrders : [],
  };
}

export default function ProfitMarginsPage() {
  const { user, isLoading } = useRequireAuth(['shop']);
  const [data, setData] = useState<MarginData | null>(null);
  const [loading, setLoading] = useState(true);
  const [marginError, setMarginError] = useState('');
  const [days, setDays] = useState(30);
  const [sort, setSort] = useState<'margin' | 'profit' | 'revenue'>('profit');

  useEffect(() => { if (!user) return; load(); }, [user, days]);

  const load = async () => {
    setLoading(true);
    setMarginError('');
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`/api/profit-margins?days=${days}`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const raw = await r.json();
        setData(normalizeMargins(raw, days));
      }
      else setMarginError('Failed to load profit margin data. Please try again.');
    } catch {
      setMarginError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const sorted = data?.workOrders?.slice().sort((a, b) => {
    if (sort === 'margin') return b.margin - a.margin;
    if (sort === 'profit') return b.profit - a.profit;
    return b.revenue - a.revenue;
  }) || [];

  const avg = data && data.workOrders.length > 0 ? data.marginPct : 0;
  const marginColor = avg >= 50 ? '#22c55e' : avg >= 30 ? '#f59e0b' : '#e5332a';

  if (isLoading) return <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div className="centered-app-page" style={{ minHeight: '100vh', background: 'transparent', color: '#e5e7eb', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}><FaChartLine style={{marginRight:4}} /> Profit Margins</h1>
          <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 14 }}>Per-job profitability analysis  -  identify your most and least profitable work</p>
        </div>
        <select value={days} onChange={e => setDays(Number(e.target.value))}
          style={{ background: '#374151', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '9px 14px', color: '#e5e7eb', fontSize: 14, cursor: 'pointer' }}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last 12 months</option>
        </select>
      </div>

      {loading ? <div style={{ padding: 48, color: '#6b7280', textAlign: 'center' }}>Loading...</div> : marginError ? (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}><FaExclamationTriangle style={{marginRight:4}} /></div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginBottom: 8 }}>Unable to Load Data</div>
          <div style={{ color: '#9ca3af', fontSize: 14, marginBottom: 24 }}>{marginError}</div>
          <button onClick={load} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Retry</button>
        </div>
      ) : !data ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#6b7280' }}>No profit margin data found for this period.</div>
      ) : (
        <div style={{ padding: 32 }}>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
            {[
              { label: 'Total Revenue', value: `$${data.totalRevenue.toFixed(2)}`, icon: '', color: '#ff6b64' },
              { label: 'Total Cost', value: `$${data.totalCost.toFixed(2)}`, icon: '', color: '#f59e0b' },
              { label: 'Gross Profit', value: `$${data.totalProfit.toFixed(2)}`, icon: '', color: '#22c55e' },
              { label: 'Avg Margin', value: `${avg.toFixed(1)}%`, icon: '', color: marginColor },
              { label: 'Jobs Analyzed', value: String(data.workOrders.length), icon: '', color: '#a78bfa' },
            ].map(c => (
              <div key={c.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 22 }}>{c.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: c.color, margin: '6px 0 2px' }}>{c.value}</div>
                <div style={{ fontSize: 13, color: '#9ca3af' }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* Sort Controls */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#9ca3af' }}>Sort by:</span>
            {(['profit', 'revenue', 'margin'] as const).map(s => (
              <button key={s} onClick={() => setSort(s)}
                style={{ background: sort === s ? '#e5332a' : 'rgba(255,255,255,0.06)', color: sort === s ? '#fff' : '#9ca3af', border: `1px solid ${sort === s ? '#e5332a' : 'rgba(255,255,255,0.12)'}`, borderRadius: 7, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>{s}</button>
            ))}
          </div>

          {sorted.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <div style={{ fontSize: 64 }}><FaChartBar style={{marginRight:4}} /></div>
              <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px' }}>No data for this period</div>
              <div style={{ color: '#9ca3af' }}>Complete work orders with invoices to see profit margins</div>
            </div>
          ) : (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px', gap: 0, padding: '10px 16px', background: 'rgba(0,0,0,0.3)', fontSize: 12, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                <span>Job</span><span style={{ textAlign: 'right' }}>Revenue</span><span style={{ textAlign: 'right' }}>Parts</span><span style={{ textAlign: 'right' }}>Labor</span><span style={{ textAlign: 'right' }}>Profit</span><span style={{ textAlign: 'right' }}>Margin</span>
              </div>
              {sorted.map(wo => {
                const m = wo.margin;
                const mc = m >= 50 ? '#22c55e' : m >= 30 ? '#f59e0b' : '#e5332a';
                return (
                  <div key={wo.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px', gap: 0, padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{wo.vehicle || 'Vehicle'}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>{wo.customer || ''}{wo.invoiceNumber ? `  #${wo.invoiceNumber}` : ''}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 700 }}>${wo.revenue.toFixed(0)}</div>
                    <div style={{ textAlign: 'right', color: '#9ca3af', fontSize: 13 }}>${wo.partsCost.toFixed(0)}</div>
                    <div style={{ textAlign: 'right', color: '#9ca3af', fontSize: 13 }}>${wo.laborCost.toFixed(0)}</div>
                    <div style={{ textAlign: 'right', color: '#22c55e', fontWeight: 700 }}>${wo.profit.toFixed(0)}</div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ background: `${mc}20`, color: mc, border: `1px solid ${mc}`, borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{m.toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

