'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import TopNavBar from '../../../components/TopNavBar';
import RealTimeWorkOrders from '../../../components/RealTimeWorkOrders';
import { useRequireAuth } from '../../../contexts/AuthContext';
import '../../../styles/sos-theme.css';
import { FaBolt, FaChartBar, FaHeart, FaSearch, FaSyncAlt, FaUser } from 'react-icons/fa';
import MobileShell from '../../../components/MobileShell';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { useIsNative } from '../../../context/NativeContext';

export default function CustomerDashboard() {
  useRequireAuth(['customer']);
  const isMountedRef = useRef(true);
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [activeTab, setActiveTab] = useState('discover');
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [tier, setTier] = useState('Bronze');
  
  // Real data states
  const [stats, setStats] = useState({
    appointmentCount: 0,
    upcomingAppointments: 0,
    vehicleCount: 0,
    reviewCount: 0,
    favoriteCount: 0,
    historyCount: 0,
    documentCount: 0,
    unreadMessages: 0,
    paymentMethods: 0,
  });
  
  // Recent data for each feature
  const [recentData, setRecentData] = useState<{
    appointments: any[];
    vehicles: any[];
    messages: any[];
    reviews: any[];
    favorites: any[];
    history: any[];
    documents: any[];
    payments: any[];
  }>({
    appointments: [],
    vehicles: [],
    messages: [],
    reviews: [],
    favorites: [],
    history: [],
    documents: [],
    payments: [],
  });
  
  const [customerStats, setCustomerStats] = useState({
    openOrders: 0,
    completedToday: 0,
    messages: 0,
    appointments: 0
  });
  const [statsReady, setStatsReady] = useState(false);

  const fetchStats = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('token');
    if (!token) {
      setStatsReady(true);
      return;
    }

    const fetchOpts = {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    } as RequestInit;
    const safeFetchJson = async (url: string) => {
      try {
        const response = await fetch(url, fetchOpts);
        if (!response.ok) return null;
        return await response.json();
      } catch {
        return null;
      }
    };

      // Fetch appointments
      const apptData = await safeFetchJson('/api/appointments');
      const appointments = Array.isArray(apptData?.appointments) ? apptData.appointments : [];
      const upcoming = appointments.filter((a: any) => 
        a.status === 'Scheduled' || a.status === 'Confirmed'
      ).length;
      
      // Fetch vehicles — API returns { vehicles: [...] }
      const vehiclesData = await safeFetchJson('/api/customers/vehicles');
      const vehicles = Array.isArray(vehiclesData?.vehicles) ? vehiclesData.vehicles : [];
      
      // Fetch reviews — must pass customerId or it returns all reviews in the system
      const currentUserId = localStorage.getItem('userId') || '';
      const reviewsData = await safeFetchJson(`/api/reviews?customerId=${encodeURIComponent(currentUserId)}`);
      const reviews = Array.isArray(reviewsData?.reviews) ? reviewsData.reviews : [];
      
      // Fetch favorites — API returns { favorites: [...] }, unwrap the array
      const favoritesResponse = await safeFetchJson('/api/customers/favorites');
      const favorites = Array.isArray(favoritesResponse?.favorites) ? favoritesResponse.favorites : [];
      
      // Fetch work orders — API returns { workOrders: [...] }
      const workordersData = await safeFetchJson('/api/workorders');
      const allWorkOrders = Array.isArray(workordersData?.workOrders) ? workordersData.workOrders : [];
      const completed = allWorkOrders.filter((w: any) => w.status === 'completed' || w.status === 'Completed');
      const openOrders = allWorkOrders.filter((w: any) => !['closed', 'completed', 'Completed'].includes(w.status)).length;
      
      // Fetch documents — API returns { documents: [...] }
      const documentsData = await safeFetchJson('/api/customers/documents');
      const documents = Array.isArray(documentsData?.documents) ? documentsData.documents : [];
      
      // Fetch messages — read from DirectMessage system so count matches MessagingCard
      const messagesData = await safeFetchJson('/api/messages');
      const unread = (messagesData?.totalUnread ?? 0) as number;
      
      // Fetch payment methods — returns plain array
      const paymentMethods = await safeFetchJson('/api/customers/payment-methods');

      if (!isMountedRef.current) return;

      setStats({
        appointmentCount: appointments.length,
        upcomingAppointments: upcoming,
        vehicleCount: vehicles.length,
        reviewCount: reviews.length,
        favoriteCount: favorites.length,
        historyCount: completed.length,
        documentCount: documents.length,
        unreadMessages: unread,
        paymentMethods: Array.isArray(paymentMethods) ? paymentMethods.length : 0,
      });

      // Fetch loyalty points from API; fall back to client-side calculation
      let pts = completed.length * 50;
      const rewardsData = await safeFetchJson('/api/customers/rewards');
        if (rewardsData) {
          if (typeof rewardsData.points === 'number') pts = rewardsData.points;
          if (typeof rewardsData.tier === 'string') {
            setTier(rewardsData.tier);
            setLoyaltyPoints(pts);
          } else {
            setLoyaltyPoints(pts);
            setTier(pts >= 1000 ? 'Gold' : pts >= 200 ? 'Silver' : 'Bronze');
          }
        } else {
        setLoyaltyPoints(pts);
        setTier(pts >= 1000 ? 'Gold' : pts >= 200 ? 'Silver' : 'Bronze');
      }
      const todayStr = new Date().toISOString().split('T')[0];
      const completedToday = completed.filter((w: any) => {
        const d = new Date(w.updatedAt || w.completedAt || w.createdAt || '');
        return d.toISOString().split('T')[0] === todayStr;
      }).length;
      setCustomerStats({
        openOrders,
        completedToday,
        messages: unread,
        appointments: upcoming,
      });
      
      // Store recent data (last 3 items)
      setRecentData(prev => ({
        appointments: appointments.slice(0, 3),
        vehicles: vehicles.slice(0, 3),
        messages: Array.isArray(messagesData?.conversations) ? messagesData.conversations.slice(0, 3) : [],
        reviews: reviews.slice(0, 3),
        favorites: favorites.slice(0, 3),
        history: completed.slice(0, 3),
        documents: documents.slice(0, 3),
        payments: Array.isArray(paymentMethods) ? paymentMethods.slice(0, 3) : [],
      }));
      setStatsReady(true);
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const name = localStorage.getItem('userName');
    const id = localStorage.getItem('userId');
    const token = localStorage.getItem('token');
    
    if (name) setUserName(name);
    if (id) setUserId(id);
    if (id && token) {
      fetchStats();
      const refresh = setInterval(fetchStats, 60 * 1000);
      return () => clearInterval(refresh);
    }

    if (id) {
      setStatsReady(true);
    }
  }, [fetchStats]);

  // Live updates: listen for socket events dispatched by `useSocket`
  useEffect(() => {
    const onWorkOrderUpdated = (e: any) => {
      const data = e?.detail || e;
      // Prepend to recent history and refresh counts
      setRecentData(prev => ({ ...prev, history: [data, ...prev.history].slice(0, 3) }));
      // Refresh counts to keep UI consistent
      fetchStats();
    };

    const onLocationUpdate = (_e: any) => {
      // For live tracking card (if viewing an active tracking work order), we might refresh tracking data
      // For now just refresh stats to pick up any tracking-based changes
      fetchStats();
    };

    window.addEventListener('work-order:updated', onWorkOrderUpdated as EventListener);
    window.addEventListener('tech:location_updated', onLocationUpdate as EventListener);

    return () => {
      window.removeEventListener('work-order:updated', onWorkOrderUpdated as EventListener);
      window.removeEventListener('tech:location_updated', onLocationUpdate as EventListener);
    };
  }, [fetchStats]);

  const discoverFeatures = [
    { 
      id: 'findshops', 
      icon: '', 
      name: 'Find Shops', 
      desc: 'Discover service centers near you', 
      detail: 'Search by location and compare ratings', 
      badge: 'Popular', 
      badgeColor: '#e5332a', 
      link: '/customer/findshops',
      getData: () => []
    },
    { 
      id: 'appointments', 
      icon: '', 
      name: 'Appointments', 
      desc: 'Book and manage service appointments', 
      detail: `${stats.upcomingAppointments} upcoming - ${stats.appointmentCount} total`, 
      badge: stats.upcomingAppointments > 0 ? 'Active' : '', 
      badgeColor: '#10b981', 
      link: '/customer/appointments',
      getData: () => recentData.appointments
    },
    {
      id: 'workorders',
      icon: '',
      name: 'Work Orders',
      desc: 'Track all your repair and service work orders',
      detail: `${stats.historyCount} completed`,
      badge: stats.historyCount > 0 ? 'History' : '',
      badgeColor: '#f59e0b',
      link: '/customer/workorders',
      getData: () => recentData.history
    },
    { 
      id: 'quotes', 
      icon: '', 
      name: 'MY ESTIMATES', 
      desc: 'View and manage your service estimates', 
      detail: 'Get estimates before service', 
      badge: '', 
      badgeColor: '', 
      link: '/customer/estimates',
      getData: () => []
    },
  ];

  const activeFeatures = [
    { 
      id: 'tracking', 
      icon: '', 
      name: 'Live Tracking', 
      desc: 'Track your tech in real-time', 
      detail: 'View real-time location updates', 
      badge: 'Live', 
      badgeColor: '#ef4444', 
      link: '/customer/tracking',
      getData: () => []
    },
    { 
      id: 'vehicles', 
      icon: '', 
      name: 'My Vehicles', 
      desc: 'Manage your fleet information', 
      detail: `${stats.vehicleCount} vehicle${stats.vehicleCount !== 1 ? 's' : ''} registered`, 
      badge: 'Essential', 
      badgeColor: '#f59e0b', 
      link: '/customer/vehicles',
      getData: () => recentData.vehicles
    },
  ];

  const accountFeatures = [
    { 
      id: 'reviews', 
      icon: '', 
      name: 'Reviews', 
      desc: 'Share your service experiences', 
      detail: `${stats.reviewCount} review${stats.reviewCount !== 1 ? 's' : ''} written`, 
      badge: '', 
      badgeColor: '', 
      link: '/customer/reviews',
      getData: () => recentData.reviews
    },
    { 
      id: 'favorites', 
      icon: <FaHeart style={{marginRight:4}} />, 
      name: 'Favorite Shops', 
      desc: 'Quick access to preferred shops', 
      detail: `${stats.favoriteCount} saved favorite${stats.favoriteCount !== 1 ? 's' : ''}`, 
      badge: '', 
      badgeColor: '', 
      link: '/customer/favorites',
      getData: () => recentData.favorites
    },
    { 
      id: 'rewards', 
      icon: '', 
      name: 'Rewards', 
      desc: 'Earn points and unlock perks', 
      detail: `${loyaltyPoints} points - ${tier} tier`, 
      badge: 'New', 
      badgeColor: '#a855f7', 
      link: '/customer/rewards',
      getData: () => []
    },
    { 
      id: 'payments', 
      icon: '', 
      name: 'Payments', 
      desc: 'Manage payment methods', 
      detail: `${stats.paymentMethods} saved payment method${stats.paymentMethods !== 1 ? 's' : ''}`, 
      badge: '', 
      badgeColor: '', 
      link: '/customer/payments',
      getData: () => recentData.payments
    },
    { 
      id: 'recurring-approvals', 
      icon: <FaSyncAlt style={{marginRight:4}} />, 
      name: 'Recurring Approvals', 
      desc: 'Confirm or skip scheduled recurring services', 
      detail: 'Review pending recurring service requests', 
      badge: '', 
      badgeColor: '', 
      link: '/customer/recurring-approvals',
      getData: () => []
    },
    { 
      id: 'overview', 
      icon: '', 
      name: 'Account Overview', 
      desc: 'Summary of your account activity', 
      detail: 'Quick stats and recent activity', 
      badge: '', 
      badgeColor: '', 
      link: '/customer/overview',
      getData: () => []
    },
  ];

  const recordsFeatures = [
    { 
      id: 'history', 
      icon: '', 
      name: 'Service History', 
      desc: 'View past service records', 
      detail: `${stats.historyCount} completed service${stats.historyCount !== 1 ? 's' : ''}`, 
      badge: '', 
      badgeColor: '', 
      link: '/customer/history',
      getData: () => recentData.history
    },
    { 
      id: 'documents', 
      icon: '', 
      name: 'Documents', 
      desc: 'Access invoices and receipts', 
      detail: `${stats.documentCount} document${stats.documentCount !== 1 ? 's' : ''} available`, 
      badge: '', 
      badgeColor: '', 
      link: '/customer/documents',
      getData: () => recentData.documents
    },
    { 
      id: 'insights', 
      icon: '', 
      name: 'Insights', 
      desc: 'Track spending and trends', 
      detail: 'Analytics and reports', 
      badge: 'Pro', 
      badgeColor: '#ec4899', 
      link: '/customer/insights',
      getData: () => []
    },
  ];

  const isMobile = useIsMobile();
  const isNative = useIsNative();

  if (isNative || isMobile) {
    return <MobileShell role="customer" isHome userName={userName} />;
  }

  if (!statsReady) {
    return (
      <div style={{minHeight:'100vh', background:'transparent', display:'flex', alignItems:'center', justifyContent:'center', color:'#e5e7eb', fontSize:18}}>
        Syncing your live dashboard data...
      </div>
    );
  }

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      {/* Top Navigation */}
      <TopNavBar showMenuButton={false} />
      <div style={{background:'rgba(0,0,0,0.15)', padding:'8px 32px', display:'flex', justifyContent:'flex-end'}}>
        <div style={{fontSize:12, color:'#b8beca'}}>{tier} - {loyaltyPoints} pts</div>
      </div>

      <div style={{maxWidth:1400, margin:'0 auto', padding:32}}>
        {/* Customer Stats */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:16, marginBottom:32}}>
          <div style={{background:'rgba(229,51,42,0.1)', border:'1px solid rgba(229,51,42,0.3)', borderRadius:12, padding:20}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>Active Jobs</div>
            <div style={{fontSize:32, fontWeight:700, color:'#e5332a'}}>{customerStats.openOrders}</div>
          </div>
          <div style={{background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:12, padding:20}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>Total Vehicles</div>
            <div style={{fontSize:32, fontWeight:700, color:'#22c55e'}}>{stats.vehicleCount}</div>
          </div>
          <div style={{background:'rgba(229,51,42,0.1)', border:'1px solid rgba(229,51,42,0.3)', borderRadius:12, padding:20}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>Loyalty Points</div>
            <div style={{fontSize:32, fontWeight:700, color:'#e5332a'}}>{loyaltyPoints}</div>
          </div>
        </div>

        {/* Real-Time Work Orders Updates */}
        <RealTimeWorkOrders userId={userId} onWorkOrderUpdate={(data) => {
          // Mirror what the window listener does so updates from this component bubble up immediately
          setRecentData(prev => ({ ...prev, history: [data, ...prev.history].slice(0, 3) }));
          fetchStats();
        }} />

        {/* Tab Navigation */}
        <div style={{marginBottom:32}}>
          <div style={{display:'flex', gap:8, borderBottom:'2px solid rgba(255,255,255,0.1)', paddingBottom:2, overflowX:'auto'}}>
            <button
              onClick={() => setActiveTab('discover')}
              style={{
                padding:'12px 24px',
                background: activeTab === 'discover' ? 'rgba(229,51,42,0.2)' : 'transparent',
                border:'none',
                borderBottom: activeTab === 'discover' ? '3px solid #e5332a' : '3px solid transparent',
                color: activeTab === 'discover' ? '#e5332a' : '#9aa3b2',
                cursor:'pointer',
                fontSize:15,
                fontWeight:700,
                transition:'all 0.2s',
                borderRadius:'8px 8px 0 0',
                whiteSpace:'nowrap'
              }}
            >
              <FaSearch style={{marginRight:4}} /> Discover
            </button>
            <button
              onClick={() => setActiveTab('active')}
              style={{
                padding:'12px 24px',
                background: activeTab === 'active' ? 'rgba(229,51,42,0.2)' : 'transparent',
                border:'none',
                borderBottom: activeTab === 'active' ? '3px solid #e5332a' : '3px solid transparent',
                color: activeTab === 'active' ? '#e5332a' : '#9aa3b2',
                cursor:'pointer',
                fontSize:15,
                fontWeight:700,
                transition:'all 0.2s',
                borderRadius:'8px 8px 0 0',
                whiteSpace:'nowrap'
              }}
            >
              <FaBolt style={{marginRight:4}} /> Active Services
            </button>
            <button
              onClick={() => setActiveTab('account')}
              style={{
                padding:'12px 24px',
                background: activeTab === 'account' ? 'rgba(229,51,42,0.2)' : 'transparent',
                border:'none',
                borderBottom: activeTab === 'account' ? '3px solid #e5332a' : '3px solid transparent',
                color: activeTab === 'account' ? '#e5332a' : '#9aa3b2',
                cursor:'pointer',
                fontSize:15,
                fontWeight:700,
                transition:'all 0.2s',
                borderRadius:'8px 8px 0 0',
                whiteSpace:'nowrap'
              }}
            >
              <FaUser style={{marginRight:4}} /> Account
            </button>
            <button
              onClick={() => setActiveTab('records')}
              style={{
                padding:'12px 24px',
                background: activeTab === 'records' ? 'rgba(229,51,42,0.2)' : 'transparent',
                border:'none',
                borderBottom: activeTab === 'records' ? '3px solid #e5332a' : '3px solid transparent',
                color: activeTab === 'records' ? '#e5332a' : '#9aa3b2',
                cursor:'pointer',
                fontSize:15,
                fontWeight:700,
                transition:'all 0.2s',
                borderRadius:'8px 8px 0 0',
                whiteSpace:'nowrap'
              }}
            >
              <FaChartBar style={{marginRight:4}} /> Records
            </button>
          </div>
        </div>

        {/* Feature Cards Grid - Conditional Rendering Based on Active Tab */}
        {activeTab === 'discover' && (
          <div style={{marginBottom:32}}>
            <h2 style={{fontSize:24, fontWeight:700, color:'#e5e7eb', marginBottom:16}}><FaSearch style={{marginRight:4}} /> Discover</h2>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:20}}>
              {discoverFeatures.map(feature => {
                const recentItems = feature.getData();
                return (
              <Link key={feature.id} href={feature.link as Route} style={{textDecoration:'none'}}>
                <div style={{
                  background:'#000000',
                  border:'1px solid rgba(255,255,255,0.15)',
                  borderRadius:16,
                  padding:24,
                  cursor:'pointer',
                  transition:'all 0.3s',
                  position:'relative',
                  minHeight:280
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)';
                  e.currentTarget.style.borderColor = 'rgba(229,51,42,0.4)';
                  e.currentTarget.style.boxShadow = '0 12px 24px rgba(229,51,42,0.25)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                  e.currentTarget.style.boxShadow = 'none';
                }}>
                  {feature.badge && (
                    <div style={{position:'absolute', top:12, right:12, padding:'4px 10px', background:feature.badgeColor, color:'white', borderRadius:12, fontSize:10, fontWeight:700}}>
                      {feature.badge}
                    </div>
                  )}
                  <div style={{fontSize:48, marginBottom:12}}>{feature.icon}</div>
                  <div style={{fontSize:18, fontWeight:700, color:'#e5e7eb', marginBottom:8}}>{feature.name}</div>
                  <div style={{fontSize:13, color:'#9aa3b2', marginBottom:12}}>{feature.desc}</div>
                  <div style={{fontSize:12, color:'#6b7280', padding:'8px 12px', background:'rgba(0,0,0,0.3)', borderRadius:8, borderLeft:'3px solid rgba(229,51,42,0.5)', marginBottom:12}}>
                    {feature.detail}
                  </div>
                  
                  {/* Recent Items */}
                  {recentItems && recentItems.length > 0 ? (
                    <div style={{marginTop:12, borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:12}}>
                      <div style={{fontSize:11, fontWeight:600, color:'#9aa3b2', marginBottom:8, textTransform:'uppercase'}}>Recent</div>
                      {recentItems.map((item: any, idx: number) => (
                        <div key={idx} style={{fontSize:11, color:'#b8beca', marginBottom:6, display:'flex', alignItems:'center', gap:6}}>
                          <span style={{color:'#e5332a'}}>-</span>
                          <span style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                            {item.serviceType || item.shop?.shopName || (typeof item.issueDescription === 'string' ? item.issueDescription : item.issueDescription?.symptoms) || 'Item'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{marginTop:12, borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:12, fontSize:11, color:'#6b7280', textAlign:'center'}}>
                      No recent activity
                    </div>
                  )}
                </div>
              </Link>
            )})}
          </div>
        </div>
        )}

        {activeTab === 'active' && (
        <div style={{marginBottom:32}}>
          <h2 style={{fontSize:24, fontWeight:700, color:'#e5e7eb', marginBottom:16}}><FaBolt style={{marginRight:4}} /> Active Services</h2>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:20}}>
            {activeFeatures.map(feature => {
              const recentItems = feature.getData();
              return (
              <Link key={feature.id} href={feature.link as Route} style={{textDecoration:'none'}}>
                <div style={{
                  background:'#000000',
                  border:'1px solid rgba(255,255,255,0.15)',
                  borderRadius:16,
                  padding:24,
                  cursor:'pointer',
                  transition:'all 0.3s',
                  position:'relative',
                  minHeight:280
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)';
                  e.currentTarget.style.borderColor = 'rgba(229,51,42,0.4)';
                  e.currentTarget.style.boxShadow = '0 12px 24px rgba(229,51,42,0.25)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                  e.currentTarget.style.boxShadow = 'none';
                }}>
                  {feature.badge && (
                    <div style={{position:'absolute', top:12, right:12, padding:'4px 10px', background:feature.badgeColor, color:'white', borderRadius:12, fontSize:10, fontWeight:700}}>
                      {feature.badge}
                    </div>
                  )}
                  <div style={{fontSize:48, marginBottom:12}}>{feature.icon}</div>
                  <div style={{fontSize:18, fontWeight:700, color:'#e5e7eb', marginBottom:8}}>{feature.name}</div>
                  <div style={{fontSize:13, color:'#9aa3b2', marginBottom:12}}>{feature.desc}</div>
                  <div style={{fontSize:12, color:'#6b7280', padding:'8px 12px', background:'rgba(0,0,0,0.3)', borderRadius:8, borderLeft:'3px solid rgba(229,51,42,0.5)', marginBottom:12}}>
                    {feature.detail}
                  </div>
                  
                  {recentItems && recentItems.length > 0 ? (
                    <div style={{marginTop:12, borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:12}}>
                      <div style={{fontSize:11, fontWeight:600, color:'#9aa3b2', marginBottom:8, textTransform:'uppercase'}}>Recent</div>
                      {recentItems.map((item: any, idx: number) => (
                        <div key={idx} style={{fontSize:11, color:'#b8beca', marginBottom:6, display:'flex', alignItems:'center', gap:6}}>
                          <span style={{color:'#e5332a'}}>-</span>
                          <span style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                            {item.lastMessage || item.contactName || [item.year, item.make, item.model].filter(Boolean).join(' ') || 'Item'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{marginTop:12, borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:12, fontSize:11, color:'#6b7280', textAlign:'center'}}>
                      No recent activity
                    </div>
                  )}
                </div>
              </Link>
            )})}
          </div>
        </div>
        )}

        {activeTab === 'account' && (
        <div style={{marginBottom:32}}>
          <h2 style={{fontSize:24, fontWeight:700, color:'#e5e7eb', marginBottom:16}}><FaUser style={{marginRight:4}} /> Account</h2>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:20}}>
            {accountFeatures.map(feature => {
              const recentItems = feature.getData();
              return (
              <Link key={feature.id} href={feature.link as Route} style={{textDecoration:'none'}}>
                <div style={{
                  background:'#000000',
                  border:'1px solid rgba(255,255,255,0.15)',
                  borderRadius:16,
                  padding:24,
                  cursor:'pointer',
                  transition:'all 0.3s',
                  position:'relative',
                  minHeight:280
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)';
                  e.currentTarget.style.borderColor = 'rgba(229,51,42,0.4)';
                  e.currentTarget.style.boxShadow = '0 12px 24px rgba(229,51,42,0.25)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                  e.currentTarget.style.boxShadow = 'none';
                }}>
                  {feature.badge && (
                    <div style={{position:'absolute', top:12, right:12, padding:'4px 10px', background:feature.badgeColor, color:'white', borderRadius:12, fontSize:10, fontWeight:700}}>
                      {feature.badge}
                    </div>
                  )}
                  <div style={{fontSize:48, marginBottom:12}}>{feature.icon}</div>
                  <div style={{fontSize:18, fontWeight:700, color:'#e5e7eb', marginBottom:8}}>{feature.name}</div>
                  <div style={{fontSize:13, color:'#9aa3b2', marginBottom:12}}>{feature.desc}</div>
                  <div style={{fontSize:12, color:'#6b7280', padding:'8px 12px', background:'rgba(0,0,0,0.3)', borderRadius:8, borderLeft:'3px solid rgba(229,51,42,0.5)', marginBottom:12}}>
                    {feature.detail}
                  </div>
                  
                  {recentItems && recentItems.length > 0 ? (
                    <div style={{marginTop:12, borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:12}}>
                      <div style={{fontSize:11, fontWeight:600, color:'#9aa3b2', marginBottom:8, textTransform:'uppercase'}}>Recent</div>
                      {recentItems.map((item: any, idx: number) => (
                        <div key={idx} style={{fontSize:11, color:'#b8beca', marginBottom:6, display:'flex', alignItems:'center', gap:6}}>
                          <span style={{color:'#e5332a'}}>-</span>
                          <span style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                            {item.shop?.shopName || item.comment || (item.brand && item.last4 ? `${item.brand} ••••${item.last4}` : item.brand || item.type) || 'Item'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{marginTop:12, borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:12, fontSize:11, color:'#6b7280', textAlign:'center'}}>
                      No recent activity
                    </div>
                  )}
                </div>
              </Link>
            )})}
          </div>
        </div>
        )}

        {activeTab === 'records' && (
        <div>
          <h2 style={{fontSize:24, fontWeight:700, color:'#e5e7eb', marginBottom:16}}><FaChartBar style={{marginRight:4}} /> Records</h2>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:20}}>
            {recordsFeatures.map(feature => {
              const recentItems = feature.getData();
              return (
              <Link key={feature.id} href={feature.link as Route} style={{textDecoration:'none'}}>
                <div style={{
                  background:'#000000',
                  border:'1px solid rgba(255,255,255,0.15)',
                  borderRadius:16,
                  padding:24,
                  cursor:'pointer',
                  transition:'all 0.3s',
                  position:'relative',
                  minHeight:280
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)';
                  e.currentTarget.style.borderColor = 'rgba(229,51,42,0.4)';
                  e.currentTarget.style.boxShadow = '0 12px 24px rgba(229,51,42,0.25)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                  e.currentTarget.style.boxShadow = 'none';
                }}>
                  {feature.badge && (
                    <div style={{position:'absolute', top:12, right:12, padding:'4px 10px', background:feature.badgeColor, color:'white', borderRadius:12, fontSize:10, fontWeight:700}}>
                      {feature.badge}
                    </div>
                  )}
                  <div style={{fontSize:48, marginBottom:12}}>{feature.icon}</div>
                  <div style={{fontSize:18, fontWeight:700, color:'#e5e7eb', marginBottom:8}}>{feature.name}</div>
                  <div style={{fontSize:13, color:'#9aa3b2', marginBottom:12}}>{feature.desc}</div>
                  <div style={{fontSize:12, color:'#6b7280', padding:'8px 12px', background:'rgba(0,0,0,0.3)', borderRadius:8, borderLeft:'3px solid rgba(229,51,42,0.5)', marginBottom:12}}>
                    {feature.detail}
                  </div>
                  
                  {recentItems && recentItems.length > 0 ? (
                    <div style={{marginTop:12, borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:12}}>
                      <div style={{fontSize:11, fontWeight:600, color:'#9aa3b2', marginBottom:8, textTransform:'uppercase'}}>Recent</div>
                      {recentItems.map((item: any, idx: number) => (
                        <div key={idx} style={{fontSize:11, color:'#b8beca', marginBottom:6, display:'flex', alignItems:'center', gap:6}}>
                          <span style={{color:'#e5332a'}}>-</span>
                          <span style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                            {(typeof item.issueDescription === 'string' ? item.issueDescription : item.issueDescription?.symptoms) || item.name || 'Item'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{marginTop:12, borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:12, fontSize:11, color:'#6b7280', textAlign:'center'}}>
                      No recent activity
                    </div>
                  )}
                </div>
              </Link>
            )})}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

