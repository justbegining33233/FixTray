'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaChartBar, FaDollarSign, FaHourglassHalf } from 'react-icons/fa';

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

export default function FinancialReports() {
  const say = usePhrase();
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
        {say("Loading...")}{' '}</div>
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
            <FaArrowLeft style={{marginRight:4}} /> {say("Back to Dashboard")}{' '}</Link>
          <h1 style={{fontSize:28, fontWeight:700, color:'#e5e7eb', marginBottom:8}}><FaDollarSign style={{marginRight:4}} /> {say("Financial Reports")}</h1>
          <p style={{fontSize:14, color:'#9aa3b2'}}>{say("FixTray fees from the books. Shop bay revenue is not on this page.")}</p>
        </div>
      </div>

      <div style={{maxWidth:1400, margin:'0 auto', padding:32}}>
        {loading ? (
          <div style={{textAlign:'center', padding:48, color:'#9aa3b2'}}>
            <div style={{fontSize:32, marginBottom:16}}><FaHourglassHalf style={{marginRight:4}} /></div>
            <div>{say("Loading financial data...")}</div>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:16, marginBottom:32}}>
          <div style={{background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:12, padding:20}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>{say("Fees collected")}</div>
            <div style={{fontSize:28, fontWeight:700, color:'#22c55e'}}>{say(stats.totalRevenue)}</div>
            <div style={{fontSize:11, color:'#9aa3b2', marginTop:4}}>{say("Card fees and shop settlements")}</div>
          </div>
          <div style={{background:'rgba(229,51,42,0.1)', border:'1px solid rgba(229,51,42,0.3)', borderRadius:12, padding:20}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>{say("Fees still owed")}</div>
            <div style={{fontSize:28, fontWeight:700, color:'#e5332a'}}>{say(stats.totalPayouts)}</div>
            <div style={{fontSize:11, color:'#9aa3b2', marginTop:4}}>{say("In-person fees the shops have not paid")}</div>
          </div>
          <div style={{background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:12, padding:20}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>{say("Net fees")}</div>
            <div style={{fontSize:28, fontWeight:700, color:'#f59e0b'}}>{say(stats.platformFees)}</div>
            <div style={{fontSize:11, color:'#9aa3b2', marginTop:4}}>{say("Collected minus fee refunds")}</div>
          </div>
          <div style={{background:'rgba(229,51,42,0.1)', border:'1px solid rgba(229,51,42,0.3)', borderRadius:12, padding:20}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>{say("Fee refunds")}</div>
            <div style={{fontSize:28, fontWeight:700, color:'#e5332a'}}>{say(stats.pendingPayouts)}</div>
            <div style={{fontSize:11, color:'#9aa3b2', marginTop:4}}>{say("Stored refund and chargeback rows")}</div>
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, marginBottom:24}}>
          {/* Monthly Revenue */}
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
            <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:20}}>{say("Fees by month")}</h2>
            <div style={{display:'flex', flexDirection:'column', gap:12}}>
              {monthlyData.length === 0 ? (
                <div style={{textAlign:'center', padding:32, color:'#9aa3b2'}}>
                  <div style={{fontSize:24, marginBottom:8}}><FaChartBar style={{marginRight:4}} /></div>
                  <div>{say("No monthly data available")}</div>
                </div>
              ) : (
                monthlyData.map((data, idx) => (
                  <div key={idx} style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:16}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                      <span style={{fontSize:15, fontWeight:700, color:'#e5e7eb'}}>{say(data.month)}</span>
                      <span style={{fontSize:18, fontWeight:700, color:'#22c55e'}}>{say(data.revenue)}</span>
                    </div>
                    <div style={{display:'flex', gap:16, fontSize:13, color:'#9aa3b2'}}>
                      <span>{say("Still owed:")}{' '}{say(data.payouts)}</span>
                      <span>{say("Net:")}{' '}{say(data.fees)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
            <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:20}}>{say("Year, week, and day")}</h2>
            <p style={{color:'#9aa3b2', lineHeight:1.5}}>
              {say("These months use the same America/New_York calendar as Fee Year-End. Open that report to go from a month to its weeks and days.")}
            </p>
            <Link href="/admin/fee-year-end" style={{color:'#e5332a', fontWeight:700}}>{say("Open Fee Year-End")}</Link>
          </div>
        </div>

        {/* Transaction Summary */}
        <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
          <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:20}}>{say("Transaction Summary")}</h2>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(250px, 1fr))', gap:16}}>
            <div style={{background:'rgba(255,255,255,0.05)', borderRadius:8, padding:16}}>
              <div style={{fontSize:13, color:'#9aa3b2', marginBottom:4}}>{say("Fee rows")}</div>
              <div style={{fontSize:24, fontWeight:700, color:'#e5e7eb'}}>{stats.transactionCount.toLocaleString()}</div>
            </div>
            <div style={{background:'rgba(255,255,255,0.05)', borderRadius:8, padding:16}}>
              <div style={{fontSize:13, color:'#9aa3b2', marginBottom:4}}>{say("Customer fee")}</div>
              <div style={{fontSize:24, fontWeight:700, color:'#f59e0b'}}>{say("Grossed up")}</div>
            </div>
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  );
}

