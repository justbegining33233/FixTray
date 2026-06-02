'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowRight, FaChartBar, FaChartLine } from 'react-icons/fa';

interface Insight {
  id: string;
  trend: string;
  metric: string;
  value: string;
  color: string;
  description: string;
}

export default function Insights() {
  useRequireAuth(['customer']);
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [insights, setInsights] = useState<Insight[]>([]);
  const [summary, setSummary] = useState<{totalSpent:number;servicesCompleted:number;averageRating:number|null;loyaltyPoints:number;last30Days:number} | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const name = localStorage.getItem('userName') || '';
    setUserName(name);
    fetch('/api/customers/insights', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setInsights(data.insights || []);
          setSummary(data.summary || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    router.push('/auth/login' as Route);
  };

  const getTrendIcon = (trend: string) => {
    if (trend.includes('')) return <FaChartLine style={{marginRight:4}} />;
    if (trend.includes('')) return <FaChartLine style={{marginRight:4}} />;
    return <FaArrowRight style={{marginRight:4}} />;
  };

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      {/* Header */}
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(229,51,42,0.3)', padding:'16px 32px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{display:'flex', alignItems:'center', gap:24}}>
          <Link href="/customer/dashboard" style={{fontSize:24, fontWeight:900, color:'#e5332a', textDecoration:'none'}}>FixTray</Link>
          <div>
            <div style={{fontSize:20, fontWeight:700, color:'#e5e7eb'}}>Customer Portal</div>
            <div style={{fontSize:12, color:'#9aa3b2'}}>Insights</div>
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
        <h1 style={{fontSize:32, fontWeight:700, color:'#e5e7eb', marginBottom:32}}>Service Insights</h1>

        {loading && (
          <div style={{textAlign:'center', padding:60, color:'#9aa3b2'}}>Loading insights...</div>
        )}

        {!loading && insights.length === 0 && (
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:40, textAlign:'center', marginBottom:32}}>
            <div style={{fontSize:48, marginBottom:16}}><FaChartBar style={{marginRight:4}} /></div>
            <div style={{fontSize:18, color:'#e5e7eb', marginBottom:8}}>No insights yet</div>
            <div style={{fontSize:14, color:'#9aa3b2'}}>Complete a service to start generating insights.</div>
          </div>
        )}

        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(400px, 1fr))', gap:24}}>
          {insights.map(insight => (
            <div key={insight.id} style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
              <div style={{marginBottom:16}}>
                <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:8}}>
                  <span style={{fontSize:24}}>{getTrendIcon(insight.trend)}</span>
                  <h3 style={{fontSize:18, fontWeight:700, color:'#e5e7eb', margin:0}}>{insight.metric}</h3>
                </div>
                <div style={{fontSize:24, color:insight.color, fontWeight:700, marginBottom:8}}>{insight.value}</div>
                <div style={{fontSize:14, color:'#9aa3b2', marginBottom:8}}>
                  Trend: <span style={{color:insight.color, fontWeight:600}}>{insight.trend}</span>
                </div>
                <div style={{fontSize:14, color:'#e5e7eb', lineHeight:1.5}}>{insight.description}</div>
              </div>
              <button onClick={() => router.push('/customer/workorders' as Route)} style={{
                width:'100%',
                padding:'12px',
                background:'#e5332a',
                color:'white',
                border:'none',
                borderRadius:8,
                fontSize:14,
                fontWeight:600,
                cursor:'pointer'
              }}>
                Learn More
              </button>
            </div>
          ))}
        </div>

        {/* Summary Section */}
        <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24, marginTop:32}}>
          <h2 style={{fontSize:24, fontWeight:700, color:'#e5e7eb', marginBottom:16}}>Summary</h2>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:24}}>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:32, fontWeight:700, color:'#22c55e'}}>${summary ? summary.totalSpent.toFixed(2) : '0.00'}</div>
              <div style={{fontSize:14, color:'#9aa3b2'}}>Total Spent</div>
            </div>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:32, fontWeight:700, color:'#e5332a'}}>{summary ? summary.servicesCompleted : 0}</div>
              <div style={{fontSize:14, color:'#9aa3b2'}}>Services Completed</div>
            </div>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:32, fontWeight:700, color:'#f59e0b'}}>{summary?.averageRating ? summary.averageRating.toFixed(1) : ' - '}</div>
              <div style={{fontSize:14, color:'#9aa3b2'}}>Average Rating</div>
            </div>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:32, fontWeight:700, color:'#a855f7'}}>{summary ? summary.loyaltyPoints : 0}</div>
              <div style={{fontSize:14, color:'#9aa3b2'}}>Points Earned</div>
            </div>
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
