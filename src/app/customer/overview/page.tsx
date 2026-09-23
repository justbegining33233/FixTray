'use client';
import { usePhrase } from '@/lib/usePhrase';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { unwrapWorkOrders } from '@/lib/workOrderList';
import { isActiveWorkOrder, summarizeWorkOrders, workOrderTitle, type WorkOrderSummary } from '@/lib/workOrderMetrics';
import { FaExclamationTriangle } from 'react-icons/fa';

interface OverviewStats {
  activeOrders: number;
  completedThisMonth: number;
  unreadMessages: number;
  loyaltyPoints: number;
}

interface ActivityItem {
  id: string;
  title: string;
  status: string;
  when: string;
}

export default function CustomerOverview() {
  const say = usePhrase();
  const { user } = useRequireAuth(['customer']);
  const [stats, setStats] = useState<OverviewStats>({ activeOrders: 0, completedThisMonth: 0, unreadMessages: 0, loyaltyPoints: 0 });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [woRes, msgRes, rewardsRes] = await Promise.allSettled([
        fetch('/api/workorders?limit=20&includeMetrics=1', { headers, credentials: 'include' }),
        fetch('/api/messages/unread-count', { headers, credentials: 'include' }),
        fetch('/api/customers/rewards', { headers, credentials: 'include' }),
      ]);

      let activeOrders = 0, completedThisMonth = 0;
      let nextActivity: ActivityItem[] = [];
      if (woRes.status === 'fulfilled' && woRes.value.ok) {
        const raw = await woRes.value.json();
        const metrics = raw.metrics as Partial<WorkOrderSummary> | undefined;
        const orders: any[] = unwrapWorkOrders(raw);
        const summary = summarizeWorkOrders(orders);
        activeOrders = typeof metrics?.active === 'number' ? metrics.active : summary.active;
        completedThisMonth = typeof metrics?.completedThisMonth === 'number' ? metrics.completedThisMonth : summary.completedThisMonth;
        const previewSource = raw.metrics?.activePreview;
        const preview = Array.isArray(previewSource)
          ? previewSource
          : orders.filter((order) => isActiveWorkOrder(order));
        nextActivity = preview.slice(0, 5).map((order: any) => ({
          id: String(order.id),
          title: workOrderTitle(order),
          status: String(order.status || 'pending'),
          when: new Date(order.updatedAt || order.createdAt || Date.now()).toLocaleString(),
        }));
      }
      setActivity(nextActivity);

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
          <Link href="/customer/dashboard" style={{fontSize:24, fontWeight:900, color:'#e5332a', textDecoration:'none'}}>{say("FixTray")}</Link>
          <div>
            <div style={{fontSize:20, fontWeight:700, color:'#e5e7eb'}}>{say("Customer Portal")}</div>
            <div style={{fontSize:12, color:'#9aa3b2'}}>{say("Account Overview")}</div>
          </div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:16}}>
          <span style={{fontSize:14, color:'#9aa3b2'}}>{say("Welcome,")}{' '}{say(userName)}</span>
          <button onClick={handleSignOut} style={{padding:'8px 16px', background:'#e5332a', color:'white', border:'none', borderRadius:6, cursor:'pointer', fontSize:13, fontWeight:600}}>
            {say("Sign Out")}{' '}</button>
        </div>
      </div>

      <div style={{maxWidth:1200, margin:'0 auto', padding:32}}>
        <h1 style={{fontSize:32, fontWeight:700, color:'#e5e7eb', marginBottom:32}}>{say("Account Overview")}</h1>

        {error && (
          <div style={{background:'rgba(229,51,42,0.1)',border:'1px solid rgba(229,51,42,0.3)',borderRadius:10,padding:'14px 20px',marginBottom:24,display:'flex',gap:12,alignItems:'center'}}>
            <span><FaExclamationTriangle style={{marginRight:4}} /></span>
            <span style={{color:'#fca5a5',fontSize:14}}>{say(error)}</span>
            <button onClick={fetchStats} style={{marginLeft:'auto',background:'#e5332a',color:'#fff',border:'none',borderRadius:6,padding:'6px 14px',cursor:'pointer',fontSize:13}}>{say("Retry")}</button>
          </div>
        )}

        {/* Quick Stats */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(250px, 1fr))', gap:24, marginBottom:40}}>
          <div style={{background:'rgba(229,51,42,0.1)', border:'1px solid rgba(229,51,42,0.3)', borderRadius:12, padding:24}}>
            <div style={{fontSize:14, color:'#9aa3b2', marginBottom:8}}>{say("Active Orders")}</div>
            <div style={{fontSize:36, fontWeight:700, color:'#e5332a'}}>{loading ? '…' : stats.activeOrders}</div>
          </div>
          <div style={{background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:12, padding:24}}>
            <div style={{fontSize:14, color:'#9aa3b2', marginBottom:8}}>{say("Completed This Month")}</div>
            <div style={{fontSize:36, fontWeight:700, color:'#22c55e'}}>{loading ? '…' : stats.completedThisMonth}</div>
          </div>
          <div style={{background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:12, padding:24}}>
            <div style={{fontSize:14, color:'#9aa3b2', marginBottom:8}}>{say("Unread Messages")}</div>
            <div style={{fontSize:36, fontWeight:700, color:'#f59e0b'}}>{loading ? '…' : stats.unreadMessages}</div>
          </div>
          <div style={{background:'rgba(168,85,247,0.1)', border:'1px solid rgba(168,85,247,0.3)', borderRadius:12, padding:24}}>
            <div style={{fontSize:14, color:'#9aa3b2', marginBottom:8}}>{say("Loyalty Points")}</div>
            <div style={{fontSize:36, fontWeight:700, color:'#a855f7'}}>{loading ? '…' : stats.loyaltyPoints.toLocaleString()}</div>
          </div>
        </div>

        {/* Recent Activity */}
        <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
          <h2 style={{fontSize:24, fontWeight:700, color:'#e5e7eb', marginBottom:20}}>{say("Recent Activity")}</h2>
          {loading ? (
            <div style={{textAlign:'center', padding:40, color:'#9aa3b2'}}>{say("Loading activity...")}</div>
          ) : activity.length === 0 ? (
            <div style={{textAlign:'center', padding:40, color:'#9aa3b2'}}>{say("No recent activity")}</div>
          ) : (
            <div style={{display:'grid', gap:12}}>
              {activity.map((item) => (
                <Link key={item.id} href={`/customer/workorders/${item.id}` as any} style={{display:'flex', justifyContent:'space-between', gap:12, textDecoration:'none', background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'12px 14px'}}>
                  <div>
                    <div style={{color:'#e5e7eb', fontWeight:700}}>{say(item.title)}</div>
                    <div style={{color:'#9aa3b2', fontSize:12, marginTop:4}}>{say(item.when)}</div>
                  </div>
                  <div style={{color:'#f59e0b', fontSize:12, fontWeight:700, textTransform:'capitalize'}}>{item.status.replace(/-/g, ' ')}</div>
                </Link>
              ))}
            </div>
          )}
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
            {say("Back to Dashboard")}{' '}</Link>
        </div>
      </div>
    </div>
  );
}

