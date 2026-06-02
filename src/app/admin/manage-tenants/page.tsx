'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaBuilding, FaChartBar, FaClipboardList, FaCreditCard, FaHourglassHalf, FaMapMarkerAlt, FaStore, FaTimes } from 'react-icons/fa';

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
  // Subscription
  subscription?: {
    id: string;
    plan: string;
    status: string;
    isTrialing: boolean;
    isActive: boolean;
    trialDaysLeft: number;
    monthlyFee: number;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    hasStripe: boolean;
  } | null;
};

type LiveMetrics = {
  totalCustomers: number;
  newCustomersThisMonth: number;
  customerGrowth: string;
  mrr: number;
  arr: number;
  arpu: number;
  ltv: number;
  churnRate: string;
  retentionRate: string;
  totalWorkOrderRevenue: number;
  totalJobs: number;
  totalJobsThisMonth: number;
  jobsGrowth: string;
  planDistribution: Record<string, number>;
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
  const _router = useRouter();
  const { user, isLoading } = useRequireAuth(['admin']);
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [updatingSubscription, setUpdatingSubscription] = useState(false);
  const [tenantMsg, setTenantMsg] = useState<{type:'success'|'error';text:string}|null>(null);
  const [cancelConfirmId, setCancelConfirmId] = useState<string|null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleUpdatePlan = async (shopId: string, newPlan: string) => {
    void shopId;
    void newPlan;
    setTenantMsg({ type: 'error', text: 'Plan management has been removed.' });
  };

  const handleCancelSubscription = async (shopId: string) => {
    void shopId;
    setCancelConfirmId(null);
    setTenantMsg({ type: 'error', text: 'Cancellation controls have been removed.' });
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
        Loading...
      </div>
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

  const getPlanColor = (plan: string) => {
    const colors: Record<string, string> = {
      enterprise: '#8b5cf6',
      professional: '#3b82f6',
      business: '#22c55e',
      growth: '#06b6d4',
      starter: '#f59e0b',
      free: '#6b7280',
    };
    return colors[plan?.toLowerCase()] || '#9aa3b2';
  };

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(59,130,246,0.3)', padding:'20px 32px'}}>
        <div style={{maxWidth:1400, margin:'0 auto'}}>
          <Link href="/admin/home" style={{color:'#3b82f6', textDecoration:'none', fontSize:14, fontWeight:600, marginBottom:16, display:'inline-block'}}>
            <FaArrowLeft style={{marginRight:4}} /> Back to Dashboard
          </Link>
          <h1 style={{fontSize:28, fontWeight:700, color:'#e5e7eb', marginBottom:8}}><FaBuilding style={{marginRight:4}} /> Manage Tenants</h1>
          <p style={{fontSize:14, color:'#9aa3b2'}}>Manage all tenant organizations and subscriptions</p>
        </div>
      </div>

      <div style={{maxWidth:1400, margin:'0 auto', padding:32}}>
        {/* Live Metrics Overview */}
        {liveMetrics && (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:16, marginBottom:24}}>
            <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:12, padding:20}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                <div>
                  <div style={{fontSize:12, color:'#9aa3b2', marginBottom:4}}>Total Tenants</div>
                  <div style={{fontSize:28, fontWeight:700, color:'#22c55e'}}>{liveMetrics.totalCustomers}</div>
                </div>
                <span style={{padding:'4px 8px', background:'rgba(34,197,94,0.2)', color:'#22c55e', borderRadius:6, fontSize:11, fontWeight:600}}>
                  {liveMetrics.customerGrowth}
                </span>
              </div>
              <MiniLineChart data={liveMetrics.customerTrend} color="#22c55e" height={30} />
            </div>
            
            <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(59,130,246,0.3)', borderRadius:12, padding:20}}>
              <div style={{fontSize:12, color:'#9aa3b2', marginBottom:4}}>MRR</div>
              <div style={{fontSize:28, fontWeight:700, color:'#3b82f6'}}>{formatCurrency(liveMetrics.mrr)}</div>
              <div style={{fontSize:11, color:'#6b7280', marginTop:4}}>ARR: {formatCurrency(liveMetrics.arr)}</div>
            </div>
            
            <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(139,92,246,0.3)', borderRadius:12, padding:20}}>
              <div style={{fontSize:12, color:'#9aa3b2', marginBottom:4}}>Total Revenue</div>
              <div style={{fontSize:28, fontWeight:700, color:'#8b5cf6'}}>{formatCurrency(liveMetrics.totalWorkOrderRevenue)}</div>
              <MiniLineChart data={liveMetrics.revenueTrend} color="#8b5cf6" height={30} />
            </div>
            
            <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:12, padding:20}}>
              <div style={{fontSize:12, color:'#9aa3b2', marginBottom:4}}>ARPU / LTV</div>
              <div style={{fontSize:28, fontWeight:700, color:'#f59e0b'}}>{formatCurrency(liveMetrics.arpu)}</div>
              <div style={{fontSize:11, color:'#6b7280', marginTop:4}}>LTV: {formatCurrency(liveMetrics.ltv)}</div>
            </div>

            <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:12, padding:20}}>
              <div style={{fontSize:12, color:'#9aa3b2', marginBottom:4}}>Retention</div>
              <div style={{fontSize:28, fontWeight:700, color:'#22c55e'}}>{liveMetrics.retentionRate}</div>
              <div style={{fontSize:11, color:'#e5332a', marginTop:4}}>Churn: {liveMetrics.churnRate}</div>
            </div>
            
            <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(6,182,212,0.3)', borderRadius:12, padding:20}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                <div>
                  <div style={{fontSize:12, color:'#9aa3b2', marginBottom:4}}>Total Jobs</div>
                  <div style={{fontSize:28, fontWeight:700, color:'#06b6d4'}}>{liveMetrics.totalJobs}</div>
                </div>
                <span style={{padding:'4px 8px', background:'rgba(6,182,212,0.2)', color:'#06b6d4', borderRadius:6, fontSize:11, fontWeight:600}}>
                  {liveMetrics.jobsGrowth}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Plan Distribution */}
        {liveMetrics && (
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(59,130,246,0.3)', borderRadius:12, padding:20, marginBottom:24}}>
            <h3 style={{fontSize:14, fontWeight:600, color:'#e5e7eb', marginBottom:16}}><FaChartBar style={{marginRight:4}} /> Plan Distribution</h3>
            <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
              {Object.entries(liveMetrics.planDistribution).map(([plan, count]) => (
                <div key={plan} style={{background:'rgba(255,255,255,0.05)', borderRadius:8, padding:'12px 20px', textAlign:'center', minWidth:80}}>
                  <div style={{fontSize:24, fontWeight:700, color:getPlanColor(plan)}}>{count}</div>
                  <div style={{fontSize:11, color:'#9aa3b2', textTransform:'capitalize'}}>{plan}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div style={{textAlign:'center', padding:48, color:'#9aa3b2'}}>
            <div style={{fontSize:32, marginBottom:16}}><FaHourglassHalf style={{marginRight:4}} /></div>
            <div>Loading tenants...</div>
          </div>
        ) : tenants.length === 0 ? (
          <div style={{textAlign:'center', padding:48, color:'#9aa3b2'}}>
            <div style={{fontSize:32, marginBottom:16}}><FaBuilding style={{marginRight:4}} /></div>
            <div>No tenants found</div>
          </div>
        ) : (
          <div style={{display:'grid', gap:16}}>
            {tenants.map((tenant) => (
            <div key={tenant.id} style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(59,130,246,0.3)', borderRadius:12, padding:24}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16}}>
                <div>
                  <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:8}}>
                    <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb'}}>{tenant.name}</h2>
                    {tenant.subscription && (
                      <span style={{padding:'4px 12px', background:`${getPlanColor(tenant.subscription.plan)}20`, color:getPlanColor(tenant.subscription.plan), borderRadius:8, fontSize:11, fontWeight:600}}>
                        {tenant.subscription.plan?.toUpperCase() || 'FREE'}
                      </span>
                    )}
                    <span style={{
                      padding:'4px 12px', 
                      background:`${getHealthColor(tenant.healthScore)}20`, 
                      color:getHealthColor(tenant.healthScore), 
                      borderRadius:8, 
                      fontSize:11, 
                      fontWeight:600
                    }}>
                      Health: {tenant.healthScore}
                    </span>
                  </div>
                  <div style={{fontSize:14, color:'#9aa3b2'}}><FaMapMarkerAlt style={{marginRight:4}} /> {tenant.location} - Owner: {tenant.ownerName}</div>
                </div>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))', gap:12, marginBottom:16, padding:16, background:'rgba(255,255,255,0.05)', borderRadius:8}}>
                <div>
                  <div style={{fontSize:11, color:'#6b7280', marginBottom:4}}>Team</div>
                  <div style={{fontSize:18, color:'#8b5cf6', fontWeight:700}}>{tenant.teamMembers}</div>
                  <div style={{fontSize:10, color:'#6b7280'}}>{tenant.activeTeamMembers} active</div>
                </div>
                <div>
                  <div style={{fontSize:11, color:'#6b7280', marginBottom:4}}>Jobs</div>
                  <div style={{fontSize:18, color:'#3b82f6', fontWeight:700}}>{tenant.completedJobs}/{tenant.totalJobs}</div>
                  <div style={{fontSize:10, color:'#6b7280'}}>{tenant.completionRate}% done</div>
                </div>
                <div>
                  <div style={{fontSize:11, color:'#6b7280', marginBottom:4}}>Revenue</div>
                  <div style={{fontSize:18, color:'#22c55e', fontWeight:700}}>{formatCurrency(tenant.totalRevenue)}</div>
                  <div style={{fontSize:10, color:'#6b7280'}}>This mo: {formatCurrency(tenant.revenueThisMonth)}</div>
                </div>
                <div>
                  <div style={{fontSize:11, color:'#6b7280', marginBottom:4}}>Lifetime</div>
                  <div style={{fontSize:18, color:'#f59e0b', fontWeight:700}}>{tenant.lifetimeMonths} mo</div>
                </div>
                {tenant.subscription && (
                  <div>
                    <div style={{fontSize:11, color:'#6b7280', marginBottom:4}}>Subscription</div>
                    <div style={{fontSize:14, fontWeight:700, color: tenant.subscription.isActive ? '#22c55e' : tenant.subscription.isTrialing ? '#f59e0b' : '#e5332a'}}>
                      {tenant.subscription.isTrialing ? `Trial (${tenant.subscription.trialDaysLeft}d)` : tenant.subscription.status}
                    </div>
                    <div style={{fontSize:10, color:'#6b7280'}}>{formatCurrency(tenant.subscription.monthlyFee)}/mo</div>
                  </div>
                )}
              </div>

              <div style={{display:'flex', gap:12}}>
                <button 
                  onClick={() => { setSelectedTenant(tenant); setShowDetails(true); }}
                  style={{flex:1, padding:'12px', background:'rgba(59,130,246,0.2)', color:'#3b82f6', border:'1px solid rgba(59,130,246,0.3)', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}
                >
                  View Details
                </button>
                <button 
                  onClick={() => { setSelectedTenant(tenant); setShowSubscription(true); }}
                  style={{padding:'12px 24px', background:'rgba(255,255,255,0.1)', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}
                >
                  Manage Subscription
                </button>
              </div>
            </div>
          ))}
          </div>
        )}
      </div>

      {showSubscription && selectedTenant && (
        <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:32}}>
          <div style={{background:'linear-gradient(135deg, #3d3d3d 0%, #4a4a4a 50%, #525252 100%)', border:'2px solid rgba(59,130,246,0.3)', borderRadius:16, padding:32, maxWidth:800, width:'100%', maxHeight:'90vh', overflow:'auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24}}>
              <h2 style={{fontSize:24, fontWeight:700, color:'#e5e7eb'}}><FaCreditCard style={{marginRight:4}} /> Subscription Management</h2>
              <button onClick={() => setShowSubscription(false)} style={{padding:'8px 16px', background:'rgba(255,255,255,0.1)', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}>
                <FaTimes style={{marginRight:4}} /> Close
              </button>
            </div>

            <div style={{marginBottom:24}}>
              <h3 style={{fontSize:18, fontWeight:600, color:'#e5e7eb', marginBottom:8}}>{selectedTenant.name}</h3>
              <p style={{fontSize:14, color:'#9aa3b2'}}>Manage subscription and billing settings</p>
            </div>

            {/* Current Plan */}
            <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(59,130,246,0.3)', borderRadius:12, padding:24, marginBottom:24}}>
              <h4 style={{fontSize:16, fontWeight:600, color:'#e5e7eb', marginBottom:16}}><FaClipboardList style={{marginRight:4}} /> Current Plan</h4>
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:16}}>
                <div>
                  <div style={{fontSize:12, color:'#6b7280', marginBottom:4}}>Plan</div>
                  <div style={{fontSize:18, color:getPlanColor(selectedTenant.subscription?.plan || 'free'), fontWeight:600}}>
                    {selectedTenant.subscription?.plan || 'Free'}
                  </div>
                </div>
                <div>
                  <div style={{fontSize:12, color:'#6b7280', marginBottom:4}}>Status</div>
                  <span style={{
                    padding:'4px 12px', 
                    background: selectedTenant.subscription?.isActive ? '#22c55e20' : selectedTenant.subscription?.isTrialing ? '#f59e0b20' : '#e5332a20', 
                    color: selectedTenant.subscription?.isActive ? '#22c55e' : selectedTenant.subscription?.isTrialing ? '#f59e0b' : '#e5332a', 
                    borderRadius:8, 
                    fontSize:12, 
                    fontWeight:600
                  }}>
                    {selectedTenant.subscription?.status?.toUpperCase() || 'NONE'}
                  </span>
                </div>
                <div>
                  <div style={{fontSize:12, color:'#6b7280', marginBottom:4}}>Monthly Fee</div>
                  <div style={{fontSize:18, color:'#22c55e', fontWeight:600}}>{formatCurrency(selectedTenant.subscription?.monthlyFee || 0)}</div>
                </div>
                {selectedTenant.subscription?.isTrialing && (
                  <div>
                    <div style={{fontSize:12, color:'#6b7280', marginBottom:4}}>Trial Days Left</div>
                    <div style={{fontSize:18, color:'#f59e0b', fontWeight:600}}>{selectedTenant.subscription.trialDaysLeft} days</div>
                  </div>
                )}
              </div>
              {selectedTenant.subscription?.currentPeriodEnd && (
                <div style={{marginTop:16}}>
                  <div style={{fontSize:12, color:'#6b7280', marginBottom:4}}>Current Period Ends</div>
                  <div style={{fontSize:14, color:'#e5e7eb'}}>{new Date(selectedTenant.subscription.currentPeriodEnd).toLocaleDateString()}</div>
                </div>
              )}
            </div>

            {/* Usage Statistics */}
            <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(59,130,246,0.3)', borderRadius:12, padding:24, marginBottom:24}}>
              <h4 style={{fontSize:16, fontWeight:600, color:'#e5e7eb', marginBottom:16}}><FaChartBar style={{marginRight:4}} /> Current Usage</h4>
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))', gap:16}}>
                <div>
                  <div style={{fontSize:12, color:'#6b7280', marginBottom:4}}>Jobs Completed</div>
                  <div style={{fontSize:24, color:'#3b82f6', fontWeight:700}}>{selectedTenant.completedJobs}</div>
                </div>
                <div>
                  <div style={{fontSize:12, color:'#6b7280', marginBottom:4}}>Total Revenue</div>
                  <div style={{fontSize:24, color:'#22c55e', fontWeight:700}}>{formatCurrency(selectedTenant.totalRevenue)}</div>
                </div>
                <div>
                  <div style={{fontSize:12, color:'#6b7280', marginBottom:4}}>Team Members</div>
                  <div style={{fontSize:24, color:'#8b5cf6', fontWeight:700}}>{selectedTenant.teamMembers}</div>
                </div>
                <div>
                  <div style={{fontSize:12, color:'#6b7280', marginBottom:4}}>Health Score</div>
                  <div style={{fontSize:24, color:getHealthColor(selectedTenant.healthScore), fontWeight:700}}>{selectedTenant.healthScore}</div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{display:'flex', gap:12, justifyContent:'flex-end'}}>
              <button 
                onClick={() => setShowSubscription(false)}
                style={{padding:'12px 24px', background:'rgba(255,255,255,0.1)', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdatePlan(selectedTenant.id, selectedTenant.subscription?.plan === 'starter' ? 'growth' : selectedTenant.subscription?.plan === 'growth' ? 'professional' : 'enterprise')}
                disabled={updatingSubscription}
                style={{
                  padding:'12px 24px',
                  background: updatingSubscription ? 'rgba(59,130,246,0.5)' : 'rgba(59,130,246,0.8)',
                  color:'#ffffff',
                  border:'none',
                  borderRadius:8,
                  fontSize:14,
                  fontWeight:600,
                  cursor: updatingSubscription ? 'not-allowed' : 'pointer',
                  opacity: updatingSubscription ? 0.6 : 1
                }}
              >
                {updatingSubscription ? 'Updating...' : 'Upgrade Plan'}
              </button>
              <button
                onClick={() => setCancelConfirmId(selectedTenant.id)}
                disabled={updatingSubscription}
                style={{
                  padding:'12px 24px',
                  background: updatingSubscription ? 'rgba(239,68,68,0.5)' : 'rgba(239,68,68,0.8)',
                  color:'#ffffff',
                  border:'none',
                  borderRadius:8,
                  fontSize:14,
                  fontWeight:600,
                  cursor: updatingSubscription ? 'not-allowed' : 'pointer',
                  opacity: updatingSubscription ? 0.6 : 1
                }}
              >
                {updatingSubscription ? 'Cancelling...' : 'Cancel Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetails && selectedTenant && (
        <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:32}}>
          <div style={{background:'linear-gradient(135deg, #3d3d3d 0%, #4a4a4a 50%, #525252 100%)', border:'2px solid rgba(59,130,246,0.3)', borderRadius:16, padding:32, maxWidth:700, width:'100%', maxHeight:'90vh', overflow:'auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24}}>
              <h2 style={{fontSize:24, fontWeight:700, color:'#e5e7eb'}}><FaBuilding style={{marginRight:4}} /> Tenant Details</h2>
              <button onClick={() => setShowDetails(false)} style={{padding:'8px 16px', background:'rgba(255,255,255,0.1)', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}>
                <FaTimes style={{marginRight:4}} /> Close
              </button>
            </div>

            <div style={{display:'grid', gap:16}}>
              {/* Business Info */}
              <div style={{background:'rgba(0,0,0,0.3)', borderRadius:12, padding:20}}>
                <h3 style={{fontSize:16, fontWeight:600, color:'#e5e7eb', marginBottom:12}}><FaStore style={{marginRight:4}} /> Business Info</h3>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                  <div><span style={{color:'#6b7280'}}>Shop Name:</span> <span style={{color:'#e5e7eb', fontWeight:600}}>{selectedTenant.name}</span></div>
                  <div><span style={{color:'#6b7280'}}>Owner:</span> <span style={{color:'#e5e7eb', fontWeight:600}}>{selectedTenant.ownerName}</span></div>
                  <div><span style={{color:'#6b7280'}}>Email:</span> <span style={{color:'#e5e7eb', fontWeight:600}}>{selectedTenant.email}</span></div>
                  <div><span style={{color:'#6b7280'}}>Phone:</span> <span style={{color:'#e5e7eb', fontWeight:600}}>{selectedTenant.phone}</span></div>
                  <div><span style={{color:'#6b7280'}}>Location:</span> <span style={{color:'#e5e7eb', fontWeight:600}}>{selectedTenant.location}</span></div>
                  <div><span style={{color:'#6b7280'}}>Shop Type:</span> <span style={{color:'#e5e7eb', fontWeight:600}}>{selectedTenant.shopType}</span></div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div style={{background:'rgba(0,0,0,0.3)', borderRadius:12, padding:20}}>
                <h3 style={{fontSize:16, fontWeight:600, color:'#e5e7eb', marginBottom:12}}><FaChartBar style={{marginRight:4}} /> Performance</h3>
                <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12}}>
                  <div style={{textAlign:'center', padding:12, background:'rgba(59,130,246,0.1)', borderRadius:8}}>
                    <div style={{fontSize:24, fontWeight:700, color:'#3b82f6'}}>{selectedTenant.completedJobs}</div>
                    <div style={{fontSize:11, color:'#9aa3b2'}}>Jobs Done</div>
                  </div>
                  <div style={{textAlign:'center', padding:12, background:'rgba(34,197,94,0.1)', borderRadius:8}}>
                    <div style={{fontSize:24, fontWeight:700, color:'#22c55e'}}>{formatCurrency(selectedTenant.totalRevenue)}</div>
                    <div style={{fontSize:11, color:'#9aa3b2'}}>Revenue</div>
                  </div>
                  <div style={{textAlign:'center', padding:12, background:'rgba(139,92,246,0.1)', borderRadius:8}}>
                    <div style={{fontSize:24, fontWeight:700, color:'#8b5cf6'}}>{selectedTenant.completionRate}%</div>
                    <div style={{fontSize:11, color:'#9aa3b2'}}>Completion</div>
                  </div>
                  <div style={{textAlign:'center', padding:12, background:`${getHealthColor(selectedTenant.healthScore)}15`, borderRadius:8}}>
                    <div style={{fontSize:24, fontWeight:700, color:getHealthColor(selectedTenant.healthScore)}}>{selectedTenant.healthScore}</div>
                    <div style={{fontSize:11, color:'#9aa3b2'}}>Health</div>
                  </div>
                </div>
              </div>

              {/* Subscription */}
              {selectedTenant.subscription && (
                <div style={{background:'rgba(0,0,0,0.3)', borderRadius:12, padding:20}}>
                  <h3 style={{fontSize:16, fontWeight:600, color:'#e5e7eb', marginBottom:12}}><FaCreditCard style={{marginRight:4}} /> Subscription</h3>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                    <div><span style={{color:'#6b7280'}}>Plan:</span> <span style={{color:getPlanColor(selectedTenant.subscription.plan), fontWeight:600}}>{selectedTenant.subscription.plan}</span></div>
                    <div><span style={{color:'#6b7280'}}>Status:</span> <span style={{color: selectedTenant.subscription.isActive ? '#22c55e' : '#f59e0b', fontWeight:600}}>{selectedTenant.subscription.status}</span></div>
                    <div><span style={{color:'#6b7280'}}>Monthly:</span> <span style={{color:'#e5e7eb', fontWeight:600}}>{formatCurrency(selectedTenant.subscription.monthlyFee)}</span></div>
                    <div><span style={{color:'#6b7280'}}>Stripe:</span> <span style={{color: selectedTenant.subscription.hasStripe ? '#22c55e' : '#6b7280', fontWeight:600}}>{selectedTenant.subscription.hasStripe ? 'Connected' : 'Not Connected'}</span></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {cancelConfirmId && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div style={{background:'#1e2533',borderRadius:14,padding:32,minWidth:320,maxWidth:440,boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}>
            <h3 style={{fontSize:18,fontWeight:700,color:'#e5e7eb',marginBottom:12}}>Cancel Subscription?</h3>
            <p style={{fontSize:14,color:'#9aa3b2',marginBottom:24}}>Are you sure you want to cancel this subscription? This action cannot be undone.</p>
            <div style={{display:'flex',gap:12}}>
              <button onClick={()=>handleCancelSubscription(cancelConfirmId)} disabled={updatingSubscription} style={{flex:1,padding:'10px 0',background:'#ef4444',color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:700,cursor:'pointer'}}>Cancel Subscription</button>
              <button onClick={()=>setCancelConfirmId(null)} style={{flex:1,padding:'10px 0',background:'transparent',color:'#9aa3b2',border:'1px solid rgba(255,255,255,0.15)',borderRadius:8,fontSize:14,cursor:'pointer'}}>Keep</button>
            </div>
          </div>
        </div>
      )}
      {tenantMsg && (
        <div style={{position:'fixed',bottom:24,right:24,background:tenantMsg.type==='success'?'#dcfce7':'#fde8e8',color:tenantMsg.type==='success'?'#166534':'#991b1b',borderRadius:10,padding:'12px 20px',zIndex:9999,fontSize:14,fontWeight:600,boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
          {tenantMsg.text}
          <button onClick={()=>setTenantMsg(null)} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer',fontSize:16,color:'inherit'}}>×</button>
        </div>
      )}
    </div>
  );
}
