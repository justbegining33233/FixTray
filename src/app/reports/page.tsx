'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowDown, FaArrowLeft, FaArrowUp, FaChartBar, FaDownload, FaStar } from 'react-icons/fa';

export default function ReportsAnalytics() {
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin', 'shop', 'manager']);
  const [userRole, setUserRole] = useState('');
  const [dateRange, setDateRange] = useState('30days');
  const [, setReportLoading] = useState(false);

  // Live data states
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalJobs: 0,
    avgJobValue: 0,
    completionRate: 0,
    customerSatisfaction: 0,
    responseTime: '0 min',
  });
  const [revenueByMonth, setRevenueByMonth] = useState<{ month: string; revenue: number; jobs: number }[]>([]);
  const [topServices, setTopServices] = useState<{ service: string; jobs: number; revenue: number }[]>([]);
  const [techPerformance, setTechPerformance] = useState<{ name: string; jobs: number; revenue: number; rating?: number; efficiency?: number }[]>([]);

  // Fetch live report data whenever user is available
  useEffect(() => {
    if (!user) return;
    // Reports API only works for shop/manager/admin roles
    if (!['shop', 'manager', 'admin'].includes(user.role)) return;

    const shopId = (user as any).shopId ?? user.id;
    if (!shopId) return;

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    setReportLoading(true);
    fetch(`/api/reports?shopId=${shopId}`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.report) return;
        const r = data.report;
        const completionRate = r.totalJobs > 0 ? Math.round((r.completedJobs / r.totalJobs) * 100) : 0;
        setStats({
          totalRevenue: r.totalRevenue ?? 0,
          totalJobs: r.totalJobs ?? 0,
          avgJobValue: r.avgJobValue ?? 0,
          completionRate,
          customerSatisfaction: 0,
          responseTime: ' - ',
        });
        setRevenueByMonth(r.revenueByMonth ?? []);
        setTopServices(r.topServices ?? []);
        setTechPerformance(r.techPerformance ?? []);
      })
      .finally(() => setReportLoading(false));
  }, [user]);

  useEffect(() => {
    if (user?.role) setUserRole(user.role);
  }, [user]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#e5e7eb',
        fontSize: '18px'
      }}>
        Loading...
      </div>
    );
  }

  // If no user, the useRequireAuth hook will handle redirect
  if (!user) {
    return null;
  }

  const getDashboardLink = () => {
    switch (userRole) {
      case 'admin': return '/admin/home';
      case 'superadmin': return '/admin/home';
      case 'shop': return '/shop/admin';
      case 'tech': return '/tech/home';
      case 'manager': return '/tech/home';
      case 'customer': return '/customer/home';
      default: return '/';
    }
  };

  // customerMetrics are derived from live stats
  const customerMetrics: { metric: string; value: string | number; change: string }[] = [
    { metric: 'Total Work Orders', value: stats.totalJobs, change: '' },
    { metric: 'Completion Rate', value: `${stats.completionRate}%`, change: '' },
    { metric: 'Avg Job Value', value: `$${stats.avgJobValue.toFixed(2)}`, change: '' },
  ];

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(245,158,11,0.3)', padding:'20px 32px'}}>
        <div style={{maxWidth:1600, margin:'0 auto'}}>
          <Link href={getDashboardLink() as Route} style={{color:'#e5332a', textDecoration:'none', fontSize:14, fontWeight:600, marginBottom:16, display:'inline-block'}}>
            <FaArrowLeft style={{marginRight:4}} /> Back to Dashboard
          </Link>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div>
              <h1 style={{fontSize:28, fontWeight:700, color:'#e5e7eb', marginBottom:8}}><FaChartBar style={{marginRight:4}} /> Reports & Analytics</h1>
              <p style={{fontSize:14, color:'#9aa3b2'}}>Business insights and performance metrics</p>
            </div>
            <div style={{display:'flex', gap:12}}>
              <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} style={{padding:'10px 16px', background:'rgba(0,0,0,0.3)', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 90 Days</option>
                <option value="year">This Year</option>
              </select>
              <button style={{padding:'10px 20px', background:'#22c55e', color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}>
                <FaDownload style={{marginRight:4}} /> Export Report
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1600, margin:'0 auto', padding:32}}>
        {/* Key Metrics */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(250px, 1fr))', gap:20, marginBottom:32}}>
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:12, padding:24}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>Total Revenue</div>
            <div style={{fontSize:32, fontWeight:700, color:'#22c55e', marginBottom:4}}>${stats.totalRevenue.toLocaleString()}</div>
            <div style={{fontSize:12, color:'#22c55e'}}><FaArrowUp style={{marginRight:4}} /> 12% from last period</div>
          </div>
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(229,51,42,0.3)', borderRadius:12, padding:24}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>Total Jobs</div>
            <div style={{fontSize:32, fontWeight:700, color:'#e5332a', marginBottom:4}}>{stats.totalJobs}</div>
            <div style={{fontSize:12, color:'#e5332a'}}><FaArrowUp style={{marginRight:4}} /> 8% from last period</div>
          </div>
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:12, padding:24}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>Avg Job Value</div>
            <div style={{fontSize:32, fontWeight:700, color:'#f59e0b', marginBottom:4}}>${stats.avgJobValue}</div>
            <div style={{fontSize:12, color:'#f59e0b'}}><FaArrowUp style={{marginRight:4}} /> 5% from last period</div>
          </div>
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(139,92,246,0.3)', borderRadius:12, padding:24}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>Completion Rate</div>
            <div style={{fontSize:32, fontWeight:700, color:'#8b5cf6', marginBottom:4}}>{stats.completionRate}%</div>
            <div style={{fontSize:12, color:'#8b5cf6'}}><FaArrowUp style={{marginRight:4}} /> 2% from last period</div>
          </div>
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(229,51,42,0.3)', borderRadius:12, padding:24}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>Customer Rating</div>
            <div style={{fontSize:32, fontWeight:700, color:'#e5332a', marginBottom:4}}><FaStar style={{marginRight:4}} /> {stats.customerSatisfaction}</div>
            <div style={{fontSize:12, color:'#22c55e'}}><FaArrowUp style={{marginRight:4}} /> 0.3 from last period</div>
          </div>
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>Avg Response Time</div>
            <div style={{fontSize:32, fontWeight:700, color:'#e5e7eb', marginBottom:4}}>{stats.responseTime}</div>
            <div style={{fontSize:12, color:'#22c55e'}}><FaArrowDown style={{marginRight:4}} /> 3 min from last period</div>
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:24, marginBottom:24}}>
          {/* Revenue Chart */}
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
            <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:20}}>Revenue Trend</h2>
            <div style={{display:'flex', flexDirection:'column', gap:12}}>
              {revenueByMonth.map((month, idx) => {
                const maxRevenue = Math.max(...revenueByMonth.map(m => m.revenue));
                const percentage = (month.revenue / maxRevenue) * 100;
                return (
                  <div key={idx} style={{display:'flex', alignItems:'center', gap:16}}>
                    <div style={{width:50, fontSize:13, color:'#9aa3b2', fontWeight:600}}>{month.month}</div>
                    <div style={{flex:1, background:'rgba(255,255,255,0.05)', borderRadius:8, height:40, position:'relative', overflow:'hidden'}}>
                      <div style={{background:'linear-gradient(90deg, #22c55e, #16a34a)', height:'100%', width:`${percentage}%`, borderRadius:8, transition:'width 0.3s'}} />
                      <div style={{position:'absolute', top:'50%', left:16, transform:'translateY(-50%)', fontSize:14, fontWeight:700, color:'white'}}>
                        ${month.revenue.toLocaleString()}
                      </div>
                    </div>
                    <div style={{width:80, fontSize:12, color:'#9aa3b2', textAlign:'right'}}>{month.jobs} jobs</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Services */}
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
            <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:20}}>Top Services</h2>
            <div style={{display:'flex', flexDirection:'column', gap:16}}>
              {topServices.map((service, idx) => (
                <div key={idx} style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:16}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                    <div style={{fontSize:14, fontWeight:700, color:'#e5e7eb'}}>{service.service}</div>
                    <div style={{fontSize:16, fontWeight:700, color:'#22c55e'}}>${service.revenue}</div>
                  </div>
                  <div style={{fontSize:12, color:'#9aa3b2'}}>{service.jobs} jobs completed</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tech Performance */}
        <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24, marginBottom:24}}>
          <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:20}}>Technician Performance</h2>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%', borderCollapse:'separate', borderSpacing:'0 8px'}}>
              <thead>
                <tr style={{textAlign:'left'}}>
                  <th style={{padding:'12px 16px', color:'#9aa3b2', fontSize:12, fontWeight:700, textTransform:'uppercase'}}>Technician</th>
                  <th style={{padding:'12px 16px', color:'#9aa3b2', fontSize:12, fontWeight:700, textTransform:'uppercase'}}>Jobs</th>
                  <th style={{padding:'12px 16px', color:'#9aa3b2', fontSize:12, fontWeight:700, textTransform:'uppercase'}}>Revenue</th>
                  <th style={{padding:'12px 16px', color:'#9aa3b2', fontSize:12, fontWeight:700, textTransform:'uppercase'}}>Rating</th>
                  <th style={{padding:'12px 16px', color:'#9aa3b2', fontSize:12, fontWeight:700, textTransform:'uppercase'}}>Efficiency</th>
                </tr>
              </thead>
              <tbody>
                {techPerformance.map((tech, idx) => (
                  <tr key={idx} style={{background:'rgba(255,255,255,0.05)', borderRadius:8}}>
                    <td style={{padding:'16px', fontSize:14, fontWeight:700, color:'#e5e7eb'}}>{tech.name}</td>
                    <td style={{padding:'16px', fontSize:14, color:'#e5332a', fontWeight:600}}>{tech.jobs}</td>
                    <td style={{padding:'16px', fontSize:14, color:'#22c55e', fontWeight:600}}>${tech.revenue.toLocaleString()}</td>
                    <td style={{padding:'16px', fontSize:14, color:'#f59e0b', fontWeight:600}}><FaStar style={{marginRight:4}} /> {tech.rating}</td>
                    <td style={{padding:'16px'}}>
                      <div style={{display:'flex', alignItems:'center', gap:8}}>
                        <div style={{flex:1, background:'rgba(255,255,255,0.1)', height:8, borderRadius:4, overflow:'hidden'}}>
                          <div style={{background:'#8b5cf6', height:'100%', width:`${tech.efficiency}%`, borderRadius:4}} />
                        </div>
                        <span style={{fontSize:13, fontWeight:600, color:'#8b5cf6'}}>{tech.efficiency}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Customer Metrics */}
        <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
          <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:20}}>Customer Metrics</h2>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(250px, 1fr))', gap:20}}>
            {customerMetrics.map((item, idx) => (
              <div key={idx} style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:20}}>
                <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>{item.metric}</div>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
                  <div style={{fontSize:28, fontWeight:700, color:'#e5e7eb'}}>{item.value}</div>
                  <div style={{fontSize:14, fontWeight:600, color:item.change.startsWith('+') || item.change.startsWith('^') ? '#22c55e' : item.change.startsWith('-') || item.change.startsWith('v') ? '#e5332a' : '#e5332a'}}>
                    {item.change}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

