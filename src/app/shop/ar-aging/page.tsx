'use client';
import { useState, useEffect } from 'react';
import { FaChartBar, FaRegSmileBeam, FaChevronUp, FaChevronDown, FaPhone } from 'react-icons/fa';
import useRequireAuth from '@/lib/useRequireAuth';

interface ARBucket {
  range: string;
  days: string;
  count: number;
  total: number;
  invoices: ARInvoice[];
}
interface ARInvoice {
  id: string;
  invoiceNumber?: string;
  total: number;
  remaining?: number;
  issueDate?: string;
  daysOutstanding: number;
  customer?: { name?: string; email?: string; phone?: string };
  workOrder?: { vehicle?: string };
}

export default function ARAgingPage() {
  const { user, isLoading } = useRequireAuth(['shop']);
  const [data, setData] = useState<ARBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [totalAR, setTotalAR] = useState(0);
  const [fetchError, setFetchError] = useState('');

  const load = async () => {
    setLoading(true);
    setFetchError('');
    try {
      const token = localStorage.getItem('token');
      const r = await fetch('/api/ar-aging', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const d = await r.json();
        setData(d.buckets || []);
        setTotalAR(d.totalOutstanding || 0);
      } else { setFetchError('Failed to load AR aging data.'); }
    } catch (err: any) { setFetchError(err?.message || 'Network error.'); }
    setLoading(false);
  };

  useEffect(() => { if (!user) return; load(); }, [user]);

  const bucketColor = (range: string) => {
    if (range.includes('0-30')) return { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '#22c55e' };
    if (range.includes('31-60')) return { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '#f59e0b' };
    if (range.includes('61-90')) return { bg: 'rgba(249,115,22,0.15)', color: '#f97316', border: '#f97316' };
    return { bg: 'rgba(229,51,42,0.15)', color: '#e5332a', border: '#e5332a' };
  };

  if (isLoading) return <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div className="centered-app-page" style={{ minHeight: '100vh', background: 'transparent', color: '#e5e7eb', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}><FaChartBar style={{fontSize:26}} /> Accounts Receivable Aging</h1>
        <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 14 }}>Track outstanding balances by age  -  follow up on overdue accounts</p>
      </div>

      <div style={{ padding: '24px 32px 0' }}>
        <div style={{ background: 'linear-gradient(135deg,rgba(229,51,42,0.2),rgba(229,51,42,0.05))', border: '1px solid rgba(229,51,42,0.4)', borderRadius: 14, padding: '18px 24px', display: 'inline-block', marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: '#9ca3af' }}>Total Outstanding</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#fff' }}>${totalAR.toFixed(2)}</div>
        </div>
      </div>

      <div style={{ padding: '0 32px 32px' }}>
        {fetchError && <div style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>{fetchError}</div>}
        {loading ? <div style={{ color: '#6b7280' }}>Loading...</div> :
          data.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <div style={{ fontSize: 64 }}><FaRegSmileBeam /></div>
              <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px' }}>All clear!</div>
              <div style={{ color: '#9ca3af' }}>No outstanding accounts receivable</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 32 }}>
              {data.map(bucket => {
                const c = bucketColor(bucket.range);
                const isOpen = expanded === bucket.range;
                return (
                  <div key={bucket.range} style={{ background: c.bg, border: `1px solid ${c.border}40`, borderRadius: 14 }}>
                    <div onClick={() => setExpanded(isOpen ? null : bucket.range)} style={{ padding: '18px 20px', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: c.color }}>{bucket.range}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>{bucket.count} invoice{bucket.count !== 1 ? 's' : ''}</div>
                      </div>
                      <div style={{ fontSize: 28, fontWeight: 800, margin: '8px 0 4px' }}>${bucket.total.toFixed(2)}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>{bucket.days}</div>
                      {bucket.count > 0 && <div style={{ fontSize: 13, color: c.color, marginTop: 6 }}>Show {isOpen ? <FaChevronUp /> : <FaChevronDown />} {bucket.count} invoice{bucket.count !== 1 ? 's' : ''}</div>}
                    </div>

                    {isOpen && bucket.invoices.length > 0 && (
                      <div style={{ borderTop: `1px solid ${c.border}30`, padding: '12px 16px' }}>
                        {bucket.invoices.map(inv => (
                          <div key={inv.id} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 8, fontSize: 13 }}>
                            <div style={{ fontWeight: 700 }}>{inv.customer?.name || 'Unknown'}</div>
                            {inv.workOrder?.vehicle && <div style={{ color: '#9ca3af' }}>{inv.workOrder.vehicle}</div>}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                              <span style={{ color: c.color, fontWeight: 700 }}>${(inv.remaining ?? inv.total).toFixed(2)}</span>
                              <span style={{ color: '#6b7280' }}>{inv.daysOutstanding}d overdue</span>
                            </div>
                            {inv.customer?.phone && <div style={{ color: '#ff6b64', marginTop: 4 }}><FaPhone style={{marginRight:4}} />{inv.customer.phone}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </div>
  );
}

