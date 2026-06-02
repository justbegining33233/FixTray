'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';

// Dynamically import heavy chart components  ssr:false prevents hydration mismatch
const DynamicRevenueChart = dynamic(() => import('@/components/AnalyticsCharts').then(mod => ({ default: mod.RevenueChart })), {
  ssr: false,
  loading: () => <div className="h-64 flex items-center justify-center text-gray-400">Loading chart...</div>
});
const DynamicCompletionTimesChart = dynamic(() => import('@/components/AnalyticsCharts').then(mod => ({ default: mod.CompletionTimesChart })), {
  ssr: false,
  loading: () => <div className="h-64 flex items-center justify-center text-gray-400">Loading chart...</div>
});
const DynamicTechPerformanceChart = dynamic(() => import('@/components/AnalyticsCharts').then(mod => ({ default: mod.TechPerformanceChart })), {
  ssr: false,
  loading: () => <div className="h-64 flex items-center justify-center text-gray-400">Loading chart...</div>
});
const DynamicStatusDistributionChart = dynamic(() => import('@/components/AnalyticsCharts').then(mod => ({ default: mod.StatusDistributionChart })), {
  ssr: false,
  loading: () => <div className="h-64 flex items-center justify-center text-gray-400">Loading chart...</div>
});
const DynamicMonthlyTrendsChart = dynamic(() => import('@/components/AnalyticsCharts').then(mod => ({ default: mod.MonthlyTrendsChart })), {
  ssr: false,
  loading: () => <div className="h-64 flex items-center justify-center text-gray-400">Loading chart...</div>
});
import { FaArrowLeft, FaChartBar } from 'react-icons/fa';
import { useRequireAuth } from '@/contexts/AuthContext';

interface AnalyticsData {
  totalWorkOrders: number;
  completedWorkOrders: number;
  pendingWorkOrders: number;
  inProgressWorkOrders: number;
  totalRevenue: number;
  totalShops: number;
  totalTechs: number;
  totalCustomers: number;
  revenue: { month: string; amount: number }[];
  monthlyTrends: { month: string; jobs: number; revenue: number }[];
  statusDistribution: { status: string; count: number }[];
  completionTimes: { time: string; count: number }[];
  techPerformance: { name: string; jobs: number; rating: number }[];
}

const EMPTY_ANALYTICS_DATA: AnalyticsData = {
  totalWorkOrders: 0, completedWorkOrders: 0, pendingWorkOrders: 0,
  inProgressWorkOrders: 0, totalRevenue: 0, totalShops: 0, totalTechs: 0, totalCustomers: 0,
  revenue: [],
  monthlyTrends: [],
  statusDistribution: [],
  completionTimes: [],
  techPerformance: [],
};

export default function PlatformAnalytics() {
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);
  const [data, setData] = useState<AnalyticsData>(EMPTY_ANALYTICS_DATA);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
    fetch('/api/admin/analytics', {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(json => setData({ ...EMPTY_ANALYTICS_DATA, ...json }))
      .catch(e => setFetchError(e.message))
      .finally(() => setDataLoading(false));
  }, [user]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh', background: 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#e5e7eb', fontSize: '18px'
      }}>
        Loading...
      </div>
    );
  }

  if (!user) return null;

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(245,158,11,0.3)', padding:'20px 32px'}}>
        <div style={{maxWidth:1400, margin:'0 auto'}}>
          <Link href="/admin/home" style={{color:'#e5332a', textDecoration:'none', fontSize:14, fontWeight:600, marginBottom:16, display:'inline-block'}}>
            <FaArrowLeft style={{marginRight:4}} /> Back to Dashboard
          </Link>
          <h1 style={{fontSize:28, fontWeight:700, color:'#e5e7eb', marginBottom:8}}><FaChartBar style={{marginRight:4}} /> Platform Analytics</h1>
          <p style={{fontSize:14, color:'#9aa3b2'}}>Detailed analytics and performance metrics</p>
        </div>
      </div>

      <div style={{maxWidth:1400, margin:'0 auto', padding:32}}>
        {/* Key Metrics */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(250px, 1fr))', gap:20, marginBottom:32}}>
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:12, padding:24}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>Total Revenue</div>
            <div style={{fontSize:32, fontWeight:700, color:'#22c55e', marginBottom:8}}>
              {dataLoading ? '...' : `$${(data.totalRevenue ?? 0).toLocaleString()}`}
            </div>
            <div style={{fontSize:12, color:'#9aa3b2'}}>All-time platform revenue</div>
          </div>
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(229,51,42,0.3)', borderRadius:12, padding:24}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>Approved Shops</div>
            <div style={{fontSize:32, fontWeight:700, color:'#e5332a', marginBottom:8}}>
              {dataLoading ? '...' : data.totalShops}
            </div>
            <div style={{fontSize:12, color:'#9aa3b2'}}>{data.totalTechs} technicians registered</div>
          </div>
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(168,85,247,0.3)', borderRadius:12, padding:24}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>Work Orders</div>
            <div style={{fontSize:32, fontWeight:700, color:'#a855f7', marginBottom:8}}>
              {dataLoading ? '...' : data.totalWorkOrders}
            </div>
            <div style={{fontSize:12, color:'#9aa3b2'}}>{data.completedWorkOrders} completed</div>
          </div>
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:12, padding:24}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>Customers</div>
            <div style={{fontSize:32, fontWeight:700, color:'#f59e0b', marginBottom:8}}>
              {dataLoading ? '...' : data.totalCustomers}
            </div>
            <div style={{fontSize:12, color:'#9aa3b2'}}>Registered customers</div>
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:24}}>
          {/* Revenue Chart */}
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
            <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:20}}>Revenue Trends</h2>
<DynamicRevenueChart data={data.revenue} />
        </div>

          {/* Top Shops */}
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
            <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:20}}>Status Overview</h2>
            <div style={{display:'flex', flexDirection:'column', gap:12}}>
              {fetchError && <div style={{color:'#f87171', fontSize:13}}>Could not load live data: {fetchError}</div>}
              {[
                { label: 'Pending', val: data.pendingWorkOrders, color: '#f59e0b' },
                { label: 'In Progress', val: data.inProgressWorkOrders, color: '#e5332a' },
                { label: 'Completed', val: data.completedWorkOrders, color: '#22c55e' },
              ].map(row => (
                <div key={row.label} style={{padding:12, background:'rgba(255,255,255,0.05)', borderRadius:8, display:'flex', justifyContent:'space-between'}}>
                  <div style={{fontSize:14, fontWeight:600, color:'#e5e7eb'}}>{row.label}</div>
                  <div style={{fontSize:14, fontWeight:700, color:row.color}}>{dataLoading ? '...' : row.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* User Activity */}
        <div style={{marginTop:24, background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
          <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:20}}>Completion Times</h2>
          <DynamicCompletionTimesChart data={data.completionTimes} />
        </div>

        {/* Additional Charts */}
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, marginTop:24}}>
          {/* Technician Performance */}
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
            <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:20}}>Technician Performance</h2>
            <DynamicTechPerformanceChart data={data.techPerformance} />
          </div>

          {/* Status Distribution */}
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
            <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:20}}>Work Order Status</h2>
            <DynamicStatusDistributionChart data={data.statusDistribution} />
          </div>
        </div>

        {/* Monthly Trends */}
        <div style={{marginTop:24, background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
          <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:20}}>Monthly Trends</h2>
          <DynamicMonthlyTrendsChart data={data.monthlyTrends} />
        </div>
      </div>
    </div>
  );
}

