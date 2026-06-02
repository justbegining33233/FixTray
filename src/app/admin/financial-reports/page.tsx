'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaChartBar, FaDollarSign, FaHourglassHalf, FaStore } from 'react-icons/fa';

type FinancialStats = {
  totalRevenue: string;
  totalPayouts: string;
  platformFees: string;
  pendingPayouts: string;
  averageTransaction: string;
  transactionCount: number;
};

type MonthlyData = {
  month: string;
  revenue: string;
  payouts: string;
  fees: string;
};

type TopShop = {
  name: string;
  revenue: string;
  fees: string;
  payout: string;
};

export default function FinancialReports() {
  const _router = useRouter();
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<FinancialStats>({
    totalRevenue: '$0',
    totalPayouts: '$0',
    platformFees: '$0',
    pendingPayouts: '$0',
    averageTransaction: '$0',
    transactionCount: 0,
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [topEarningShops, setTopEarningShops] = useState<TopShop[]>([]);

  useEffect(() => {
    if (isLoading || !user) return;
    
    // Fetch financial data
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/financial-reports', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setStats({
            totalRevenue: data.totalRevenue,
            totalPayouts: data.totalPayouts,
            platformFees: data.platformFees,
            pendingPayouts: data.pendingPayouts,
            averageTransaction: data.averageTransaction,
            transactionCount: data.transactionCount,
          });
          setMonthlyData(data.monthlyData || []);
          setTopEarningShops(data.topEarningShops || []);
        }
      } catch (error) {
        console.error('Error fetching financial data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [isLoading, user]);

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

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(245,158,11,0.3)', padding:'20px 32px'}}>
        <div style={{maxWidth:1400, margin:'0 auto'}}>
          <Link href="/admin/home" style={{color:'#e5332a', textDecoration:'none', fontSize:14, fontWeight:600, marginBottom:16, display:'inline-block'}}>
            <FaArrowLeft style={{marginRight:4}} /> Back to Dashboard
          </Link>
          <h1 style={{fontSize:28, fontWeight:700, color:'#e5e7eb', marginBottom:8}}><FaDollarSign style={{marginRight:4}} /> Financial Reports</h1>
          <p style={{fontSize:14, color:'#9aa3b2'}}>Revenue, payouts, and financial analytics</p>
        </div>
      </div>

      <div style={{maxWidth:1400, margin:'0 auto', padding:32}}>
        {loading ? (
          <div style={{textAlign:'center', padding:48, color:'#9aa3b2'}}>
            <div style={{fontSize:32, marginBottom:16}}><FaHourglassHalf style={{marginRight:4}} /></div>
            <div>Loading financial data...</div>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:16, marginBottom:32}}>
          <div style={{background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:12, padding:20}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>Total Revenue</div>
            <div style={{fontSize:28, fontWeight:700, color:'#22c55e'}}>{stats.totalRevenue}</div>
            <div style={{fontSize:11, color:'#9aa3b2', marginTop:4}}>All time</div>
          </div>
          <div style={{background:'rgba(229,51,42,0.1)', border:'1px solid rgba(229,51,42,0.3)', borderRadius:12, padding:20}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>Total Payouts</div>
            <div style={{fontSize:28, fontWeight:700, color:'#e5332a'}}>{stats.totalPayouts}</div>
            <div style={{fontSize:11, color:'#9aa3b2', marginTop:4}}>Paid to shops</div>
          </div>
          <div style={{background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:12, padding:20}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>Platform Fees</div>
            <div style={{fontSize:28, fontWeight:700, color:'#f59e0b'}}>{stats.platformFees}</div>
            <div style={{fontSize:11, color:'#9aa3b2', marginTop:4}}>Flat platform fee model</div>
          </div>
          <div style={{background:'rgba(229,51,42,0.1)', border:'1px solid rgba(229,51,42,0.3)', borderRadius:12, padding:20}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>Pending Payouts</div>
            <div style={{fontSize:28, fontWeight:700, color:'#e5332a'}}>{stats.pendingPayouts}</div>
            <div style={{fontSize:11, color:'#9aa3b2', marginTop:4}}>Awaiting processing</div>
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, marginBottom:24}}>
          {/* Monthly Revenue */}
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
            <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:20}}>Monthly Revenue</h2>
            <div style={{display:'flex', flexDirection:'column', gap:12}}>
              {monthlyData.length === 0 ? (
                <div style={{textAlign:'center', padding:32, color:'#9aa3b2'}}>
                  <div style={{fontSize:24, marginBottom:8}}><FaChartBar style={{marginRight:4}} /></div>
                  <div>No monthly data available</div>
                </div>
              ) : (
                monthlyData.map((data, idx) => (
                  <div key={idx} style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:16}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                      <span style={{fontSize:15, fontWeight:700, color:'#e5e7eb'}}>{data.month}</span>
                      <span style={{fontSize:18, fontWeight:700, color:'#22c55e'}}>{data.revenue}</span>
                    </div>
                    <div style={{display:'flex', gap:16, fontSize:13, color:'#9aa3b2'}}>
                      <span>Payouts: {data.payouts}</span>
                      <span>Fees: {data.fees}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Top Earning Shops */}
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
            <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:20}}>Top Earning Shops</h2>
            <div style={{display:'flex', flexDirection:'column', gap:12}}>
              {topEarningShops.length === 0 ? (
                <div style={{textAlign:'center', padding:32, color:'#9aa3b2'}}>
                  <div style={{fontSize:24, marginBottom:8}}><FaStore style={{marginRight:4}} /></div>
                  <div>No shop data available</div>
                </div>
              ) : (
                topEarningShops.map((shop, idx) => (
                  <div key={idx} style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:16}}>
                    <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
                      <span style={{fontSize:20, fontWeight:700, color:'#9aa3b2'}}>#{idx + 1}</span>
                      <span style={{fontSize:15, fontWeight:700, color:'#e5e7eb'}}>{shop.name}</span>
                    </div>
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, fontSize:13}}>
                      <div>
                        <div style={{color:'#6b7280', fontSize:11}}>Revenue</div>
                        <div style={{color:'#22c55e', fontWeight:700}}>{shop.revenue}</div>
                      </div>
                      <div>
                        <div style={{color:'#6b7280', fontSize:11}}>Fees</div>
                        <div style={{color:'#f59e0b', fontWeight:700}}>{shop.fees}</div>
                      </div>
                      <div>
                        <div style={{color:'#6b7280', fontSize:11}}>Payout</div>
                        <div style={{color:'#e5332a', fontWeight:700}}>{shop.payout}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Transaction Summary */}
        <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
          <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:20}}>Transaction Summary</h2>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(250px, 1fr))', gap:16}}>
            <div style={{background:'rgba(255,255,255,0.05)', borderRadius:8, padding:16}}>
              <div style={{fontSize:13, color:'#9aa3b2', marginBottom:4}}>Total Transactions</div>
              <div style={{fontSize:24, fontWeight:700, color:'#e5e7eb'}}>{stats.transactionCount.toLocaleString()}</div>
            </div>
            <div style={{background:'rgba(255,255,255,0.05)', borderRadius:8, padding:16}}>
              <div style={{fontSize:13, color:'#9aa3b2', marginBottom:4}}>Average Transaction</div>
              <div style={{fontSize:24, fontWeight:700, color:'#e5e7eb'}}>{stats.averageTransaction}</div>
            </div>
            <div style={{background:'rgba(255,255,255,0.05)', borderRadius:8, padding:16}}>
              <div style={{fontSize:13, color:'#9aa3b2', marginBottom:4}}>Pricing Model</div>
              <div style={{fontSize:24, fontWeight:700, color:'#f59e0b'}}>Flat Fee</div>
            </div>
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  );
}

