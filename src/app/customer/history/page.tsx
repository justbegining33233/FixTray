'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaStar } from 'react-icons/fa';

interface HistoryItem {
  id: string;
  service: string;
  shop: string;
  vehicle: string;
  date: string;
  cost: number;
  rating: number;
  status: string;
}

export default function History() {
  useRequireAuth(['customer']);
  const [userName, setUserName] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchHistory = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch('/api/workorders?status=closed', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const orders = data.workOrders ?? data ?? [];
        const mapped: HistoryItem[] = orders.map((wo: any) => ({
          id: wo.id,
          service: wo.issueDescription || 'Service',
          shop: wo.shop?.shopName || 'Shop',
          vehicle: wo.vehicle ? `${wo.vehicle.year || ''} ${wo.vehicle.make || ''} ${wo.vehicle.model || ''}`.trim() : 'Vehicle',
          date: wo.completedAt ? new Date(wo.completedAt).toLocaleDateString() : new Date(wo.updatedAt).toLocaleDateString(),
          cost: wo.amountPaid || wo.estimatedCost || 0,
          rating: wo.review?.rating || 0,
          status: wo.status,
        }));
        setHistory(mapped);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const name = localStorage.getItem('userName') || '';
    setUserName(name);
    fetchHistory();
  }, [fetchHistory]);

  const handleSignOut = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    window.location.href = '/auth/login';
  };

  const renderStars = (rating: number) => {
    return Array.from({length: rating}, (_, i) => <FaStar key={i} />);
  };

  const filteredHistory = history.filter((item) => {
    const normalizedSearch = search.trim().toLowerCase();
    const itemDate = new Date(item.date);

    if (statusFilter !== 'all' && item.status.toLowerCase() !== statusFilter) {
      return false;
    }

    if (fromDate && itemDate < new Date(fromDate)) {
      return false;
    }

    if (toDate) {
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      if (itemDate > endDate) return false;
    }

    if (!normalizedSearch) return true;

    return (
      item.service.toLowerCase().includes(normalizedSearch) ||
      item.shop.toLowerCase().includes(normalizedSearch) ||
      item.vehicle.toLowerCase().includes(normalizedSearch)
    );
  });

  const totalSpend = filteredHistory.reduce((sum, item) => sum + item.cost, 0);
  const averageSpend = filteredHistory.length ? totalSpend / filteredHistory.length : 0;
  const latestServiceDate = filteredHistory.length > 0
    ? filteredHistory
        .map((item) => new Date(item.date))
        .sort((a, b) => b.getTime() - a.getTime())[0]
    : null;
  const nextRecommendedDate = latestServiceDate
    ? new Date(latestServiceDate.getTime() + 90 * 24 * 60 * 60 * 1000)
    : null;

  const downloadCsv = () => {
    const headers = ['id', 'service', 'shop', 'vehicle', 'date', 'cost', 'status'];
    const rows = filteredHistory.map((item) => [
      item.id,
      item.service,
      item.shop,
      item.vehicle,
      item.date,
      item.cost.toFixed(2),
      item.status,
    ]);
    const csv = [headers.join(','), ...rows.map((row) => row.map((value) => JSON.stringify(value)).join(','))].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'service-history.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      {/* Header */}
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(229,51,42,0.3)', padding:'16px 32px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{display:'flex', alignItems:'center', gap:24}}>
          <Link href="/customer/dashboard" style={{fontSize:24, fontWeight:900, color:'#e5332a', textDecoration:'none'}}>FixTray</Link>
          <div>
            <div style={{fontSize:20, fontWeight:700, color:'#e5e7eb'}}>Customer Portal</div>
            <div style={{fontSize:12, color:'#9aa3b2'}}>Service History</div>
          </div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:16}}>
          <span style={{fontSize:14, color:'#9aa3b2'}}>Welcome, {userName}</span>
          <button onClick={handleSignOut} style={{padding:'8px 16px', background:'#e5332a', color:'white', border:'none', borderRadius:6, cursor:'pointer', fontSize:13, fontWeight:600}}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={{maxWidth:1200, margin:'0 auto', padding:32}}>
        <h1 style={{fontSize:32, fontWeight:700, color:'#e5e7eb', marginBottom:32}}>Service History</h1>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 12 }}>
            <div style={{ color: '#9aa3b2', fontSize: 12 }}>Completed Services</div>
            <div style={{ color: '#e5e7eb', fontSize: 22, fontWeight: 700 }}>{filteredHistory.length}</div>
          </div>
          <div style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: 12 }}>
            <div style={{ color: '#86efac', fontSize: 12 }}>Total Spend</div>
            <div style={{ color: '#dcfce7', fontSize: 22, fontWeight: 700 }}>${totalSpend.toFixed(2)}</div>
          </div>
          <div style={{ background: 'rgba(229,51,42,0.12)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 10, padding: 12 }}>
            <div style={{ color: '#ffb4ad', fontSize: 12 }}>Average Ticket</div>
            <div style={{ color: '#ffe4e1', fontSize: 22, fontWeight: 700 }}>${averageSpend.toFixed(2)}</div>
          </div>
          <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: 12 }}>
            <div style={{ color: '#fcd34d', fontSize: 12 }}>Maintenance Recommendation</div>
            <div style={{ color: '#fef3c7', fontSize: 16, fontWeight: 700 }}>
              {nextRecommendedDate ? nextRecommendedDate.toLocaleDateString() : 'After first completed service'}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 10, marginBottom: 20 }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search service, shop, or vehicle" style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.25)', color: '#e5e7eb' }} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.25)', color: '#e5e7eb' }}>
            <option value="all">All Statuses</option>
            <option value="closed">Closed</option>
            <option value="completed">Completed</option>
            <option value="waiting-for-payment">Waiting for Payment</option>
          </select>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.25)', color: '#e5e7eb' }} />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.25)', color: '#e5e7eb' }} />
          <button onClick={downloadCsv} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(229,51,42,0.4)', background: 'rgba(229,51,42,0.2)', color: '#ffb4ad', cursor: 'pointer', fontWeight: 700 }}>
            Export CSV
          </button>
        </div>

        <div style={{display:'flex', flexDirection:'column', gap:16}}>
          {filteredHistory.map(item => (
            <div key={item.id} style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16}}>
                <div>
                  <h3 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:4}}>{item.service}</h3>
                  <div style={{fontSize:16, color:'#e5332a', fontWeight:600, marginBottom:4}}>{item.shop}</div>
                  <div style={{fontSize:14, color:'#9aa3b2', marginBottom:4}}>Timeline: {item.vehicle} - {item.date}</div>
                  <div style={{fontSize:14, color:'#9aa3b2', marginBottom:8}}>${item.cost.toFixed(2)}</div>
                  <div style={{fontSize:16, marginBottom:8}}>{renderStars(item.rating)}</div>
                </div>
                <span style={{
                  padding:'6px 12px',
                  background:'rgba(34,197,94,0.2)',
                  color:'#22c55e',
                  borderRadius:12,
                  fontSize:12,
                  fontWeight:600
                }}>
                  {item.status}
                </span>
              </div>
              <div style={{display:'flex', gap:12}}>
                <button style={{
                  padding:'8px 16px',
                  background:'#e5332a',
                  color:'white',
                  border:'none',
                  borderRadius:6,
                  fontSize:14,
                  fontWeight:600,
                  cursor:'pointer'
                }}>
                  View Details
                </button>
                <button style={{
                  padding:'8px 16px',
                  background:'rgba(245,158,11,0.1)',
                  color:'#f59e0b',
                  border:'1px solid rgba(245,158,11,0.3)',
                  borderRadius:6,
                  fontSize:14,
                  fontWeight:600,
                  cursor:'pointer'
                }}>
                  Book Again
                </button>
                <button style={{
                  padding:'8px 16px',
                  background:'rgba(168,85,247,0.1)',
                  color:'#a855f7',
                  border:'1px solid rgba(168,85,247,0.3)',
                  borderRadius:6,
                  fontSize:14,
                  fontWeight:600,
                  cursor:'pointer'
                }}>
                  Download Invoice
                </button>
              </div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{textAlign:'center', padding:40, color:'#9aa3b2'}}>Loading service history...</div>
        ) : filteredHistory.length === 0 ? (
          <div style={{textAlign:'center', padding:40, color:'#9aa3b2'}}>
            No services match your filters. Try expanding the date range or clearing search.
          </div>
        ) : null}

        {/* Back to Dashboard */}
        <div style={{marginTop:32, textAlign:'center'}}>
          <Link href="/customer/dashboard" style={{
            padding:'12px 24px',
            background:'#e5332a',
            color:'white',
            border:'none',
            borderRadius:8,
            fontSize:16,
            fontWeight:600,
            textDecoration:'none',
            cursor:'pointer'
          }}>
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
