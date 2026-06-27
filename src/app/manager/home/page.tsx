'use client';
import { FaBox, FaCalendarAlt, FaChartBar, FaClipboardList, FaDollarSign, FaExclamationCircle, FaUsers } from 'react-icons/fa';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TimeClock from '@/components/TimeClock';
import MessagingCard from '@/components/MessagingCard';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useIsMobile } from '@/hooks/useIsMobile';
import MobileShell from '@/components/MobileShell';
import { useRequireAuth } from '@/contexts/AuthContext';
import { useIsNative } from '@/context/NativeContext';

export default function ManagerHome() {
  const { user, isLoading } = useRequireAuth(['manager']);
  const isMobile = useIsMobile();
  const isNative = useIsNative();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [shopId, setShopId] = useState('');
  const [inventoryRequests, setInventoryRequests] = useState<any[]>([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [newRequest, setNewRequest] = useState({
    itemName: '',
    quantity: 1,
    reason: '',
    urgency: 'normal',
  });

  // Manager dashboard metrics state
  const [teamPerformance, setTeamPerformance] = useState<any[]>([]);
  const [workOrderStats, setWorkOrderStats] = useState({
    activeJobs: 0,
    pendingAssignments: 0,
    overdueJobs: 0,
    completedToday: 0,
  });
  const [financialSummary, setFinancialSummary] = useState({
    todayRevenue: 0,
    weeklyRevenue: 0,
    monthlyRevenue: 0,
    outstandingInvoices: 0,
  });
  const [teamSchedule, setTeamSchedule] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [urgentAlerts, setUrgentAlerts] = useState<any[]>([]);
  const [metricsReady, setMetricsReady] = useState(false);
  const [managerMsg, setManagerMsg] = useState<{type:'success'|'error';text:string}|null>(null);
  async function fetchInventoryRequests(shop?: string) {
    if (!shop) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/shop/inventory-requests?shopId=${shop}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const { requests } = await response.json();
        setInventoryRequests(requests);
      }
    } catch (error) {
      console.error('Error fetching inventory requests:', error);
    }
  }

  async function fetchTeamPerformance(shop?: string) {
    if (!shop) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/shop/team-performance?shopId=${shop}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const { performance } = await response.json();
        setTeamPerformance(performance || []);
      }
    } catch (error) {
      console.error('Error fetching team performance:', error);
    }
  }

  async function fetchWorkOrderStats(shop?: string) {
    if (!shop) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/shop/workorder-stats?shopId=${shop}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const { stats } = await response.json();
        setWorkOrderStats(stats || {
          activeJobs: 0,
          pendingAssignments: 0,
          overdueJobs: 0,
          completedToday: 0,
        });
      }
    } catch (error) {
      console.error('Error fetching work order stats:', error);
    }
  }

  async function fetchFinancialSummary(shop?: string) {
    if (!shop) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/shop/financial-summary?shopId=${shop}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const { summary } = await response.json();
        setFinancialSummary({
          todayRevenue: 0,
          weeklyRevenue: 0,
          monthlyRevenue: 0,
          outstandingInvoices: 0,
          ...(summary || {}),
        });
      }
    } catch (error) {
      console.error('Error fetching financial summary:', error);
    }
  }

  async function fetchTeamSchedule(shop?: string) {
    if (!shop) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/shop/team-schedule?shopId=${shop}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const { schedule } = await response.json();
        setTeamSchedule(schedule || []);
      }
    } catch (error) {
      console.error('Error fetching team schedule:', error);
    }
  }

  async function fetchRecentActivity(shop?: string) {
    if (!shop) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/shop/recent-activity?shopId=${shop}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const { activities } = await response.json();
        setRecentActivity(activities || []);
      }
    } catch (error) {
      console.error('Error fetching recent activity:', error);
    }
  }

  async function fetchUrgentAlerts(shop?: string) {
    if (!shop) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/shop/urgent-alerts?shopId=${shop}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const { alerts } = await response.json();
        setUrgentAlerts(alerts || []);
      }
    } catch (error) {
      console.error('Error fetching urgent alerts:', error);
    }
  }

  useEffect(() => {
    if (user?.name) setUserName(user.name);
    if (user?.id) setUserId(user.id);
    const currentShopId: string = user?.shopId ?? '';
    if (!currentShopId) return;

    setShopId(currentShopId);
    const loadDashboard = async () => {
      await Promise.all([
        fetchInventoryRequests(currentShopId),
        fetchTeamPerformance(currentShopId),
        fetchWorkOrderStats(currentShopId),
        fetchFinancialSummary(currentShopId),
        fetchTeamSchedule(currentShopId),
        fetchRecentActivity(currentShopId),
        fetchUrgentAlerts(currentShopId),
      ]);
    };

    setMetricsReady(false);
    loadDashboard().finally(() => setMetricsReady(true));

    const refresh = setInterval(() => {
      loadDashboard();
    }, 30 * 1000);

    return () => clearInterval(refresh);

  }, [user?.id, user?.name, user?.shopId]);

  const handleSubmitRequest = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/shop/inventory-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          shopId,
          requestedById: userId,
          ...newRequest,
        }),
      });

      if (response.ok) {
        setManagerMsg({type:'success',text:'Inventory request submitted successfully!'});
        setShowRequestForm(false);
        setNewRequest({ itemName: '', quantity: 1, reason: '', urgency: 'normal' });
        fetchInventoryRequests(shopId);
      } else {
        setManagerMsg({type:'error',text:'Failed to submit request'});
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      setManagerMsg({type:'error',text:'Error submitting request'});
    }
  };

  if (isNative || isMobile) {
    return <MobileShell role="manager" isHome userName={userName} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: 'transparent', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation */}
      <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton={true} />
      
      {/* Breadcrumbs */}
      <Breadcrumbs />
      
      {/* Main Layout with Sidebar */}
      <div style={{ display: 'flex', flex: 1 }}>
        {/* Sidebar */}
        <Sidebar role="manager" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        {/* Main Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Loading and user checks */}
          {isLoading ? (
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
          ) : !user ? null : (
            <div style={{maxWidth:1400, margin:'0 auto', padding:32}}>
              {!metricsReady ? (
                <div style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  padding: 24,
                  color: '#e5e7eb',
                  textAlign: 'center',
                  fontSize: 16,
                }}>
                  Syncing live manager dashboard data...
                </div>
              ) : (
              <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: isMobile ? 16 : 24}}>
                {/* Left Column */}
                <div style={{display:'grid', gap:24}}>
                  {/* Urgent Alerts */}
                  {urgentAlerts.length > 0 && (
                    <div style={{background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:12, padding:24}}>
                      <h2 style={{fontSize:20, fontWeight:700, color:'#ef4444', marginBottom:16}}><FaExclamationCircle style={{marginRight:4}} /> Urgent Alerts</h2>
                      <div style={{display:'grid', gap:12}}>
                        {urgentAlerts.map((alert, index) => (
                          <div key={index} style={{background:'rgba(239,68,68,0.1)', borderRadius:8, padding:16, border:'1px solid rgba(239,68,68,0.2)'}}>
                            <div style={{color:'#ef4444', fontWeight:600, marginBottom:4}}>{alert.title}</div>
                            <div style={{color:'#e5e7eb', fontSize:14}}>{alert.message}</div>
                            <div style={{color:'#9aa3b2', fontSize:12, marginTop:8}}>{new Date(alert.createdAt).toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Work Order Dashboard */}
                  <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
                    <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:20}}><FaClipboardList style={{marginRight:4}} /> Work Orders Overview</h2>
                    <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))', gap:16}}>
                      <div style={{textAlign:'center'}}>
                        <div style={{fontSize:28, fontWeight:700, color:'#e5332a'}}>{workOrderStats.activeJobs}</div>
                        <div style={{color:'#9aa3b2', fontSize:12}}>Active Jobs</div>
                      </div>
                      <div style={{textAlign:'center'}}>
                        <div style={{fontSize:28, fontWeight:700, color:'#f59e0b'}}>{workOrderStats.pendingAssignments}</div>
                        <div style={{color:'#9aa3b2', fontSize:12}}>Pending</div>
                      </div>
                      <div style={{textAlign:'center'}}>
                        <div style={{fontSize:28, fontWeight:700, color:'#ef4444'}}>{workOrderStats.overdueJobs}</div>
                        <div style={{color:'#9aa3b2', fontSize:12}}>Overdue</div>
                      </div>
                      <div style={{textAlign:'center'}}>
                        <div style={{fontSize:28, fontWeight:700, color:'#22c55e'}}>{workOrderStats.completedToday}</div>
                        <div style={{color:'#9aa3b2', fontSize:12}}>Completed Today</div>
                      </div>
                    </div>
                    <div style={{display:'flex', gap:12, marginTop:20}}>
                      <Link href="/manager/home" style={{flex:1, padding:12, background:'#e5332a', color:'white', borderRadius:8, textDecoration:'none', textAlign:'center', fontWeight:600}}>
                        View All Jobs
                      </Link>
                      <Link href="/manager/assignments" style={{flex:1, padding:12, background:'#6b7280', color:'white', borderRadius:8, textDecoration:'none', textAlign:'center', fontWeight:600}}>
                        Assign Work
                      </Link>
                    </div>
                  </div>

                  {/* Team Performance */}
                  <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
                    <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:20}}><FaUsers style={{marginRight:4}} /> Team Performance</h2>
                    <div style={{display:'grid', gap:12}}>
                      {teamPerformance.length === 0 ? (
                        <div style={{textAlign:'center', padding:32, color:'#9aa3b2'}}>
                          No team performance data available.
                        </div>
                      ) : (
                        teamPerformance.slice(0, 5).map((member) => (
                          <div key={member.id} style={{background:'rgba(255,255,255,0.05)', borderRadius:8, padding:16}}>
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                              <div style={{color:'#e5e7eb', fontWeight:600}}>{member.name}</div>
                              <div style={{color: member.isActive ? '#22c55e' : '#6b7280', fontSize:12}}>
                                {member.isActive ? ' Active' : ' Away'}
                              </div>
                            </div>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:13}}>
                              <div style={{color:'#9aa3b2'}}>Jobs: <span style={{color:'#e5e7eb'}}>{member.completedJobs || 0}</span></div>
                              <div style={{color:'#9aa3b2'}}>Hours: <span style={{color:'#e5e7eb'}}>{member.hoursToday || 0}</span></div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <Link href="/shop/manage-team" style={{display:'block', marginTop:16, padding:12, background:'#6b7280', color:'white', borderRadius:8, textDecoration:'none', textAlign:'center', fontWeight:600}}>
                      View Full Team
                    </Link>
                  </div>

                  {/* Inventory Requests */}
                  <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
                      <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb'}}><FaBox style={{marginRight:4}} /> Inventory Requests</h2>
                      <button
                        onClick={() => setShowRequestForm(!showRequestForm)}
                        style={{
                          padding:'8px 16px',
                          background:'#e5332a',
                          color:'white',
                          border:'none',
                          borderRadius:6,
                          cursor:'pointer',
                          fontSize:13,
                          fontWeight:600,
                        }}
                      >
                        + New Request
                      </button>
                    </div>

                    {showRequestForm && (
                      <div style={{background:'rgba(229,51,42,0.1)', border:'1px solid rgba(229,51,42,0.3)', borderRadius:8, padding:16, marginBottom:16}}>
                        <h3 style={{color:'#e5e7eb', marginBottom:12, fontSize:16}}>Request Inventory Item</h3>
                        <div style={{display:'grid', gap:12}}>
                          <input
                            type="text"
                            placeholder="Item name"
                            value={newRequest.itemName}
                            onChange={(e) => setNewRequest({...newRequest, itemName: e.target.value})}
                            style={{padding:10, borderRadius:6, border:'1px solid rgba(255,255,255,0.2)', background:'rgba(0,0,0,0.3)', color:'white'}}
                          />
                          <input
                            type="number"
                            placeholder="Quantity"
                            value={newRequest.quantity}
                            onChange={(e) => setNewRequest({...newRequest, quantity: parseInt(e.target.value)})}
                            style={{padding:10, borderRadius:6, border:'1px solid rgba(255,255,255,0.2)', background:'rgba(0,0,0,0.3)', color:'white'}}
                          />
                          <select
                            value={newRequest.urgency}
                            onChange={(e) => setNewRequest({...newRequest, urgency: e.target.value})}
                            style={{padding:10, borderRadius:6, border:'1px solid rgba(255,255,255,0.2)', background:'rgba(0,0,0,0.3)', color:'white'}}
                          >
                            <option value="low">Low Priority</option>
                            <option value="normal">Normal</option>
                            <option value="high">High Priority</option>
                            <option value="urgent">Urgent</option>
                          </select>
                          <textarea
                            placeholder="Reason for request"
                            value={newRequest.reason}
                            onChange={(e) => setNewRequest({...newRequest, reason: e.target.value})}
                            style={{padding:10, borderRadius:6, border:'1px solid rgba(255,255,255,0.2)', background:'rgba(0,0,0,0.3)', color:'white', minHeight:60}}
                          />
                          <div style={{display:'flex', gap:8}}>
                            <button
                              onClick={handleSubmitRequest}
                              style={{flex:1, padding:10, background:'#e5332a', color:'white', border:'none', borderRadius:6, cursor:'pointer', fontWeight:600}}
                            >
                              Submit Request
                            </button>
                            <button
                              onClick={() => setShowRequestForm(false)}
                              style={{flex:1, padding:10, background:'#6b7280', color:'white', border:'none', borderRadius:6, cursor:'pointer', fontWeight:600}}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div style={{display:'grid', gap:12}}>
                      {inventoryRequests.length === 0 ? (
                        <div style={{textAlign:'center', padding:32, color:'#9aa3b2'}}>
                          No inventory requests yet. Click "New Request" to submit one.
                        </div>
                      ) : (
                        inventoryRequests.map((req) => (
                          <div key={req.id} style={{background:'rgba(255,255,255,0.05)', borderRadius:8, padding:16}}>
                            <div style={{display:'flex', justifyContent:'space-between', marginBottom:8}}>
                              <div style={{color:'#e5e7eb', fontWeight:600}}>{req.itemName}</div>
                              <span style={{
                                padding:'4px 12px',
                                borderRadius:12,
                                fontSize:11,
                                fontWeight:600,
                                background: req.status === 'approved' ? 'rgba(34,197,94,0.2)' : req.status === 'denied' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                                color: req.status === 'approved' ? '#22c55e' : req.status === 'denied' ? '#ef4444' : '#f59e0b',
                              }}>
                                {req.status.toUpperCase()}
                              </span>
                            </div>
                            <div style={{color:'#9aa3b2', fontSize:13, marginBottom:4}}>
                              Quantity: {req.quantity} - Urgency: {req.urgency}
                            </div>
                            {req.reason && (
                              <div style={{color:'#9aa3b2', fontSize:12, marginTop:8}}>{req.reason}</div>
                            )}
                            <div style={{color:'#6b7280', fontSize:11, marginTop:8}}>
                              Requested: {new Date(req.createdAt).toLocaleString()}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  
                  {/* Messaging Card */}
                  <MessagingCard userId={userId} shopId={shopId} />
                </div>

                {/* Right Column */}
                <div style={{display:'grid', gap:24}}>
                  {/* Financial Summary */}
                  <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
                    <h3 style={{color:'#e5e7eb', marginBottom:16, fontSize:18}}><FaDollarSign style={{marginRight:4}} /> Financial Summary</h3>
                    <div style={{display:'grid', gap:12}}>
                      <div style={{background:'rgba(34,197,94,0.1)', borderRadius:8, padding:12}}>
                        <div style={{color:'#22c55e', fontSize:12, marginBottom:4}}>Today's Revenue</div>
                        <div style={{color:'#e5e7eb', fontSize:20, fontWeight:700}}>${(financialSummary.todayRevenue ?? 0).toFixed(2)}</div>
                      </div>
                      <div style={{background:'rgba(229,51,42,0.1)', borderRadius:8, padding:12}}>
                        <div style={{color:'#e5332a', fontSize:12, marginBottom:4}}>This Week</div>
                        <div style={{color:'#e5e7eb', fontSize:20, fontWeight:700}}>${(financialSummary.weeklyRevenue ?? 0).toFixed(2)}</div>
                      </div>
                      <div style={{background:'rgba(168,85,247,0.1)', borderRadius:8, padding:12}}>
                        <div style={{color:'#a855f7', fontSize:12, marginBottom:4}}>This Month</div>
                        <div style={{color:'#e5e7eb', fontSize:20, fontWeight:700}}>${(financialSummary.monthlyRevenue ?? 0).toFixed(2)}</div>
                      </div>
                      <div style={{background:'rgba(245,158,11,0.1)', borderRadius:8, padding:12}}>
                        <div style={{color:'#f59e0b', fontSize:12, marginBottom:4}}>Outstanding</div>
                        <div style={{color:'#e5e7eb', fontSize:20, fontWeight:700}}>${(financialSummary.outstandingInvoices ?? 0).toFixed(2)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Time Clock */}
                  <TimeClock techId={userId} shopId={shopId} techName={userName} />

                  {/* Team Schedule */}
                  <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
                    <h3 style={{color:'#e5e7eb', marginBottom:16, fontSize:18}}><FaCalendarAlt style={{marginRight:4}} /> Team Schedule</h3>
                    <div style={{display:'grid', gap:8}}>
                      {teamSchedule.length === 0 ? (
                        <div style={{textAlign:'center', padding:16, color:'#9aa3b2', fontSize:14}}>
                          No upcoming appointments
                        </div>
                      ) : (
                        teamSchedule.slice(0, 3).map((appt, index) => (
                          <div key={index} style={{background:'rgba(255,255,255,0.05)', borderRadius:6, padding:12}}>
                            <div style={{color:'#e5e7eb', fontSize:14, fontWeight:600, marginBottom:4}}>{appt.customerName}</div>
                            <div style={{color:'#9aa3b2', fontSize:12}}>{appt.serviceType}</div>
                            <div style={{color:'#6b7280', fontSize:11, marginTop:4}}>{new Date(appt.scheduledDate).toLocaleString()}</div>
                          </div>
                        ))
                      )}
                    </div>
                    <Link href="/manager/home" style={{display:'block', marginTop:12, padding:8, background:'#6b7280', color:'white', borderRadius:6, textDecoration:'none', textAlign:'center', fontSize:12, fontWeight:600}}>
                      View Schedule
                    </Link>
                  </div>

                  {/* Recent Activity */}
                  <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
                    <h3 style={{color:'#e5e7eb', marginBottom:16, fontSize:18}}><FaClipboardList style={{marginRight:4}} /> Recent Activity</h3>
                    <div style={{display:'grid', gap:8, maxHeight:200, overflowY:'auto'}}>
                      {recentActivity.length === 0 ? (
                        <div style={{textAlign:'center', padding:16, color:'#9aa3b2', fontSize:14}}>
                          No recent activity
                        </div>
                      ) : (
                        recentActivity.slice(0, 5).map((activity, index) => (
                          <div key={index} style={{background:'rgba(255,255,255,0.05)', borderRadius:6, padding:10}}>
                            <div style={{color:'#e5e7eb', fontSize:13, fontWeight:500, marginBottom:2}}>{activity.action}</div>
                            <div style={{color:'#9aa3b2', fontSize:11}}>{activity.details}</div>
                            <div style={{color:'#6b7280', fontSize:10, marginTop:4}}>{new Date(activity.timestamp).toLocaleString()}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
                    <h3 style={{color:'#e5e7eb', marginBottom:16, fontSize:16}}>Quick Actions</h3>
                    <div style={{display:'grid', gap:8}}>
                      <Link href="/manager/dashboard" style={{padding:12, background:'rgba(168,85,247,0.2)', borderRadius:8, textDecoration:'none', color:'#a855f7', fontSize:14, fontWeight:700, border:'1px solid rgba(168,85,247,0.3)'}}>
                        <FaChartBar style={{marginRight:4}} /> Manager Dashboard
                      </Link>
                      <Link href="/manager/assignments" style={{padding:12, background:'rgba(168,85,247,0.2)', borderRadius:8, textDecoration:'none', color:'#a855f7', fontSize:14, fontWeight:700, border:'1px solid rgba(168,85,247,0.3)'}}>
                        <FaUsers style={{marginRight:4}} /> Assign Work Orders
                      </Link>
                      <Link href="/manager/estimates" style={{padding:12, background:'rgba(34,197,94,0.2)', borderRadius:8, textDecoration:'none', color:'#22c55e', fontSize:14, fontWeight:700, border:'1px solid rgba(34,197,94,0.3)'}}>
                        <FaDollarSign style={{marginRight:4}} /> Create Estimates
                      </Link>
                      <Link href="/workorders/inshop" style={{padding:12, background:'rgba(229,51,42,0.2)', borderRadius:8, textDecoration:'none', color:'#e5332a', fontSize:14, fontWeight:700, border:'1px solid rgba(229,51,42,0.3)'}}>
                        <FaClipboardList style={{marginRight:4}} /> Create In-Shop Work Order
                      </Link>
                      <Link href="/workorders/roadside" style={{padding:12, background:'rgba(59,130,246,0.2)', borderRadius:8, textDecoration:'none', color:'#60a5fa', fontSize:14, fontWeight:700, border:'1px solid rgba(59,130,246,0.35)'}}>
                        <FaClipboardList style={{marginRight:4}} /> Create Roadside Work Order
                      </Link>
                      <Link href="/shop/home" style={{padding:12, background:'rgba(229,51,42,0.1)', borderRadius:8, textDecoration:'none', color:'#e5332a', fontSize:14, fontWeight:600, cursor:'pointer'}}>
                        <FaChartBar style={{marginRight:4}} /> View Center Control
                      </Link>
                      <Link href="/shop/manage-team" style={{padding:12, background:'rgba(168,85,247,0.1)', borderRadius:8, textDecoration:'none', color:'#a855f7', fontSize:14, fontWeight:600}}>
                        <FaUsers style={{marginRight:4}} /> Manage Team
                      </Link>
                      <button 
                        onClick={() => window.location.href = 'tel:911'}
                        style={{padding:12, background:'rgba(239,68,68,0.2)', borderRadius:8, border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', fontSize:14, fontWeight:700, cursor:'pointer'}}
                      >
                        <FaExclamationCircle style={{marginRight:4}} /> Emergency Call
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              )}
            </div>
          )}
        </div>
      </div>
      {managerMsg && (
        <div style={{position:'fixed',bottom:24,right:24,background:managerMsg.type==='success'?'#dcfce7':'#fde8e8',color:managerMsg.type==='success'?'#166534':'#991b1b',borderRadius:10,padding:'12px 20px',zIndex:9999,fontSize:14,fontWeight:600,boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
          {managerMsg.text}
          <button onClick={()=>setManagerMsg(null)} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer',fontSize:16,color:'inherit'}}></button>
        </div>
      )}
    </div>
  );
}


