'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { WorkOrder } from '../../../types/workorder';
import NotificationBell from '../../../components/NotificationBell';
import { useRequireAuth } from '../../../contexts/AuthContext';
import '../../../styles/sos-theme.css';
import { FaArrowLeft, FaBuilding, FaChartBar, FaCheck, FaCog, FaDollarSign, FaFileAlt, FaSatelliteDish, FaStar, FaStore } from 'react-icons/fa';

function AdminPortalEnhancedContent() {
  const say = usePhrase();
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
          <p style={{color:'#9aa3b2'}}>{say("Loading...")}</p>
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
            <span className="mark">{say("FixTray")}</span>
            <span className="sub">{say("Admin Portal - Super Admin")}</span>
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
              {say("Sign Out")}{' '}</button>
            <Link href="/" className="btn-outline"><FaArrowLeft style={{marginRight:4}} /> {say("Home")}</Link>
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
                  <span style={{marginRight:8}}>{say(feature.icon)}</span>
                  <span style={{fontSize:13}}>{say(feature.name)}</span>
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
          <span className="sos-tagline">© {new Date().getFullYear()} {say("FixTray - Admin Control Panel")}</span>
          <div className="accent-bar" style={{width:112, borderRadius:6}} />
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ workOrders, tenants }: { workOrders: WorkOrder[], tenants: any[] }) {
  const say = usePhrase();
  const safeWorkOrders = Array.isArray(workOrders) ? workOrders : [];
  const safeTenants = Array.isArray(tenants) ? tenants : [];

  const totalRevenue = safeWorkOrders.filter(w => w.status === 'closed').reduce((sum, w) => sum + (w.estimate?.amount || 0), 0);
  const activeTenants = safeTenants.filter(t => t.status === 'active').length;
  const activeOrders = safeWorkOrders.filter(w => w.status !== 'closed' && w.status !== 'denied-estimate').length;

  return (
    <div>
      <div className="sos-title">{say("System Overview")}</div>
      <p className="sos-desc">{say("Monitor all tenants and platform operations")}</p>
      
      <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:16, marginTop:24}}>
        {[
          { label: say("Active Tenants"), value: activeTenants.toString(), color: '#4ade80' },
          { label: say("Total Work Orders"), value: workOrders.length.toString(), color: '#60a5fa' },
          { label: say("Active Orders"), value: activeOrders.toString(), color: '#fbbf24' },
          { label: say("Platform Revenue"), value: `$${totalRevenue.toFixed(0)}`, color: '#a78bfa' },
        ].map((stat, i) => (
          <div key={i} className="sos-item" style={{flexDirection:'column', alignItems:'flex-start'}}>
            <div style={{fontSize:11, color:'#9aa3b2', marginBottom:8}}>{say(stat.label)}</div>
            <div style={{fontSize:28, fontWeight:800, color:stat.color}}>{say(stat.value)}</div>
          </div>
        ))}
      </div>

      <div style={{marginTop:32}}>
        <div style={{fontSize:16, fontWeight:700, marginBottom:16}}>{say("System Health")}</div>
        <div className="sos-list">
          {[
            { metric: say("API Response Time"), value: '45ms', status: 'good' },
            { metric: say("Database Performance"), value: '98%', status: 'good' },
            { metric: say("Active Users"), value: '247', status: 'good' },
            { metric: say("Server Uptime"), value: '99.9%', status: 'good' },
          ].map((health, i) => (
            <div key={i} className="sos-item">
              <div>
                <div style={{fontWeight:600}}>{say(health.metric)}</div>
                <div style={{fontSize:12, color:'#9aa3b2'}}>{say("Last 24 hours")}</div>
              </div>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <span style={{fontSize:16, fontWeight:700}}>{say(health.value)}</span>
                <span style={{width:8, height:8, background:'#4ade80', borderRadius:999}} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{marginTop:32}}>
        <div style={{fontSize:14, fontWeight:700, marginBottom:12}}>{say("Recent System Activity")}</div>
        <div className="sos-list">
          <div className="sos-item">
            <div>
              <div style={{fontWeight:600}}>{say("New Tenant Created")}</div>
              <div style={{fontSize:12, color:'#9aa3b2'}}>{say("ABC Auto Shop - 5 mins ago")}</div>
            </div>
            <span className="sos-pill" style={{background:'#4ade80', color:'#000'}}>{say("New")}</span>
          </div>
          <div className="sos-item">
            <div>
              <div style={{fontWeight:600}}>{say("Payment Processed")}</div>
              <div style={{fontSize:12, color:'#9aa3b2'}}>{say("XYZ Motors - $450.00 - 12 mins ago")}</div>
            </div>
            <span className="sos-pill">{say("Completed")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TenantsTab({ tenants, onRefresh: _onRefresh }: { tenants: any[], onRefresh: () => void }) {
  const say = usePhrase();
  return (
    <div>
      <div className="sos-title">{say("Tenant Management")}</div>
      <p className="sos-desc">{say("Manage all shops and service providers")}</p>
      
      <div style={{marginTop:24, display:'flex', gap:12}}>
        <button className="btn-primary">{say("+ Add New Tenant")}</button>
        <button className="btn-outline">{say("Export Data")}</button>
      </div>

      <div className="sos-list" style={{marginTop:24}}>
        {tenants.length === 0 ? (
          <div style={{textAlign:'center', padding:40, color:'#9aa3b2'}}>{say("No tenants found")}</div>
        ) : (
          tenants.map((tenant, i) => (
            <div key={i} className="sos-item">
              <div style={{flex:1}}>
                <div style={{fontWeight:700}}>{tenant.name || `Tenant ${i + 1}`}</div>
                <div style={{fontSize:12, color:'#9aa3b2'}}>
                  {tenant.workOrders || 0} {say("work orders - $")}{tenant.revenue || 0} revenue
                </div>
              </div>
              <div style={{display:'flex', gap:8}}>
                <span className="sos-pill" style={{background: tenant.status === 'active' ? '#4ade80' : '#9aa3b2', color:'#000'}}>
                  {tenant.status || 'active'}
                </span>
                <button className="btn-outline" style={{fontSize:12}}>{say("Manage")}</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MonitoringTab() {
  const say = usePhrase();
  return (
    <div>
      <div className="sos-title">{say("Live System Monitoring")}</div>
      <p className="sos-desc">{say("Real-time platform activity and alerts")}</p>
      
      <div style={{marginTop:24}}>
        <div style={{fontSize:14, fontWeight:700, marginBottom:12}}>{say("Active Sessions")}</div>
        <div className="sos-list">
          {[
            { user: say("Sarah (Manager)"), tenant: say("ABC Auto"), activity: say("Assigning work orders"), time: say("Now") },
            { user: say("Mike (Tech)"), tenant: say("ABC Auto"), activity: say("Updating work order"), time: say("2 mins ago") },
            { user: say("John (Customer)"), tenant: say("XYZ Motors"), activity: say("Viewing estimate"), time: say("5 mins ago") },
          ].map((session, i) => (
            <div key={i} className="sos-item">
              <div style={{flex:1}}>
                <div style={{fontWeight:600}}>{say(session.user)}</div>
                <div style={{fontSize:12, color:'#b8beca'}}>{say(session.tenant)} - {say(session.activity)}</div>
              </div>
              <div style={{fontSize:11, color:'#9aa3b2'}}>{say(session.time)}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{marginTop:32}}>
        <div style={{fontSize:14, fontWeight:700, marginBottom:12}}>{say("System Alerts")}</div>
        <div className="sos-list">
          <div style={{textAlign:'center', padding:40, color:'#4ade80'}}><FaCheck style={{marginRight:4}} /> {say("No critical alerts")}</div>
        </div>
      </div>
    </div>
  );
}

function FinancialsTab({ workOrders }: { workOrders: WorkOrder[] }) {
  const say = usePhrase();
  const completedOrders = workOrders.filter(w => w.status === 'closed');
  const totalRevenue = completedOrders.reduce((sum, w) => sum + (w.estimate?.amount || 0), 0);
  const platformFees = 0; // Stub view. Live shop-fee totals are on /admin/revenue.
  const netRevenue = totalRevenue;

  return (
    <div>
      <div className="sos-title">{say("Platform Financials")}</div>
      <p className="sos-desc">{say("Revenue tracking and payment analytics")}</p>
      
      <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16, marginTop:24}}>
        {[
          { label: say("Total Processed"), value: `$${totalRevenue.toFixed(2)}`, color: '#60a5fa' },
          { label: say("Platform Fees"), value: `$${platformFees.toFixed(2)}`, color: '#4ade80' },
          { label: say("Net Revenue"), value: `$${netRevenue.toFixed(2)}`, color: '#a78bfa' },
        ].map((stat, i) => (
          <div key={i} className="sos-item" style={{flexDirection:'column', alignItems:'flex-start'}}>
            <div style={{fontSize:11, color:'#9aa3b2', marginBottom:8}}>{say(stat.label)}</div>
            <div style={{fontSize:24, fontWeight:800, color:stat.color}}>{say(stat.value)}</div>
          </div>
        ))}
      </div>

      <div style={{marginTop:32}}>
        <div style={{fontSize:14, fontWeight:700, marginBottom:12}}>{say("Payment Methods")}</div>
        <div className="sos-list">
          <div className="sos-item">
            <div>
              <div style={{fontWeight:600}}>{say("Credit/Debit Cards")}</div>
              <div style={{fontSize:12, color:'#9aa3b2'}}>{say("75% of transactions")}</div>
            </div>
            <div style={{fontSize:16, fontWeight:700}}>${(totalRevenue * 0.75).toFixed(0)}</div>
          </div>
          <div className="sos-item">
            <div>
              <div style={{fontWeight:600}}>{say("Digital Wallets")}</div>
              <div style={{fontSize:12, color:'#9aa3b2'}}>{say("25% of transactions")}</div>
            </div>
            <div style={{fontSize:16, fontWeight:700}}>${(totalRevenue * 0.25).toFixed(0)}</div>
          </div>
        </div>
      </div>

      <div style={{marginTop:32}}>
        <div style={{fontSize:14, fontWeight:700, marginBottom:12}}>{say("Recent Transactions")}</div>
        <div className="sos-list">
          {completedOrders.slice(0, 5).map(wo => (
            <div key={wo.id} className="sos-item">
              <div>
                <div style={{fontWeight:600}}>{say("WO #")}{wo.id.slice(0,8)}</div>
                <div style={{fontSize:12, color:'#9aa3b2'}}>{wo.createdBy || say("Customer")}</div>
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
  const say = usePhrase();
  return (
    <div>
      <div className="sos-title">{say("Platform Analytics")}</div>
      <p className="sos-desc">{say("Usage insights and performance metrics")}</p>
      
      <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16, marginTop:24}}>
        {[
          { label: say("Total Users"), value: '1,247', trend: '+12%' },
          { label: say("Work Orders (30d)"), value: workOrders.length.toString(), trend: '+8%' },
          { label: say("Avg Completion Time"), value: say("2.4 hrs"), trend: '-5%' },
        ].map((stat, i) => (
          <div key={i} className="sos-item" style={{flexDirection:'column', alignItems:'flex-start'}}>
            <div style={{fontSize:11, color:'#9aa3b2', marginBottom:8}}>{say(stat.label)}</div>
            <div style={{fontSize:24, fontWeight:800, marginBottom:4}}>{say(stat.value)}</div>
            <div style={{fontSize:11, color:'#4ade80'}}>{say(stat.trend)} {say("vs last month")}</div>
          </div>
        ))}
      </div>

      <div style={{marginTop:32}}>
        <div style={{fontSize:14, fontWeight:700, marginBottom:12}}>{say("Usage by Role")}</div>
        <div className="sos-list">
          {[
            { role: say("Customers"), users: 847, percentage: 68 },
            { role: say("Technicians"), users: 245, percentage: 20 },
            { role: say("Managers"), users: 125, percentage: 10 },
            { role: say("Admins"), users: 30, percentage: 2 },
          ].map((role, i) => (
            <div key={i} className="sos-item">
              <div style={{flex:1}}>
                <div style={{fontWeight:600}}>{say(role.role)}</div>
                <div style={{fontSize:12, color:'#9aa3b2'}}>{say(role.users)} {say("active users")}</div>
              </div>
              <div style={{fontSize:16, fontWeight:700}}>{say(role.percentage)}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReviewsTab() {
  const say = usePhrase();
  return (
    <div>
      <div className="sos-title">{say("Platform Reviews")}</div>
      <p className="sos-desc">{say("Customer feedback across all tenants")}</p>
      
      <div style={{marginTop:24}}>
        <div className="sos-item" style={{padding:24, flexDirection:'column', alignItems:'center'}}>
          <div style={{fontSize:48, fontWeight:800, marginBottom:8}}>4.7</div>
          <div style={{fontSize:16, marginBottom:4}}><FaStar style={{marginRight:4}} /></div>
          <div style={{fontSize:12, color:'#9aa3b2'}}>{say("Based on 1,847 platform reviews")}</div>
        </div>
      </div>

      <div style={{marginTop:24}}>
        <div style={{fontSize:14, fontWeight:700, marginBottom:12}}>{say("Recent Reviews")}</div>
        <div className="sos-list">
          {[
            { rating: 5, text: say("Amazing service! Very professional."), tenant: say("ABC Auto"), customer: say("John") },
            { rating: 4, text: say("Great experience overall."), tenant: say("XYZ Motors"), customer: say("Jane") },
            { rating: 5, text: say("Fast and reliable service."), tenant: say("Quick Fix"), customer: say("Bob") },
          ].map((review, i) => (
            <div key={i} className="sos-item" style={{flexDirection:'column', alignItems:'flex-start'}}>
              <div style={{marginBottom:8}}>{Array.from({length: review.rating}, (_, i) => <FaStar key={i} />)}</div>
              <div style={{fontSize:13, marginBottom:4}}>"{say(review.text)}"</div>
              <div style={{fontSize:11, color:'#9aa3b2'}}>{say(review.customer)} - {say(review.tenant)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DocumentsTab() {
  const say = usePhrase();
  return (
    <div>
      <div className="sos-title">{say("Document Management")}</div>
      <p className="sos-desc">{say("Platform documentation and resources")}</p>
      
      <div className="sos-list" style={{marginTop:24}}>
        {[
          { name: say("Platform Terms of Service"), type: say("Legal"), size: say("245 KB") },
          { name: say("Privacy Policy"), type: say("Legal"), size: say("180 KB") },
          { name: say("API Documentation"), type: say("Technical"), size: say("1.2 MB") },
          { name: say("User Guide"), type: say("Support"), size: say("890 KB") },
        ].map((doc, i) => (
          <div key={i} className="sos-item">
            <div>
              <div style={{fontWeight:600}}>{say(doc.name)}</div>
              <div style={{fontSize:12, color:'#9aa3b2'}}>{say(doc.type)} - {say(doc.size)}</div>
            </div>
            <button className="btn-outline" style={{fontSize:12}}>{say("Download")}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsTab() {
  const say = usePhrase();
  return (
    <div>
      <div className="sos-title">{say("System Settings")}</div>
      <p className="sos-desc">{say("Configure platform-wide settings")}</p>
      
      <div className="sos-list" style={{marginTop:24}}>
        <div className="sos-item">
          <div>
            <div style={{fontWeight:600}}>{say("Platform Fee")}</div>
            <div style={{fontSize:12, color:'#9aa3b2'}}>{say("Subscription-based pricing (no commission)")}</div>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <input className="sos-input" defaultValue="0" style={{width:60}} disabled />
            <span>%</span>
          </div>
        </div>

        <div className="sos-item">
          <div>
            <div style={{fontWeight:600}}>{say("Email Notifications")}</div>
            <div style={{fontSize:12, color:'#9aa3b2'}}>{say("System-wide notifications")}</div>
          </div>
          <button className="btn-primary" style={{fontSize:12}}>{say("Configure")}</button>
        </div>

        <div className="sos-item">
          <div>
            <div style={{fontWeight:600}}>{say("Backup Schedule")}</div>
            <div style={{fontSize:12, color:'#9aa3b2'}}>{say("Automated database backups")}</div>
          </div>
          <span style={{fontSize:12, color:'#4ade80'}}>{say("Daily at 2:00 AM")}</span>
        </div>

        <div className="sos-item">
          <div>
            <div style={{fontWeight:600}}>{say("API Rate Limits")}</div>
            <div style={{fontSize:12, color:'#9aa3b2'}}>{say("Requests per minute")}</div>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <input className="sos-input" defaultValue="1000" style={{width:80}} />
            <span style={{fontSize:12}}>req/min</span>
          </div>
        </div>
      </div>

      <div style={{marginTop:32}}>
        <button className="btn-primary">{say("Save Settings")}</button>
      </div>
    </div>
  );
}

export default function AdminPortalEnhanced() {
  const say = usePhrase();
  return (
    <Suspense fallback={<div>{say("Loading...")}</div>}>
      <AdminPortalEnhancedContent />
    </Suspense>
  );
}
