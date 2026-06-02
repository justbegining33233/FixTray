'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaExclamationTriangle } from 'react-icons/fa';

interface OverviewStats {
  activeOrders: number;
  completedThisMonth: number;
  unreadMessages: number;
  loyaltyPoints: number;
}

export default function CustomerOverview() {
  const { user } = useRequireAuth(['customer']);
  const [stats, setStats] = useState<OverviewStats>({ activeOrders: 0, completedThisMonth: 0, unreadMessages: 0, loyaltyPoints: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [woRes, msgRes, rewardsRes] = await Promise.allSettled([
        fetch('/api/workorders?role=customer', { headers }),
        fetch('/api/messages/unread-count', { headers }),
        fetch('/api/customers/rewards', { headers }),
      ]);

      let activeOrders = 0, completedThisMonth = 0;
      if (woRes.status === 'fulfilled' && woRes.value.ok) {
        const raw = await woRes.value.json();
        const orders: any[] = Array.isArray(raw) ? raw : [];
        const now = new Date();
        activeOrders = orders.filter((o: any) => !['completed', 'closed'].includes(o.status?.toLowerCase())).length;
        completedThisMonth = orders.filter((o: any) => {
          if (!['completed', 'closed'].includes(o.status?.toLowerCase())) return false;
          const d = new Date(o.updatedAt || o.createdAt);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).length;
      }

      let unreadMessages = 0;
      if (msgRes.status === 'fulfilled' && msgRes.value.ok) {
        const msgData = await msgRes.value.json();
        unreadMessages = msgData.count ?? msgData.unread ?? 0;
      }

      let loyaltyPoints = 0;
      if (rewardsRes.status === 'fulfilled' && rewardsRes.value.ok) {
        const rData = await rewardsRes.value.json();
        loyaltyPoints = rData.points ?? rData.loyaltyPoints ?? 0;
      }

      setStats({ activeOrders, completedThisMonth, unreadMessages, loyaltyPoints });
    } catch {
      setError('Failed to load overview. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user) fetchStats(); }, [user, fetchStats]);

  const handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    window.location.href = '/auth/login';
  };

  const userName = (user as any)?.name || (typeof window !== 'undefined' ? localStorage.getItem('userName') : '') || '';

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      {/* Header */}
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(229,51,42,0.3)', padding:'16px 32px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{display:'flex', alignItems:'center', gap:24}}>
          <Link href="/customer/dashboard" style={{fontSize:24, fontWeight:900, color:'#e5332a', textDecoration:'none'}}>FixTray</Link>
          <div>
            <div style={{fontSize:20, fontWeight:700, color:'#e5e7eb'}}>Customer Portal</div>
            <div style={{fontSize:12, color:'#9aa3b2'}}>Account Overview</div>
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
        <h1 style={{fontSize:32, fontWeight:700, color:'#e5e7eb', marginBottom:32}}>Account Overview</h1>

        {error && (
          <div style={{background:'rgba(229,51,42,0.1)',border:'1px solid rgba(229,51,42,0.3)',borderRadius:10,padding:'14px 20px',marginBottom:24,display:'flex',gap:12,alignItems:'center'}}>
            <span><FaExclamationTriangle style={{marginRight:4}} /></span>
            <span style={{color:'#fca5a5',fontSize:14}}>{error}</span>
            <button onClick={fetchStats} style={{marginLeft:'auto',background:'#e5332a',color:'#fff',border:'none',borderRadius:6,padding:'6px 14px',cursor:'pointer',fontSize:13}}>Retry</button>
          </div>
        )}

        {/* Quick Stats */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(250px, 1fr))', gap:24, marginBottom:40}}>
          <div style={{background:'rgba(229,51,42,0.1)', border:'1px solid rgba(229,51,42,0.3)', borderRadius:12, padding:24}}>
            <div style={{fontSize:14, color:'#9aa3b2', marginBottom:8}}>Active Orders</div>
            <div style={{fontSize:36, fontWeight:700, color:'#e5332a'}}>{loading ? '-' : stats.activeOrders}</div>
          </div>
          <div style={{background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:12, padding:24}}>
            <div style={{fontSize:14, color:'#9aa3b2', marginBottom:8}}>Completed This Month</div>
            <div style={{fontSize:36, fontWeight:700, color:'#22c55e'}}>{loading ? '-' : stats.completedThisMonth}</div>
          </div>
          <div style={{background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:12, padding:24}}>
            <div style={{fontSize:14, color:'#9aa3b2', marginBottom:8}}>Unread Messages</div>
            <div style={{fontSize:36, fontWeight:700, color:'#f59e0b'}}>{loading ? '-' : stats.unreadMessages}</div>
          </div>
          <div style={{background:'rgba(168,85,247,0.1)', border:'1px solid rgba(168,85,247,0.3)', borderRadius:12, padding:24}}>
            <div style={{fontSize:14, color:'#9aa3b2', marginBottom:8}}>Loyalty Points</div>
            <div style={{fontSize:36, fontWeight:700, color:'#a855f7'}}>{loading ? '-' : stats.loyaltyPoints.toLocaleString()}</div>
          </div>
        </div>

        {/* Recent Activity */}
        <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
          <h2 style={{fontSize:24, fontWeight:700, color:'#e5e7eb', marginBottom:20}}>Recent Activity</h2>
          <div style={{textAlign:'center', padding:40, color:'#9aa3b2'}}>
            {loading ? 'Loading activity...' : 'No recent activity'}
          </div>
        </div>

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

