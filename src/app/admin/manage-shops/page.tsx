'use client';
import { FaArrowLeft, FaBan, FaCheck, FaSyncAlt } from 'react-icons/fa';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';

interface ShopData {
  id: string;
  name: string;
  ownerName: string;
  email: string;
  phone: string;
  location: string;
  shopType: string;
  status: string;
  profileComplete: boolean;
  createdAt: string;
  approvedAt: string | null;
  totalJobs: number;
  completedJobs: number;
  completionRate: number;
  totalRevenue: number;
  revenueThisMonth: number;
  jobsThisMonth: number;
  rating: number;
  reviewCount: number;
  techCount: number;
  activeTechs: number;
  accountStatus?: string;
  activityStatus?: 'active' | 'inactive';
  hasActiveSession?: boolean;
  lastLogin?: string | null;
}

export default function ManageShops() {
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);
  const [shops, setShops] = useState<ShopData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activityFilter, setActivityFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedShop, setSelectedShop] = useState<ShopData | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState<{type:'success'|'error';text:string}|null>(null);

  const fetchShops = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/shops', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setShops(data.shops || []);
      }
    } catch (error) {
      console.error('Error fetching shops:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && user) fetchShops();
  }, [isLoading, user, fetchShops]);

  const handleStatusChange = async (shopId: string, newStatus: string) => {
    setActionLoading(shopId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/shops/${shopId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setShops(prev => prev.map(s => s.id === shopId ? { ...s, status: newStatus } : s));
        setMsg({ type: 'success', text: `Shop status updated to ${newStatus}` });
        if (selectedShop?.id === shopId) setSelectedShop(prev => prev ? { ...prev, status: newStatus } : null);
      } else {
        const err = await res.json();
        setMsg({ type: 'error', text: err.error || 'Failed to update status' });
      }
    } catch (error) {
      console.error('Error updating shop status:', error);
      setMsg({ type: 'error', text: 'Network error' });
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  const filtered = shops.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (activityFilter !== 'all' && (s.activityStatus || 'inactive') !== activityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.ownerName.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.location.toLowerCase().includes(q);
    }
    return true;
  });

  const statusColor = (s: string) => {
    if (s === 'approved') return { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' };
    if (s === 'suspended') return { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' };
    return { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' };
  };

  const activityColor = (s: ShopData['activityStatus']) => {
    if (s === 'active') return { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' };
    return { bg: 'rgba(100,116,139,0.2)', color: '#94a3b8' };
  };

  const counts = {
    all: shops.length,
    approved: shops.filter(s => s.status === 'approved').length,
    pending: shops.filter(s => s.status === 'pending').length,
    suspended: shops.filter(s => s.status === 'suspended').length,
    activeUsage: shops.filter(s => (s.activityStatus || 'inactive') === 'active').length,
    inactiveUsage: shops.filter(s => (s.activityStatus || 'inactive') === 'inactive').length,
  };

  const formatLastLogin = (lastLogin?: string | null) => {
    if (!lastLogin) return 'Never logged in';
    const dt = new Date(lastLogin);
    if (Number.isNaN(dt.getTime())) return 'Unknown';
    return dt.toLocaleString();
  };

  return (
    <div style={{minHeight:'100vh', background:'transparent'}}>
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>Manage Shops</h1>
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(229,51,42,0.3)', padding:'16px 32px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{display:'flex', alignItems:'center', gap:24}}>
          <Link href="/admin/home" style={{fontSize:24, fontWeight:900, color:'#e5332a', textDecoration:'none'}}>FixTray</Link>
          <div>
            <div style={{fontSize:20, fontWeight:700, color:'#e5e7eb'}}>Admin Panel</div>
            <div style={{fontSize:12, color:'#9aa3b2'}}>Manage Shops</div>
          </div>
        </div>
        <Link href="/admin/home" style={{padding:'8px 16px', background:'rgba(255,255,255,0.1)', color:'#e5e7eb', borderRadius:6, textDecoration:'none', fontSize:13, fontWeight:600}}>
          <FaArrowLeft style={{marginRight:4}} /> Back to Dashboard
        </Link>
      </div>

      <div style={{maxWidth:1400, margin:'0 auto', padding:32}}>
        {/* Stats Row */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(170px, 1fr))', gap:16, marginBottom:32}}>
          {[
            { label: 'Total Shops', value: counts.all, color: '#e5332a' },
            { label: 'Active (Using App)', value: counts.activeUsage, color: '#22c55e' },
            { label: 'Inactive (No Recent Login)', value: counts.inactiveUsage, color: '#94a3b8' },
            { label: 'Approved Accounts', value: counts.approved, color: '#10b981' },
            { label: 'Pending', value: counts.pending, color: '#f59e0b' },
            { label: 'Suspended', value: counts.suspended, color: '#ef4444' },
          ].map(stat => (
            <div key={stat.label} style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:20, textAlign:'center'}}>
              <div style={{fontSize:32, fontWeight:800, color:stat.color}}>{stat.value}</div>
              <div style={{fontSize:13, color:'#9aa3b2', fontWeight:600}}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{display:'flex', gap:16, marginBottom:24, flexWrap:'wrap'}}>
          <input
            type="text"
            placeholder="Search shops, owners, emails..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{flex:1, minWidth:250, padding:'10px 16px', background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}}
          />
          {(['all', 'approved', 'pending', 'suspended'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding:'10px 20px', borderRadius:8, border:'none', fontSize:13, fontWeight:600, cursor:'pointer',
              background: statusFilter === s ? '#e5332a' : 'rgba(255,255,255,0.1)',
              color: statusFilter === s ? 'white' : '#9aa3b2',
            }}>
              {s.charAt(0).toUpperCase() + s.slice(1)} ({counts[s]})
            </button>
          ))}
          {(['all', 'active', 'inactive'] as const).map((s) => (
            <button key={`usage-${s}`} onClick={() => setActivityFilter(s)} style={{
              padding:'10px 20px', borderRadius:8, border:'none', fontSize:13, fontWeight:600, cursor:'pointer',
              background: activityFilter === s ? '#22c55e' : 'rgba(255,255,255,0.1)',
              color: activityFilter === s ? 'white' : '#9aa3b2',
            }}>
              {s === 'all' ? 'All Usage' : s === 'active' ? `Active Usage (${counts.activeUsage})` : `Inactive Usage (${counts.inactiveUsage})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{textAlign:'center', padding:60, color:'#9aa3b2'}}>Loading shops...</div>
        ) : (
          <div style={{display:'grid', gap:16}}>
            {filtered.length === 0 ? (
              <div style={{textAlign:'center', padding:40, color:'#9aa3b2'}}>No shops found</div>
            ) : filtered.map(shop => (
              <div key={shop.id} style={{
                background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24,
                cursor:'pointer', transition:'border-color 0.2s',
              }} onClick={() => setSelectedShop(selectedShop?.id === shop.id ? null : shop)}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:16}}>
                  <div style={{flex:1, minWidth:200}}>
                    <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:8}}>
                      <h3 style={{fontSize:18, fontWeight:700, color:'#e5e7eb', margin:0}}>{shop.name}</h3>
                      <span style={{...statusColor(shop.status), padding:'3px 10px', borderRadius:12, fontSize:11, fontWeight:700, textTransform:'uppercase' as const}}>
                        account: {shop.status}
                      </span>
                      <span style={{...activityColor(shop.activityStatus), padding:'3px 10px', borderRadius:12, fontSize:11, fontWeight:700, textTransform:'uppercase' as const}}>
                        usage: {shop.activityStatus || 'inactive'}
                      </span>
                    </div>
                    <div style={{fontSize:13, color:'#9aa3b2'}}>{shop.ownerName}  {shop.email}  {shop.phone}</div>
                    <div style={{fontSize:13, color:'#6b7280', marginTop:4}}>{shop.location}  {shop.shopType}</div>
                    <div style={{fontSize:12, color:'#94a3b8', marginTop:6}}>
                      Last login: {formatLastLogin(shop.lastLogin)}
                    </div>
                  </div>
                  <div style={{display:'flex', gap:24, flexWrap:'wrap'}}>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:20, fontWeight:700, color:'#e5332a'}}>{shop.totalJobs}</div>
                      <div style={{fontSize:11, color:'#9aa3b2'}}>Jobs</div>
                    </div>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:20, fontWeight:700, color:'#22c55e'}}>${shop.totalRevenue.toLocaleString()}</div>
                      <div style={{fontSize:11, color:'#9aa3b2'}}>Revenue</div>
                    </div>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:20, fontWeight:700, color:'#f59e0b'}}>{shop.rating > 0 ? `${shop.rating}<FaStar style={{marginRight:4}} />` : 'N/A'}</div>
                      <div style={{fontSize:11, color:'#9aa3b2'}}>{shop.reviewCount} reviews</div>
                    </div>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:20, fontWeight:700, color:'#a78bfa'}}>{shop.techCount}</div>
                      <div style={{fontSize:11, color:'#9aa3b2'}}>Techs</div>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedShop?.id === shop.id && (
                  <div style={{marginTop:20, paddingTop:20, borderTop:'1px solid rgba(255,255,255,0.1)'}} onClick={e => e.stopPropagation()}>
                    <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:16, marginBottom:20}}>
                      <div style={{background:'rgba(255,255,255,0.05)', borderRadius:8, padding:16}}>
                        <div style={{fontSize:12, color:'#9aa3b2', marginBottom:4}}>Completion Rate</div>
                        <div style={{fontSize:22, fontWeight:700, color:'#22c55e'}}>{shop.completionRate}%</div>
                      </div>
                      <div style={{background:'rgba(255,255,255,0.05)', borderRadius:8, padding:16}}>
                        <div style={{fontSize:12, color:'#9aa3b2', marginBottom:4}}>Revenue This Month</div>
                        <div style={{fontSize:22, fontWeight:700, color:'#e5332a'}}>${shop.revenueThisMonth.toLocaleString()}</div>
                      </div>
                      <div style={{background:'rgba(255,255,255,0.05)', borderRadius:8, padding:16}}>
                        <div style={{fontSize:12, color:'#9aa3b2', marginBottom:4}}>Jobs This Month</div>
                        <div style={{fontSize:22, fontWeight:700, color:'#f59e0b'}}>{shop.jobsThisMonth}</div>
                      </div>
                      <div style={{background:'rgba(255,255,255,0.05)', borderRadius:8, padding:16}}>
                        <div style={{fontSize:12, color:'#9aa3b2', marginBottom:4}}>Platform Access</div>
                        <div style={{fontSize:16, fontWeight:700, color:'#a78bfa'}}>Standard</div>
                      </div>
                      <div style={{background:'rgba(255,255,255,0.05)', borderRadius:8, padding:16}}>
                        <div style={{fontSize:12, color:'#9aa3b2', marginBottom:4}}>Active Techs</div>
                        <div style={{fontSize:22, fontWeight:700, color:'#22c55e'}}>{shop.activeTechs} / {shop.techCount}</div>
                      </div>
                      <div style={{background:'rgba(255,255,255,0.05)', borderRadius:8, padding:16}}>
                        <div style={{fontSize:12, color:'#9aa3b2', marginBottom:4}}>Joined</div>
                        <div style={{fontSize:14, fontWeight:600, color:'#e5e7eb'}}>{new Date(shop.createdAt).toLocaleDateString()}</div>
                      </div>
                      <div style={{background:'rgba(255,255,255,0.05)', borderRadius:8, padding:16}}>
                        <div style={{fontSize:12, color:'#9aa3b2', marginBottom:4}}>Latest Login Activity</div>
                        <div style={{fontSize:14, fontWeight:600, color:'#e5e7eb'}}>{formatLastLogin(shop.lastLogin)}</div>
                      </div>
                    </div>

                    <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
                      <Link href={`/admin/shop-details/${shop.id}`} style={{
                        padding:'10px 20px', background:'#e5332a', color:'white', borderRadius:8, fontSize:13, fontWeight:600, textDecoration:'none',
                      }}>
                        View Full Details
                      </Link>
                      {shop.status !== 'approved' && (
                        <button onClick={() => handleStatusChange(shop.id, 'approved')} disabled={actionLoading === shop.id} style={{
                          padding:'10px 20px', background:'#22c55e', color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', opacity: actionLoading === shop.id ? 0.6 : 1,
                        }}>
                          {actionLoading === shop.id ? 'Updating...' : <><FaCheck style={{marginRight:4}} /> Approve</>}
                        </button>
                      )}
                      {shop.status !== 'suspended' && (
                        <button onClick={() => handleStatusChange(shop.id, 'suspended')} disabled={actionLoading === shop.id} style={{
                          padding:'10px 20px', background:'#ef4444', color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', opacity: actionLoading === shop.id ? 0.6 : 1,
                        }}>
                          {actionLoading === shop.id ? 'Updating...' : <><FaBan style={{marginRight:4}} /> Suspend</>}
                        </button>
                      )}
                      {shop.status === 'suspended' && (
                        <button onClick={() => handleStatusChange(shop.id, 'pending')} disabled={actionLoading === shop.id} style={{
                          padding:'10px 20px', background:'#f59e0b', color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', opacity: actionLoading === shop.id ? 0.6 : 1,
                        }}>
                          {actionLoading === shop.id ? 'Updating...' : <><FaSyncAlt style={{marginRight:4}} /> Reactivate to Pending</>}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {msg && (
        <div style={{position:'fixed', bottom:24, right:24, background: msg.type === 'success' ? '#dcfce7' : '#fde8e8', color: msg.type === 'success' ? '#166534' : '#991b1b', borderRadius:10, padding:'12px 20px', zIndex:9999, fontSize:14, fontWeight:600, boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
          {msg.text}
          <button onClick={() => setMsg(null)} style={{marginLeft:12, background:'none', border:'none', cursor:'pointer', fontSize:16, color:'inherit'}}></button>
        </div>
      )}
    </div>
  );
}

