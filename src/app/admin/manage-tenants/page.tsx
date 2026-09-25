'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaBuilding, FaChartBar, FaHourglassHalf, FaMapMarkerAlt, FaStore, FaTimes } from 'react-icons/fa';

type Tenant = {
  id: string;
  name: string;
  ownerName: string;
  email: string;
  phone: string;
  location: string;
  shopType: string;
  profileComplete: boolean;
  createdAt: string;
  // Live metrics
  totalJobs: number;
  completedJobs: number;
  completionRate: number;
  totalRevenue: number;
  revenueThisMonth: number;
  jobsThisMonth: number;
  rating: number;
  reviewCount: number;
  // Team
  teamMembers: number;
  activeTeamMembers: number;
  // Health
  healthScore: number;
  lifetimeMonths: number;
};

type LiveMetrics = {
  totalCustomers: number;
  newCustomersThisMonth: number;
  customerGrowth: string;
  totalWorkOrderRevenue: number;
  totalJobs: number;
  totalJobsThisMonth: number;
  jobsGrowth: string;
  healthDistribution: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
  customerTrend: number[];
  revenueTrend: number[];
};

// Mini chart component
function MiniLineChart({ data, color, height = 40 }: { data: number[]; color: string; height?: number }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const width = 100;
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ManageTenants() {
  const say = usePhrase();
  const { user, isLoading } = useRequireAuth(['admin']);
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [tenantMsg, setTenantMsg] = useState<{type:'success'|'error';text:string}|null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  useEffect(() => {
    if (isLoading || !user) return;
    
    const fetchTenants = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/customers', {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setTenants(data.customers);
            setLiveMetrics(data.liveMetrics);
          }
        }
      } catch (error) {
        console.error('Error fetching tenants:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTenants();
    
    // Auto-refresh every 2 minutes
    const interval = setInterval(fetchTenants, 2 * 60 * 1000);
    return () => clearInterval(interval);
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

  if (!user) {
    return null;
  }

  const getHealthColor = (score: number) => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#3b82f6';
    if (score >= 40) return '#f59e0b';
    return '#e5332a';
  };

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(59,130,246,0.3)', padding:'20px 32px'}}>
        <div style={{maxWidth:1400, margin:'0 auto'}}>
          <Link href="/admin/home" style={{color:'#3b82f6', textDecoration:'none', fontSize:14, fontWeight:600, marginBottom:16, display:'inline-block'}}>
            <FaArrowLeft style={{marginRight:4}} /> {say("Back to Dashboard")}{' '}</Link>
          <h1 style={{fontSize:28, fontWeight:700, color:'#e5e7eb', marginBottom:8}}><FaBuilding style={{marginRight:4}} /> {say("Manage Tenants")}</h1>
          <p style={{fontSize:14, color:'#9aa3b2'}}>{say("Manage all tenant organizations")}</p>
        </div>
      </div>

      <div style={{maxWidth:1400, margin:'0 auto', padding:32}}>
        {/* Live Metrics Overview */}
        {liveMetrics && (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:16, marginBottom:24}}>
            <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:12, padding:20}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                <div>
                  <div style={{fontSize:12, color:'#9aa3b2', marginBottom:4}}>{say("Total Tenants")}</div>
                  <div style={{fontSize:28, fontWeight:700, color:'#22c55e'}}>{say(liveMetrics.totalCustomers)}</div>
                </div>
                <span style={{padding:'4px 8px', background:'rgba(34,197,94,0.2)', color:'#22c55e', borderRadius:6, fontSize:11, fontWeight:600}}>
                  {say(liveMetrics.customerGrowth)}
                </span>
              </div>
              <MiniLineChart data={liveMetrics.customerTrend} color="#22c55e" height={30} />
            </div>
            
            <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(139,92,246,0.3)', borderRadius:12, padding:20}}>
              <div style={{fontSize:12, color:'#9aa3b2', marginBottom:4}}>{say("Total Revenue")}</div>
              <div style={{fontSize:28, fontWeight:700, color:'#8b5cf6'}}>{formatCurrency(liveMetrics.totalWorkOrderRevenue)}</div>
              <MiniLineChart data={liveMetrics.revenueTrend} color="#8b5cf6" height={30} />
            </div>
            
            <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(6,182,212,0.3)', borderRadius:12, padding:20}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                <div>
                  <div style={{fontSize:12, color:'#9aa3b2', marginBottom:4}}>{say("Total Jobs")}</div>
                  <div style={{fontSize:28, fontWeight:700, color:'#06b6d4'}}>{say(liveMetrics.totalJobs)}</div>
                </div>
                <span style={{padding:'4px 8px', background:'rgba(6,182,212,0.2)', color:'#06b6d4', borderRadius:6, fontSize:11, fontWeight:600}}>
                  {say(liveMetrics.jobsGrowth)}
                </span>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{textAlign:'center', padding:48, color:'#9aa3b2'}}>
            <div style={{fontSize:32, marginBottom:16}}><FaHourglassHalf style={{marginRight:4}} /></div>
            <div>{say("Loading tenants...")}</div>
          </div>
        ) : tenants.length === 0 ? (
          <div style={{textAlign:'center', padding:48, color:'#9aa3b2'}}>
            <div style={{fontSize:32, marginBottom:16}}><FaBuilding style={{marginRight:4}} /></div>
            <div>{say("No tenants found")}</div>
          </div>
        ) : (
          <div style={{display:'grid', gap:16}}>
            {tenants.map((tenant) => (
            <div key={tenant.id} style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(59,130,246,0.3)', borderRadius:12, padding:24}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16}}>
                <div>
                  <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:8}}>
                    <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb'}}>{say(tenant.name)}</h2>
                    <span style={{
                      padding:'4px 12px', 
                      background:`${getHealthColor(tenant.healthScore)}20`, 
                      color:getHealthColor(tenant.healthScore), 
                      borderRadius:8, 
                      fontSize:11, 
                      fontWeight:600
                    }}>
                      {say("Health:")}{' '}{say(tenant.healthScore)}
                    </span>
                  </div>
                  <div style={{fontSize:14, color:'#9aa3b2'}}><FaMapMarkerAlt style={{marginRight:4}} /> {say(tenant.location)} {say("- Owner:")}{' '}{say(tenant.ownerName)}</div>
                </div>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))', gap:12, marginBottom:16, padding:16, background:'rgba(255,255,255,0.05)', borderRadius:8}}>
                <div>
                  <div style={{fontSize:11, color:'#6b7280', marginBottom:4}}>{say("Team")}</div>
                  <div style={{fontSize:18, color:'#8b5cf6', fontWeight:700}}>{say(tenant.teamMembers)}</div>
                  <div style={{fontSize:10, color:'#6b7280'}}>{say(tenant.activeTeamMembers)} active</div>
                </div>
                <div>
                  <div style={{fontSize:11, color:'#6b7280', marginBottom:4}}>{say("Jobs")}</div>
                  <div style={{fontSize:18, color:'#3b82f6', fontWeight:700}}>{say(tenant.completedJobs)}/{say(tenant.totalJobs)}</div>
                  <div style={{fontSize:10, color:'#6b7280'}}>{say(tenant.completionRate)}{say("% done")}</div>
                </div>
                <div>
                  <div style={{fontSize:11, color:'#6b7280', marginBottom:4}}>{say("Revenue")}</div>
                  <div style={{fontSize:18, color:'#22c55e', fontWeight:700}}>{formatCurrency(tenant.totalRevenue)}</div>
                  <div style={{fontSize:10, color:'#6b7280'}}>{say("This mo:")}{' '}{formatCurrency(tenant.revenueThisMonth)}</div>
                </div>
                <div>
                  <div style={{fontSize:11, color:'#6b7280', marginBottom:4}}>{say("Lifetime")}</div>
                  <div style={{fontSize:18, color:'#f59e0b', fontWeight:700}}>{say(tenant.lifetimeMonths)} mo</div>
                </div>
              </div>

              <div style={{display:'flex', gap:12}}>
                <button 
                  onClick={() => { setSelectedTenant(tenant); setShowDetails(true); }}
                  style={{flex:1, padding:'12px', background:'rgba(59,130,246,0.2)', color:'#3b82f6', border:'1px solid rgba(59,130,246,0.3)', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}
                >
                  {say("View Details")}{' '}</button>
              </div>
            </div>
          ))}
          </div>
        )}
      </div>

      {showDetails && selectedTenant && (
        <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:32}}>
          <div style={{background:'linear-gradient(135deg, #3d3d3d 0%, #4a4a4a 50%, #525252 100%)', border:'2px solid rgba(59,130,246,0.3)', borderRadius:16, padding:32, maxWidth:700, width:'100%', maxHeight:'90vh', overflow:'auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24}}>
              <h2 style={{fontSize:24, fontWeight:700, color:'#e5e7eb'}}><FaBuilding style={{marginRight:4}} /> {say("Tenant Details")}</h2>
              <button onClick={() => setShowDetails(false)} style={{padding:'8px 16px', background:'rgba(255,255,255,0.1)', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}>
                <FaTimes style={{marginRight:4}} /> {say("Close")}{' '}</button>
            </div>

            <div style={{display:'grid', gap:16}}>
              {/* Business Info */}
              <div style={{background:'rgba(0,0,0,0.3)', borderRadius:12, padding:20}}>
                <h3 style={{fontSize:16, fontWeight:600, color:'#e5e7eb', marginBottom:12}}><FaStore style={{marginRight:4}} /> {say("Business Info")}</h3>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                  <div><span style={{color:'#6b7280'}}>{say("Shop Name:")}</span> <span style={{color:'#e5e7eb', fontWeight:600}}>{say(selectedTenant.name)}</span></div>
                  <div><span style={{color:'#6b7280'}}>{say("Owner:")}</span> <span style={{color:'#e5e7eb', fontWeight:600}}>{say(selectedTenant.ownerName)}</span></div>
                  <div><span style={{color:'#6b7280'}}>{say("Email:")}</span> <span style={{color:'#e5e7eb', fontWeight:600}}>{say(selectedTenant.email)}</span></div>
                  <div><span style={{color:'#6b7280'}}>{say("Phone:")}</span> <span style={{color:'#e5e7eb', fontWeight:600}}>{say(selectedTenant.phone)}</span></div>
                  <div><span style={{color:'#6b7280'}}>{say("Location:")}</span> <span style={{color:'#e5e7eb', fontWeight:600}}>{say(selectedTenant.location)}</span></div>
                  <div><span style={{color:'#6b7280'}}>{say("Shop Type:")}</span> <span style={{color:'#e5e7eb', fontWeight:600}}>{say(selectedTenant.shopType)}</span></div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div style={{background:'rgba(0,0,0,0.3)', borderRadius:12, padding:20}}>
                <h3 style={{fontSize:16, fontWeight:600, color:'#e5e7eb', marginBottom:12}}><FaChartBar style={{marginRight:4}} /> {say("Performance")}</h3>
                <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12}}>
                  <div style={{textAlign:'center', padding:12, background:'rgba(59,130,246,0.1)', borderRadius:8}}>
                    <div style={{fontSize:24, fontWeight:700, color:'#3b82f6'}}>{say(selectedTenant.completedJobs)}</div>
                    <div style={{fontSize:11, color:'#9aa3b2'}}>{say("Jobs Done")}</div>
                  </div>
                  <div style={{textAlign:'center', padding:12, background:'rgba(34,197,94,0.1)', borderRadius:8}}>
                    <div style={{fontSize:24, fontWeight:700, color:'#22c55e'}}>{formatCurrency(selectedTenant.totalRevenue)}</div>
                    <div style={{fontSize:11, color:'#9aa3b2'}}>{say("Revenue")}</div>
                  </div>
                  <div style={{textAlign:'center', padding:12, background:'rgba(139,92,246,0.1)', borderRadius:8}}>
                    <div style={{fontSize:24, fontWeight:700, color:'#8b5cf6'}}>{say(selectedTenant.completionRate)}%</div>
                    <div style={{fontSize:11, color:'#9aa3b2'}}>{say("Completion")}</div>
                  </div>
                  <div style={{textAlign:'center', padding:12, background:`${getHealthColor(selectedTenant.healthScore)}15`, borderRadius:8}}>
                    <div style={{fontSize:24, fontWeight:700, color:getHealthColor(selectedTenant.healthScore)}}>{say(selectedTenant.healthScore)}</div>
                    <div style={{fontSize:11, color:'#9aa3b2'}}>{say("Health")}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {tenantMsg && (
        <div style={{position:'fixed',bottom:24,right:24,background:tenantMsg.type==='success'?'#dcfce7':'#fde8e8',color:tenantMsg.type==='success'?'#166534':'#991b1b',borderRadius:10,padding:'12px 20px',zIndex:9999,fontSize:14,fontWeight:600,boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
          {say(tenantMsg.text)}
          <button onClick={()=>setTenantMsg(null)} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer',fontSize:16,color:'inherit'}}>×</button>
        </div>
      )}
    </div>
  );
}
