'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { WorkOrder } from '../../../types/workorder';
import NotificationBell from '../../../components/NotificationBell';
import { useRequireAuth } from '../../../contexts/AuthContext';
import '../../../styles/sos-theme.css';
import { FaArrowLeft, FaBuilding, FaChartBar, FaCheck, FaCog, FaDollarSign, FaFileAlt, FaSatelliteDish, FaStar, FaStore } from 'react-icons/fa';

function AdminPortalEnhancedContent() {
  const { user, isLoading: authLoading } = useRequireAuth(['admin', 'superadmin']);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);

  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const fetchWorkOrders = async () => {
    try {
      const res = await fetch('/api/workorders', { credentials: 'include' });
      const data = await res.json();
      const normalized = Array.isArray(data) ? data : Array.isArray(data?.workOrders) ? data.workOrders : [];
      setWorkOrders(normalized);
    } catch (error) {
      console.error('Failed to fetch work orders:', error);
    }
  };

  const fetchTenants = async () => {
    try {
      const res = await fetch('/api/admin/tenants', { credentials: 'include' });
      const data = await res.json();
      const normalized = Array.isArray(data) ? data : Array.isArray(data?.tenants) ? data.tenants : [];
      setTenants(normalized);
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
    }
  };

  useEffect(() => {
    if (authLoading || !user) return;
    fetchWorkOrders();
    fetchTenants();
  }, [user, authLoading]);

  const features = [
    { id: 'overview', icon: <FaBuilding style={{marginRight:4}} />, name: 'System Overview' },
    { id: 'tenants', icon: <FaStore style={{marginRight:4}} />, name: 'Tenant Management' },
    { id: 'monitoring', icon: <FaSatelliteDish style={{marginRight:4}} />, name: 'Live Monitoring' },
    { id: 'financials', icon: <FaDollarSign style={{marginRight:4}} />, name: 'Financials' },
    { id: 'analytics', icon: <FaChartBar style={{marginRight:4}} />, name: 'Analytics' },
    { id: 'reviews', icon: <FaStar style={{marginRight:4}} />, name: 'Reviews' },
    { id: 'documents', icon: <FaFileAlt style={{marginRight:4}} />, name: 'Documents' },
    { id: 'settings', icon: <FaCog style={{marginRight:4}} />, name: 'Settings' },
  ];

  if (authLoading) {
    return (
      <div className="sos-wrap">
        <div className="sos-card" style={{maxWidth:1400, textAlign:'center', padding:'100px 20px'}}>
          <p style={{color:'#9aa3b2'}}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="sos-wrap">
      <div className="sos-card" style={{maxWidth:1400}}>
        <div className="sos-header">
          <div className="sos-brand">
            <span className="mark">FixTray</span>
            <span className="sub">Admin Portal - Super Admin</span>
          </div>
          <div style={{display:'flex', gap:12, alignItems:'center'}}>
            <NotificationBell />
            <button
              onClick={() => {
                localStorage.clear();
                router.push('/admin/login');
              }}
              className="btn-outline"
            >
              Sign Out
            </button>
            <Link href="/" className="btn-outline"><FaArrowLeft style={{marginRight:4}} /> Home</Link>
          </div>
        </div>

        <div className="sos-content" style={{gridTemplateColumns:'200px 1fr'}}>
          <div className="sos-pane" style={{padding:'20px 12px', borderRight:'1px solid #5a5a5a'}}>
            <div style={{display:'flex', flexDirection:'column', gap:4}}>
              {features.map(feature => (
                <button
                  key={feature.id}
                  onClick={() => setActiveTab(feature.id)}
                  className="btn-outline"
                  style={{
                    justifyContent:'flex-start',
                    padding:'10px 12px',
                    background: activeTab === feature.id ? 'rgba(229,51,42,0.14)' : 'transparent',
                    border: activeTab === feature.id ? '1px solid rgba(229,51,42,0.28)' : '1px solid #5a5a5a',
                    color: activeTab === feature.id ? '#ffb3ad' : '#f5f7fb',
                  }}
                >
                  <span style={{marginRight:8}}>{feature.icon}</span>
                  <span style={{fontSize:13}}>{feature.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="sos-pane" style={{padding:28}}>
            {activeTab === 'overview' && <OverviewTab workOrders={workOrders} tenants={tenants} />}
            {activeTab === 'tenants' && <TenantsTab tenants={tenants} onRefresh={fetchTenants} />}
            {activeTab === 'monitoring' && <MonitoringTab />}
            {activeTab === 'financials' && <FinancialsTab workOrders={workOrders} />}
            {activeTab === 'analytics' && <AnalyticsTab workOrders={workOrders} />}
            {activeTab === 'reviews' && <ReviewsTab />}
            {activeTab === 'documents' && <DocumentsTab />}
            {activeTab === 'settings' && <SettingsTab />}
          </div>
        </div>

        <div className="sos-footer">
          <span className="sos-tagline">© {new Date().getFullYear()} FixTray - Admin Control Panel</span>
          <div className="accent-bar" style={{width:112, borderRadius:6}} />
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ workOrders, tenants }: { workOrders: WorkOrder[], tenants: any[] }) {
  const safeWorkOrders = Array.isArray(workOrders) ? workOrders : [];
  const safeTenants = Array.isArray(tenants) ? tenants : [];

  const totalRevenue = safeWorkOrders.filter(w => w.status === 'closed').reduce((sum, w) => sum + (w.estimate?.amount || 0), 0);
  const activeTenants = safeTenants.filter(t => t.status === 'active').length;
  const activeOrders = safeWorkOrders.filter(w => w.status !== 'closed' && w.status !== 'denied-estimate').length;

  return (
    <div>
      <div className="sos-title">System Overview</div>
      <p className="sos-desc">Monitor all tenants and platform operations</p>
      
      <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:16, marginTop:24}}>
        {[
          { label: 'Active Tenants', value: activeTenants.toString(), color: '#4ade80' },
          { label: 'Total Work Orders', value: workOrders.length.toString(), color: '#60a5fa' },
          { label: 'Active Orders', value: activeOrders.toString(), color: '#fbbf24' },
          { label: 'Platform Revenue', value: `$${totalRevenue.toFixed(0)}`, color: '#a78bfa' },
        ].map((stat, i) => (
          <div key={i} className="sos-item" style={{flexDirection:'column', alignItems:'flex-start'}}>
            <div style={{fontSize:11, color:'#9aa3b2', marginBottom:8}}>{stat.label}</div>
            <div style={{fontSize:28, fontWeight:800, color:stat.color}}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div style={{marginTop:32}}>
        <div style={{fontSize:16, fontWeight:700, marginBottom:16}}>System Health</div>
        <div className="sos-list">
          {[
            { metric: 'API Response Time', value: '45ms', status: 'good' },
            { metric: 'Database Performance', value: '98%', status: 'good' },
            { metric: 'Active Users', value: '247', status: 'good' },
            { metric: 'Server Uptime', value: '99.9%', status: 'good' },
          ].map((health, i) => (
            <div key={i} className="sos-item">
              <div>
                <div style={{fontWeight:600}}>{health.metric}</div>
                <div style={{fontSize:12, color:'#9aa3b2'}}>Last 24 hours</div>
              </div>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <span style={{fontSize:16, fontWeight:700}}>{health.value}</span>
                <span style={{width:8, height:8, background:'#4ade80', borderRadius:999}} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{marginTop:32}}>
        <div style={{fontSize:14, fontWeight:700, marginBottom:12}}>Recent System Activity</div>
        <div className="sos-list">
          <div className="sos-item">
            <div>
              <div style={{fontWeight:600}}>New Tenant Created</div>
              <div style={{fontSize:12, color:'#9aa3b2'}}>ABC Auto Shop - 5 mins ago</div>
            </div>
            <span className="sos-pill" style={{background:'#4ade80', color:'#000'}}>New</span>
          </div>
          <div className="sos-item">
            <div>
              <div style={{fontWeight:600}}>Payment Processed</div>
              <div style={{fontSize:12, color:'#9aa3b2'}}>XYZ Motors - $450.00 - 12 mins ago</div>
            </div>
            <span className="sos-pill">Completed</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TenantsTab({ tenants, onRefresh: _onRefresh }: { tenants: any[], onRefresh: () => void }) {
  return (
    <div>
      <div className="sos-title">Tenant Management</div>
      <p className="sos-desc">Manage all shops and service providers</p>
      
      <div style={{marginTop:24, display:'flex', gap:12}}>
        <button className="btn-primary">+ Add New Tenant</button>
        <button className="btn-outline">Export Data</button>
      </div>

      <div className="sos-list" style={{marginTop:24}}>
        {tenants.length === 0 ? (
          <div style={{textAlign:'center', padding:40, color:'#9aa3b2'}}>No tenants found</div>
        ) : (
          tenants.map((tenant, i) => (
            <div key={i} className="sos-item">
              <div style={{flex:1}}>
                <div style={{fontWeight:700}}>{tenant.name || `Tenant ${i + 1}`}</div>
                <div style={{fontSize:12, color:'#9aa3b2'}}>
                  {tenant.workOrders || 0} work orders - ${tenant.revenue || 0} revenue
                </div>
              </div>
              <div style={{display:'flex', gap:8}}>
                <span className="sos-pill" style={{background: tenant.status === 'active' ? '#4ade80' : '#9aa3b2', color:'#000'}}>
                  {tenant.status || 'active'}
                </span>
                <button className="btn-outline" style={{fontSize:12}}>Manage</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MonitoringTab() {
  return (
    <div>
      <div className="sos-title">Live System Monitoring</div>
      <p className="sos-desc">Real-time platform activity and alerts</p>
      
      <div style={{marginTop:24}}>
        <div style={{fontSize:14, fontWeight:700, marginBottom:12}}>Active Sessions</div>
        <div className="sos-list">
          {[
            { user: 'Sarah (Manager)', tenant: 'ABC Auto', activity: 'Assigning work orders', time: 'Now' },
            { user: 'Mike (Tech)', tenant: 'ABC Auto', activity: 'Updating work order', time: '2 mins ago' },
            { user: 'John (Customer)', tenant: 'XYZ Motors', activity: 'Viewing estimate', time: '5 mins ago' },
          ].map((session, i) => (
            <div key={i} className="sos-item">
              <div style={{flex:1}}>
                <div style={{fontWeight:600}}>{session.user}</div>
                <div style={{fontSize:12, color:'#b8beca'}}>{session.tenant} - {session.activity}</div>
              </div>
              <div style={{fontSize:11, color:'#9aa3b2'}}>{session.time}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{marginTop:32}}>
        <div style={{fontSize:14, fontWeight:700, marginBottom:12}}>System Alerts</div>
        <div className="sos-list">
          <div style={{textAlign:'center', padding:40, color:'#4ade80'}}><FaCheck style={{marginRight:4}} /> No critical alerts</div>
        </div>
      </div>
    </div>
  );
}

function FinancialsTab({ workOrders }: { workOrders: WorkOrder[] }) {
  const completedOrders = workOrders.filter(w => w.status === 'closed');
  const totalRevenue = completedOrders.reduce((sum, w) => sum + (w.estimate?.amount || 0), 0);
  const platformFees = 0; // No platform fees in subscription model
  const netRevenue = totalRevenue;

  return (
    <div>
      <div className="sos-title">Platform Financials</div>
      <p className="sos-desc">Revenue tracking and payment analytics</p>
      
      <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16, marginTop:24}}>
        {[
          { label: 'Total Processed', value: `$${totalRevenue.toFixed(2)}`, color: '#60a5fa' },
          { label: 'Platform Fees', value: `$${platformFees.toFixed(2)}`, color: '#4ade80' },
          { label: 'Net Revenue', value: `$${netRevenue.toFixed(2)}`, color: '#a78bfa' },
        ].map((stat, i) => (
          <div key={i} className="sos-item" style={{flexDirection:'column', alignItems:'flex-start'}}>
            <div style={{fontSize:11, color:'#9aa3b2', marginBottom:8}}>{stat.label}</div>
            <div style={{fontSize:24, fontWeight:800, color:stat.color}}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div style={{marginTop:32}}>
        <div style={{fontSize:14, fontWeight:700, marginBottom:12}}>Payment Methods</div>
        <div className="sos-list">
          <div className="sos-item">
            <div>
              <div style={{fontWeight:600}}>Credit/Debit Cards</div>
              <div style={{fontSize:12, color:'#9aa3b2'}}>75% of transactions</div>
            </div>
            <div style={{fontSize:16, fontWeight:700}}>${(totalRevenue * 0.75).toFixed(0)}</div>
          </div>
          <div className="sos-item">
            <div>
              <div style={{fontWeight:600}}>Digital Wallets</div>
              <div style={{fontSize:12, color:'#9aa3b2'}}>25% of transactions</div>
            </div>
            <div style={{fontSize:16, fontWeight:700}}>${(totalRevenue * 0.25).toFixed(0)}</div>
          </div>
        </div>
      </div>

      <div style={{marginTop:32}}>
        <div style={{fontSize:14, fontWeight:700, marginBottom:12}}>Recent Transactions</div>
        <div className="sos-list">
          {completedOrders.slice(0, 5).map(wo => (
            <div key={wo.id} className="sos-item">
              <div>
                <div style={{fontWeight:600}}>WO #{wo.id.slice(0,8)}</div>
                <div style={{fontSize:12, color:'#9aa3b2'}}>{wo.createdBy || 'Customer'}</div>
              </div>
              <div style={{fontSize:16, fontWeight:700, color:'#4ade80'}}>
                ${wo.estimate?.amount || 0}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AnalyticsTab({ workOrders }: { workOrders: WorkOrder[] }) {
  return (
    <div>
      <div className="sos-title">Platform Analytics</div>
      <p className="sos-desc">Usage insights and performance metrics</p>
      
      <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16, marginTop:24}}>
        {[
          { label: 'Total Users', value: '1,247', trend: '+12%' },
          { label: 'Work Orders (30d)', value: workOrders.length.toString(), trend: '+8%' },
          { label: 'Avg Completion Time', value: '2.4 hrs', trend: '-5%' },
        ].map((stat, i) => (
          <div key={i} className="sos-item" style={{flexDirection:'column', alignItems:'flex-start'}}>
            <div style={{fontSize:11, color:'#9aa3b2', marginBottom:8}}>{stat.label}</div>
            <div style={{fontSize:24, fontWeight:800, marginBottom:4}}>{stat.value}</div>
            <div style={{fontSize:11, color:'#4ade80'}}>{stat.trend} vs last month</div>
          </div>
        ))}
      </div>

      <div style={{marginTop:32}}>
        <div style={{fontSize:14, fontWeight:700, marginBottom:12}}>Usage by Role</div>
        <div className="sos-list">
          {[
            { role: 'Customers', users: 847, percentage: 68 },
            { role: 'Technicians', users: 245, percentage: 20 },
            { role: 'Managers', users: 125, percentage: 10 },
            { role: 'Admins', users: 30, percentage: 2 },
          ].map((role, i) => (
            <div key={i} className="sos-item">
              <div style={{flex:1}}>
                <div style={{fontWeight:600}}>{role.role}</div>
                <div style={{fontSize:12, color:'#9aa3b2'}}>{role.users} active users</div>
              </div>
              <div style={{fontSize:16, fontWeight:700}}>{role.percentage}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReviewsTab() {
  return (
    <div>
      <div className="sos-title">Platform Reviews</div>
      <p className="sos-desc">Customer feedback across all tenants</p>
      
      <div style={{marginTop:24}}>
        <div className="sos-item" style={{padding:24, flexDirection:'column', alignItems:'center'}}>
          <div style={{fontSize:48, fontWeight:800, marginBottom:8}}>4.7</div>
          <div style={{fontSize:16, marginBottom:4}}><FaStar style={{marginRight:4}} /></div>
          <div style={{fontSize:12, color:'#9aa3b2'}}>Based on 1,847 platform reviews</div>
        </div>
      </div>

      <div style={{marginTop:24}}>
        <div style={{fontSize:14, fontWeight:700, marginBottom:12}}>Recent Reviews</div>
        <div className="sos-list">
          {[
            { rating: 5, text: 'Amazing service! Very professional.', tenant: 'ABC Auto', customer: 'John' },
            { rating: 4, text: 'Great experience overall.', tenant: 'XYZ Motors', customer: 'Jane' },
            { rating: 5, text: 'Fast and reliable service.', tenant: 'Quick Fix', customer: 'Bob' },
          ].map((review, i) => (
            <div key={i} className="sos-item" style={{flexDirection:'column', alignItems:'flex-start'}}>
              <div style={{marginBottom:8}}>{Array.from({length: review.rating}, (_, i) => <FaStar key={i} />)}</div>
              <div style={{fontSize:13, marginBottom:4}}>"{review.text}"</div>
              <div style={{fontSize:11, color:'#9aa3b2'}}>{review.customer} - {review.tenant}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DocumentsTab() {
  return (
    <div>
      <div className="sos-title">Document Management</div>
      <p className="sos-desc">Platform documentation and resources</p>
      
      <div className="sos-list" style={{marginTop:24}}>
        {[
          { name: 'Platform Terms of Service', type: 'Legal', size: '245 KB' },
          { name: 'Privacy Policy', type: 'Legal', size: '180 KB' },
          { name: 'API Documentation', type: 'Technical', size: '1.2 MB' },
          { name: 'User Guide', type: 'Support', size: '890 KB' },
        ].map((doc, i) => (
          <div key={i} className="sos-item">
            <div>
              <div style={{fontWeight:600}}>{doc.name}</div>
              <div style={{fontSize:12, color:'#9aa3b2'}}>{doc.type} - {doc.size}</div>
            </div>
            <button className="btn-outline" style={{fontSize:12}}>Download</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsTab() {
  return (
    <div>
      <div className="sos-title">System Settings</div>
      <p className="sos-desc">Configure platform-wide settings</p>
      
      <div className="sos-list" style={{marginTop:24}}>
        <div className="sos-item">
          <div>
            <div style={{fontWeight:600}}>Platform Fee</div>
            <div style={{fontSize:12, color:'#9aa3b2'}}>Subscription-based pricing (no commission)</div>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <input className="sos-input" defaultValue="0" style={{width:60}} disabled />
            <span>%</span>
          </div>
        </div>

        <div className="sos-item">
          <div>
            <div style={{fontWeight:600}}>Email Notifications</div>
            <div style={{fontSize:12, color:'#9aa3b2'}}>System-wide notifications</div>
          </div>
          <button className="btn-primary" style={{fontSize:12}}>Configure</button>
        </div>

        <div className="sos-item">
          <div>
            <div style={{fontWeight:600}}>Backup Schedule</div>
            <div style={{fontSize:12, color:'#9aa3b2'}}>Automated database backups</div>
          </div>
          <span style={{fontSize:12, color:'#4ade80'}}>Daily at 2:00 AM</span>
        </div>

        <div className="sos-item">
          <div>
            <div style={{fontWeight:600}}>API Rate Limits</div>
            <div style={{fontSize:12, color:'#9aa3b2'}}>Requests per minute</div>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <input className="sos-input" defaultValue="1000" style={{width:80}} />
            <span style={{fontSize:12}}>req/min</span>
          </div>
        </div>
      </div>

      <div style={{marginTop:32}}>
        <button className="btn-primary">Save Settings</button>
      </div>
    </div>
  );
}

export default function AdminPortalEnhanced() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminPortalEnhancedContent />
    </Suspense>
  );
}
